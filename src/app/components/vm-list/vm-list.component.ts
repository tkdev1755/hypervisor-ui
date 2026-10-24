import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, interval, take } from 'rxjs';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { VmCloneModalComponent } from '@app/components/vm-clone-modal/vm-clone-modal.component';
import { VmConsoleModalComponent } from '@app/components/vm-console-modal/vm-console-modal.component';
import { VmShareModalComponent } from '@app/components/vm-share-modal/vm-share-modal.component';
import { VmDeleteModalComponent } from '@app/components/vm-delete-modal/vm-delete-modal.component';
import { VmFormModalComponent } from '@app/components/vm-form-modal/vm-form-modal.component';
import { AppError } from '@app/models/app-error.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { AuthService } from '@app/services/auth.service';
import { InventoryService } from '@app/services/inventory.service';
import { ModalService } from '@app/services/modal.service';
import { ShareService } from '@app/services/share.service';
import { VmService } from '@app/services/vm.service';
import { canManage, ownerLabel } from '@app/utils/vm-access';

/** Les trois filtres d'état proposés au-dessus de la liste. */
type StatusFilter = 'all' | 'running' | 'stopped';

/**
 * Les VM d'un hyperviseur : un récapitulatif des ressources en service, une recherche et un filtre
 * d'état, puis la liste avec démarrage, arrêt, console VNC (VM en marche), clonage et suppression
 * (VM arrêtée), et prêt à un autre utilisateur.
 *
 * Les boutons dépendent des droits (champ `access` de chaque VM) :
 *  - une VM PRÊTÉE à l'utilisateur : console, démarrer, arrêter, et « Rendre » ;
 *  - une VM à lui ou un compte admin : tout le reste (cloner, supprimer, prêter).
 * Le bouton « Créer une VM » n'apparaît que si l'API autorise la création ici (voir checkCanCreate).
 *
 * « Arrêter » demande un arrêt propre (ACPI) : la VM peut mettre du temps à s'éteindre. Tant qu'elle
 * tourne, la liste est rechargée toutes les 2 secondes (polling) et la ligne affiche « Arrêt en cours… ».
 */
@Component({
  selector: 'app-vm-list',
  imports: [
    ColumnComponent,
    RowComponent,
    SpacerComponent,
    TextComponent,
    ButtonComponent,
    LoadingComponent,
    ErrorPanelComponent,
    EmptyStateComponent,
    ListComponent,
    ListTileComponent,
    TextFieldComponent,
    ChoiceCardsComponent,
    GridComponent,
    CardComponent,
  ],
  templateUrl: './vm-list.component.html',
  styleUrl: './vm-list.component.scss',
})
export class VmListComponent implements OnInit, OnDestroy {
  private readonly vms = inject(VmService);
  private readonly modal = inject(ModalService);
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly shares = inject(ShareService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  protected readonly list = signal<VirtualMachine[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  /** L'id de la VM en cours de démarrage ou d'arrêt (pour afficher son chargement). */
  protected readonly busyId = signal<string | null>(null);
  /** Peut-on créer une VM ici ? Un admin toujours ; un utilisateur seulement s'il a l'accès à l'hyperviseur. */
  protected readonly canCreate = signal(this.auth.isAdmin());

  // Exposés au .html : ce sont des fonctions simples, définies dans utils/vm-access.ts.
  protected readonly canManage = canManage;

  protected readonly shuttingDownIds = signal<Set<string>>(new Set());
  private pollSub?: Subscription;

  protected readonly search = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly statusChoices: Choice<StatusFilter>[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'running', label: 'En marche' },
    { value: 'stopped', label: 'Arrêtées' },
  ];

  protected readonly runningVms = computed(() =>
    this.list().filter((vm) => vm.status === 'running'),
  );

  protected readonly totalVcpus = computed(() =>
    this.runningVms().reduce((total, vm) => total + vm.vcpus, 0),
  );

  protected readonly totalMemoryGb = computed(() => {
    const totalMb = this.runningVms().reduce((total, vm) => total + vm.memory_mb, 0);
    return Math.round((totalMb / 1024) * 10) / 10;
  });

  protected readonly filteredList = computed(() => {
    const query = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.list().filter((vm) => {
      const matchQuery = query === '' || vm.name.toLowerCase().includes(query);
      const isRunning = vm.status === 'running';
      const matchStatus =
        filter === 'all' ||
        (filter === 'running' && isRunning) ||
        (filter === 'stopped' && !isRunning);

      return matchQuery && matchStatus;
    });
  });

  ngOnInit(): void {
    this.load();
    this.checkCanCreate();
  }

  /**
   * Un utilisateur sans accès à l'hyperviseur reçoit 403 sur « vm-options » (et sur la création) :
   * on interroge donc cette route pour savoir s'il faut montrer « Créer une VM ».
   */
  private checkCanCreate(): void {
    if (this.auth.isAdmin()) {
      return;
    }
    this.vms.options(this.hypervisorId()).subscribe({
      next: () => this.canCreate.set(true),
      error: () => this.canCreate.set(false),
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  protected load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      this.error.set(null);
    }
    this.vms.list(this.hypervisorId()).subscribe({
      next: (vms: VirtualMachine[]) => {
        this.list.set(vms);
        if (!silent) {
          this.loading.set(false);
        }
        this.checkShuttingDownStatus(vms);
      },
      error: (error: AppError) => {
        // Un utilisateur qui vient de rendre sa dernière VM prêtée ici ne voit plus cet hyperviseur (404) :
        // on le ramène à la liste plutôt que d'afficher une erreur.
        if (error.kind === 'business' && error.code === 'NOT_FOUND' && !this.auth.isAdmin()) {
          this.stopPolling();
          this.inventory.refresh();
          void this.router.navigate(['/hypervisors']);
          return;
        }
        // Pendant le polling (silent), une erreur passagère ne remplace pas la liste par un message.
        if (!silent) {
          this.error.set(error);
          this.loading.set(false);
        }
      },
    });
  }

  /** Le sous-titre d'une VM, par exemple « 2 vCPU · 4 Go · propriétaire : alice ». */
  protected describe(vm: VirtualMachine): string {
    const owner = ownerLabel(vm);
    const specs = `${vm.vcpus} vCPU · ${Math.round((vm.memory_mb / 1024) * 10) / 10} Go${owner ? ' · ' + owner : ''}`;
    return this.isShuttingDown(vm.id) ? `${specs} — Arrêt en cours…` : specs;
  }

  /** Un arrêt propre est en cours : demandé par nous (polling) ou signalé par l'API (« shutting_down »). */
  protected isShuttingDown(vmId: string): boolean {
    return this.shuttingDownIds().has(vmId) || this.list().some((vm) => vm.id === vmId && vm.status === 'shutting_down');
  }

  protected start(vm: VirtualMachine): void {
    this.runAction(vm, this.vms.start(this.hypervisorId(), vm.id));
  }

  protected stop(vm: VirtualMachine): void {
    this.actionError.set(null);

    const current = new Set(this.shuttingDownIds());
    current.add(vm.id);
    this.shuttingDownIds.set(current);

    this.vms.stop(this.hypervisorId(), vm.id).subscribe({
      next: () => {
        this.inventory.refresh();
        this.startPolling();
      },
      error: (error: AppError) => {
        const rollback = new Set(this.shuttingDownIds());
        rollback.delete(vm.id);
        this.shuttingDownIds.set(rollback);
        this.actionError.set(error);
      },
    });
  }

  protected details(vm: VirtualMachine): void {
    this.router.navigate(['/hypervisors', this.hypervisorId(), 'vms', vm.id]);
  }

  /** Coupe l'alimentation de la VM (comme débrancher une machine) : on demande confirmation. */
  protected forceStop(vm: VirtualMachine): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Forcer l'arrêt de « ${vm.name} » ?`,
          message:
            "L'alimentation est coupée immédiatement : les données non enregistrées dans la VM sont perdues.",
          confirmLabel: "Forcer l'arrêt",
          successMessage: 'VM arrêtée.',
          danger: true,
          action: () => this.vms.stop(this.hypervisorId(), vm.id, true),
        },
      })
      .afterClosed$.subscribe((stopped: boolean | undefined) => {
        if (stopped) {
          const updated = new Set(this.shuttingDownIds());
          updated.delete(vm.id);
          this.shuttingDownIds.set(updated);
          this.changed();
        }
      });
  }

  protected create(): void {
    this.modal
      .open<VmFormModalComponent, VirtualMachine>(VmFormModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), hypervisorName: this.hypervisorName() },
      })
      .afterClosed$.subscribe((vm: VirtualMachine | undefined) => {
        if (vm) {
          this.changed();
        }
      });
  }

  /** Cloner : la VM source doit être arrêtée (sinon l'API répond 409). */
  protected clone(vm: VirtualMachine): void {
    this.modal
      .open<VmCloneModalComponent, VirtualMachine>(VmCloneModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), source: vm },
      })
      .afterClosed$.subscribe((clone: VirtualMachine | undefined) => {
        if (clone) {
          this.changed();
        }
      });
  }

  /** Prêter la VM à un autre utilisateur (propriétaire ou admin). */
  protected share(vm: VirtualMachine): void {
    this.modal.open<VmShareModalComponent, void>(VmShareModalComponent, {
      inputs: { hypervisorId: this.hypervisorId(), vm },
    });
  }

  /** « Rendre » une VM prêtée : l'emprunteur retire lui-même son propre prêt. */
  protected giveBack(vm: VirtualMachine): void {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return;
    }
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Rendre « ${vm.name} » ?`,
          message: `Vous n'aurez plus accès à cette machine virtuelle. ${vm.owner ? vm.owner + ' pourra vous la prêter à nouveau.' : ''}`,
          confirmLabel: 'Rendre',
          successMessage: 'VM rendue.',
          action: () => this.shares.revoke(this.hypervisorId(), vm.id, userId),
        },
      })
      .afterClosed$.subscribe((done) => {
        if (done) {
          this.changed();
        }
      });
  }

  protected console(vm: VirtualMachine): void {
    this.modal.open<VmConsoleModalComponent, void>(VmConsoleModalComponent, {
      size: 'screen',
      inputs: { hypervisorId: this.hypervisorId(), vm },
    });
  }

  protected remove(vm: VirtualMachine): void {
    this.modal
      .open<VmDeleteModalComponent, boolean>(VmDeleteModalComponent, {
        size: 'sm',
        inputs: { hypervisorId: this.hypervisorId(), vm },
      })
      .afterClosed$.subscribe((deleted: boolean | undefined) => {
        if (deleted) {
          this.changed();
        }
      });
  }

  private startPolling(): void {
    if (this.pollSub) {
      return;
    }
    // Au plus 30 interrogations (une minute) : si le système invité ignore l'arrêt propre (ACPI), on
    // s'arrête là au lieu d'interroger l'API indéfiniment, et la ligne redevient normale (« Forcer » reste possible).
    this.pollSub = interval(2000)
      .pipe(take(30))
      .subscribe({
        next: () => this.load(true),
        complete: () => {
          this.pollSub = undefined;
          this.shuttingDownIds.set(new Set());
        },
      });
  }

  private stopPolling(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = undefined;
    }
  }

  private checkShuttingDownStatus(vms: VirtualMachine[]): void {
    const current = new Set(this.shuttingDownIds());
    if (current.size === 0) {
      this.stopPolling();
      return;
    }

    for (const vm of vms) {
      if (current.has(vm.id) && vm.status === 'stopped') {
        current.delete(vm.id);
      }
    }

    this.shuttingDownIds.set(current);

    if (current.size === 0) {
      this.stopPolling();
      this.inventory.refresh();
    }
  }

  /** Après un changement : recharger la liste, l'inventaire de la barre latérale, et la consommation de quota. */
  private changed(): void {
    this.load();
    this.inventory.refresh();
    this.auth.refreshUsage();
  }

  private runAction(vm: VirtualMachine, request: Observable<unknown>): void {
    this.busyId.set(vm.id);
    this.actionError.set(null);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.changed();
      },
      error: (error: AppError) => {
        this.busyId.set(null);
        this.actionError.set(error);
      },
    });
  }
}
