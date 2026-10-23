import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { exhaustMap, filter, take, takeUntil, timer } from 'rxjs';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { VmCloneModalComponent } from '@app/components/vm-clone-modal/vm-clone-modal.component';
import { VmConsoleModalComponent } from '@app/components/vm-console-modal/vm-console-modal.component';
import { VmDeleteModalComponent } from '@app/components/vm-delete-modal/vm-delete-modal.component';
import { VmOwnerModalComponent } from '@app/components/vm-owner-modal/vm-owner-modal.component';
import { VmShareModalComponent } from '@app/components/vm-share-modal/vm-share-modal.component';
import { AppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { AuthService } from '@app/services/auth.service';
import { ContextBridgeService } from '@app/services/context-bridge.service';
import { InventoryService } from '@app/services/inventory.service';
import { ModalService } from '@app/services/modal.service';
import { ShareService } from '@app/services/share.service';
import { VmService } from '@app/services/vm.service';
import { canManage } from '@app/utils/vm-access';

/**
 * La page d'une machine virtuelle : ses caractéristiques et toutes les actions
 * possibles (démarrer, arrêter, console, cloner, supprimer, prêter).
 * Une VM prêtée à l'utilisateur n'offre que la console, démarrer, arrêter et « Rendre » ;
 * l'administrateur peut en plus changer le propriétaire.
 *
 * `id` (hyperviseur) et `vmId` viennent de l'adresse /hypervisors/:id/vms/:vmId.
 */
@Component({
  selector: 'app-vm-detail',
  imports: [
    PageComponent,
    ColumnComponent,
    GridComponent,
    CardComponent,
    TextComponent,
    ButtonComponent,
    StatusBadgeComponent,
    LoadingComponent,
    ErrorPanelComponent,
  ],
  templateUrl: './vm-detail.component.html',
  styleUrl: './vm-detail.component.scss',
})
export class VmDetailComponent implements OnInit {
  private readonly vms = inject(VmService);
  private readonly bridge = inject(ContextBridgeService);
  private readonly inventory = inject(InventoryService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  private readonly shares = inject(ShareService);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly vmId = input.required<string>();

  protected readonly hypervisor = signal<Hypervisor | null>(null);
  protected readonly vm = signal<VirtualMachine | null>(null);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    this.bridge.resolve('hypervisor', this.id()).subscribe({
      next: (hypervisor) => this.hypervisor.set(hypervisor),
      error: () => undefined, // Le nom n'est qu'un détail d'affichage.
    });
    this.load();
  }

  protected load(): void {
    this.error.set(null);
    this.vms.get(this.id(), this.vmId()).subscribe({
      next: (vm) => this.vm.set(vm),
      error: (error: AppError) => this.error.set(error),
    });
  }

  // Exposés au .html : des fonctions simples, définies dans utils/vm-access.ts.
  protected readonly canManage = canManage;

  protected memory(vm: VirtualMachine): string {
    return `${Math.round((vm.memory_mb / 1024) * 10) / 10} Go`;
  }

  protected start(): void {
    this.run(this.vms.start(this.id(), this.vmId()));
  }

  protected stop(): void {
    this.busy.set(true);
    this.actionError.set(null);
    this.vms.stop(this.id(), this.vmId()).subscribe({
      next: (vm) => {
        this.vm.set(vm);
        if (vm.status === 'running') {
          this.waitUntilStopped();
          return;
        }
        this.busy.set(false);
        this.inventory.refresh();
      },
      error: (error: AppError) => {
        this.actionError.set(error);
        this.busy.set(false);
      },
    });
  }

  /** Coupe l'alimentation de la VM : on demande confirmation. */
  protected forceStop(vm: VirtualMachine): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Forcer l'arrêt de « ${vm.name} » ?`,
          message: "L'alimentation est coupée immédiatement : les données non enregistrées dans la VM sont perdues.",
          confirmLabel: "Forcer l'arrêt",
          successMessage: 'VM arrêtée.',
          danger: true,
          action: () => this.vms.stop(this.id(), this.vmId(), true),
        },
      })
      .afterClosed$.subscribe((stopped) => {
        if (stopped) {
          this.load();
          this.inventory.refresh();
        }
      });
  }

  protected share(vm: VirtualMachine): void {
    this.modal.open<VmShareModalComponent, void>(VmShareModalComponent, { inputs: { hypervisorId: this.id(), vm } });
  }

  /** Admin : changer le propriétaire, puis recharger la VM (son champ `owner` a changé). */
  protected changeOwner(vm: VirtualMachine): void {
    this.modal
      .open<VmOwnerModalComponent, VirtualMachine>(VmOwnerModalComponent, { inputs: { hypervisorId: this.id(), vm } })
      .afterClosed$.subscribe((updated) => {
        if (updated) {
          this.load();
          this.inventory.refresh();
        }
      });
  }

  /** « Rendre » une VM prêtée : on retire son propre prêt, puis on quitte la page (elle ne nous est plus accessible). */
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
          action: () => this.shares.revoke(this.id(), vm.id, userId),
        },
      })
      .afterClosed$.subscribe((done) => {
        if (done) {
          this.inventory.refresh();
          this.router.navigate(['/hypervisors']);
        }
      });
  }

  protected console(vm: VirtualMachine): void {
    this.modal.open<VmConsoleModalComponent, void>(VmConsoleModalComponent, { size: 'screen', inputs: { hypervisorId: this.id(), vm } });
  }

  protected clone(vm: VirtualMachine): void {
    this.modal
      .open<VmCloneModalComponent, VirtualMachine>(VmCloneModalComponent, { inputs: { hypervisorId: this.id(), source: vm } })
      .afterClosed$.subscribe((copy) => {
        if (copy) {
          this.inventory.refresh();
          this.auth.refreshUsage();
          this.router.navigate(['/hypervisors', this.id(), 'vms', copy.id]);
        }
      });
  }

  protected remove(vm: VirtualMachine): void {
    this.modal
      .open<VmDeleteModalComponent, boolean>(VmDeleteModalComponent, { size: 'sm', inputs: { hypervisorId: this.id(), vm } })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.inventory.refresh();
          this.auth.refreshUsage();
          this.router.navigate(['/hypervisors', this.id()]);
        }
      });
  }

  private run(request: ReturnType<VmService['start']>): void {
    this.busy.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: (vm) => {
        this.vm.set(vm);
        this.busy.set(false);
        this.inventory.refresh();
      },
      error: (error: AppError) => {
        this.actionError.set(error);
        this.busy.set(false);
      },
    });
  }

  private waitUntilStopped(): void {
    timer(0, 1000)
      .pipe(
        exhaustMap(() => this.vms.get(this.id(), this.vmId())),
        filter((vm) => vm.status !== 'running'),
        take(1),
        takeUntil(timer(60_000)),
      )
      .subscribe({
        next: (vm) => {
          this.vm.set(vm);
          this.busy.set(false);
          this.inventory.refresh();
        },
        complete: () => this.busy.set(false),
        error: (error: AppError) => {
          this.actionError.set(error);
          this.busy.set(false);
        },
      });
  }
}
