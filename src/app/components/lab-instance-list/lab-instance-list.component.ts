import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, timer } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { Lab, LabInstance, canManageLab } from '@app/models/lab.model';
import { InventoryService } from '@app/services/inventory.service';
import { LabService } from '@app/services/lab.service';
import { ModalService } from '@app/services/modal.service';

/**
 * Les instances d'un labo : les miennes, ou toutes pour ceux qui le gèrent (le propriétaire est alors affiché).
 *
 * Chaque ligne : l'état ('deploying', 'ready', 'failed'), le nombre de VM en marche, et les actions
 * Ouvrir (page de l'instance), Démarrer et Arrêter (toutes les VM d'un coup), Supprimer (VM, disques et
 * réseaux internes). Tant qu'un déploiement est en cours, la liste se recharge toutes les 3 secondes.
 */
@Component({
  selector: 'app-lab-instance-list',
  imports: [ColumnComponent, RowComponent, SpacerComponent, TextComponent, ButtonComponent, ListComponent, ListTileComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent],
  templateUrl: './lab-instance-list.component.html',
  styleUrl: './lab-instance-list.component.scss',
})
export class LabInstanceListComponent implements OnInit, OnDestroy {
  private readonly labs = inject(LabService);
  private readonly modal = inject(ModalService);
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);

  readonly hypervisorId = input.required<string>();
  readonly lab = input.required<Lab>();

  protected readonly list = signal<LabInstance[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  /** L'id de l'instance en cours de démarrage ou d'arrêt (pour afficher son chargement). */
  protected readonly busyId = signal<string | null>(null);

  protected readonly manages = computed(() => canManageLab(this.lab()));

  private pollSub?: Subscription;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetch();
  }

  /** Recharge sans afficher de chargement ; relance dans 3 s si un déploiement est en cours. */
  private fetch(): void {
    this.pollSub?.unsubscribe();
    this.labs.listInstances(this.hypervisorId(), this.lab().id).subscribe({
      next: (instances) => {
        this.list.set(instances);
        this.loading.set(false);
        if (instances.some((instance) => instance.status === 'deploying')) {
          this.pollSub = timer(3000).subscribe(() => this.fetch());
        }
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  /** « alice · 2/3 VM en marche · créée le … ». */
  protected subtitle(instance: LabInstance): string {
    const running = instance.vms.filter((vm) => vm.status === 'running').length;
    const parts = [`${running}/${instance.vms.length} VM en marche`, `créée le ${new Date(instance.created_at * 1000).toLocaleString('fr-FR')}`];
    if (this.manages()) {
      parts.unshift(instance.owner);
    }
    return parts.join(' · ');
  }

  protected open(instance: LabInstance): void {
    this.router.navigate(['/hypervisors', this.hypervisorId(), 'labs', this.lab().id, 'instances', instance.id]);
  }

  /** Démarrer ou arrêter (proprement) toutes les VM : sans confirmation, c'est réversible. */
  protected power(instance: LabInstance, start: boolean): void {
    this.busyId.set(instance.id);
    this.actionError.set(null);
    const request = start
      ? this.labs.startInstance(this.hypervisorId(), this.lab().id, instance.id)
      : this.labs.stopInstance(this.hypervisorId(), this.lab().id, instance.id);
    request.subscribe({
      next: (updated) => {
        this.list.update((instances) => instances.map((i) => (i.id === updated.id ? updated : i)));
        this.busyId.set(null);
        this.inventory.refresh();
      },
      error: (error: AppError) => {
        this.actionError.set(error);
        this.busyId.set(null);
      },
    });
  }

  protected remove(instance: LabInstance): void {
    this.confirm(
      `Supprimer l'instance « ${instance.name} » ?`,
      `Ses ${instance.vms.length} VM, leurs disques et ses réseaux internes seront supprimés. C'est définitif.`,
      () => this.labs.deleteInstance(this.hypervisorId(), this.lab().id, instance.id),
    );
  }

  private confirm(title: string, message: string, action: () => Observable<unknown>): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: { title, message, confirmLabel: 'Supprimer', danger: true, action },
      })
      .afterClosed$.subscribe((done) => {
        if (done) {
          this.inventory.refresh();
          this.load();
        }
      });
  }
}
