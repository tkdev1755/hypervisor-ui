import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, timer } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { CodeBlockComponent } from '@app/components/ui/code-block/code-block.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { LabInstance, LabInstanceNetwork, LabInstanceVm } from '@app/models/lab.model';
import { InventoryService } from '@app/services/inventory.service';
import { LabService } from '@app/services/lab.service';
import { ModalService } from '@app/services/modal.service';

/**
 * La page d'une instance de labo, à l'adresse /hypervisors/:id/labs/:labId/instances/:instanceId
 * (son propriétaire, ceux qui gèrent le labo, les admins).
 *
 *  - Pendant le déploiement ('deploying'), la page se recharge toutes les 3 secondes.
 *  - Si le déploiement a raté ('failed'), l'API a déjà supprimé ce qu'il avait créé : on affiche la raison,
 *    et il ne reste qu'à supprimer l'instance.
 *  - Une fois prête : Démarrer (routeurs d'abord), Arrêter (proprement, routeurs en dernier), Forcer l'arrêt,
 *    Supprimer. Chaque VM s'ouvre sur sa propre page (console, démarrer, arrêter) : elle appartient au
 *    propriétaire de l'instance, les routes des VM marchent dessus.
 */
@Component({
  selector: 'app-lab-instance-detail',
  imports: [
    PageComponent,
    ColumnComponent,
    TextComponent,
    ButtonComponent,
    CalloutComponent,
    CodeBlockComponent,
    StatusBadgeComponent,
    ListComponent,
    ListTileComponent,
    LoadingComponent,
    ErrorPanelComponent,
    EmptyStateComponent,
  ],
  templateUrl: './lab-instance-detail.component.html',
  styleUrl: './lab-instance-detail.component.scss',
})
export class LabInstanceDetailComponent implements OnInit, OnDestroy {
  private readonly labs = inject(LabService);
  private readonly modal = inject(ModalService);
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly labId = input.required<string>();
  readonly instanceId = input.required<string>();

  protected readonly instance = signal<LabInstance | null>(null);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  /** Un démarrage ou un arrêt est en cours (chargement des boutons). */
  protected readonly busy = signal(false);

  protected readonly running = computed(() => this.instance()?.vms.filter((vm) => vm.status === 'running').length ?? 0);

  private pollSub?: Subscription;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  /** Recharge l'instance ; relance dans 3 s tant qu'elle se déploie. */
  protected load(): void {
    this.pollSub?.unsubscribe();
    this.labs.getInstance(this.id(), this.labId(), this.instanceId()).subscribe({
      next: (instance) => {
        const wasDeploying = this.instance()?.status === 'deploying';
        this.error.set(null);
        this.instance.set(instance);
        if (instance.status === 'deploying') {
          this.pollSub = timer(3000).subscribe(() => this.load());
        } else if (wasDeploying) {
          // Les nouvelles VM apparaissent dans la barre latérale.
          this.inventory.refresh();
        }
      },
      error: (error: AppError) => this.error.set(error),
    });
  }

  /** « Routeur · cartes : virbr0 → lab-1a2b-lan1 ». */
  protected vmSubtitle(vm: LabInstanceVm): string {
    const role = vm.role === 'router' ? 'Routeur' : 'VM';
    const nics = vm.networks.length ? `cartes : ${vm.networks.join(' → ')}` : 'aucune carte réseau';
    return `${role} · ${nics}`;
  }

  protected networkSubtitle(network: LabInstanceNetwork): string {
    return network.kind === 'external'
      ? `Externe · réseau ${network.libvirt_network} de l'hyperviseur`
      : `Interne · ${network.libvirt_network}, propre à cette instance`;
  }

  protected date(seconds: number): string {
    return new Date(seconds * 1000).toLocaleString('fr-FR');
  }

  protected openVm(vm: LabInstanceVm): void {
    this.router.navigate(['/hypervisors', this.id(), 'vms', vm.vm_id]);
  }

  protected start(): void {
    this.power(this.labs.startInstance(this.id(), this.labId(), this.instanceId()));
  }

  /** Arrêt propre (ACPI) : les VM peuvent mettre un moment à s'éteindre ; « Forcer l'arrêt » les coupe. */
  protected stop(force = false): void {
    if (force) {
      this.confirm(
        "Forcer l'arrêt de toutes les VM ?",
        'Elles seront coupées tout de suite, comme si on débranchait la prise : les données non enregistrées sont perdues.',
        "Forcer l'arrêt",
        () => this.labs.stopInstance(this.id(), this.labId(), this.instanceId(), true),
        () => this.load(),
      );
    } else {
      this.power(this.labs.stopInstance(this.id(), this.labId(), this.instanceId()));
    }
  }

  private power(request: Observable<LabInstance>): void {
    this.busy.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: (instance) => {
        this.instance.set(instance);
        this.busy.set(false);
        this.inventory.refresh();
      },
      error: (error: AppError) => {
        this.actionError.set(error);
        this.busy.set(false);
      },
    });
  }

  protected remove(instance: LabInstance): void {
    this.confirm(
      `Supprimer l'instance « ${instance.name} » ?`,
      `Ses ${instance.vms.length} VM, leurs disques et ses réseaux internes seront supprimés. C'est définitif.`,
      'Supprimer',
      () => this.labs.deleteInstance(this.id(), this.labId(), instance.id),
      () => {
        this.inventory.refresh();
        this.router.navigate(['/hypervisors', this.id(), 'labs', this.labId()]);
      },
    );
  }

  private confirm(title: string, message: string, confirmLabel: string, action: () => Observable<unknown>, after: () => void): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: { title, message, confirmLabel, danger: true, action },
      })
      .afterClosed$.subscribe((done) => {
        if (done) {
          after();
        }
      });
  }
}
