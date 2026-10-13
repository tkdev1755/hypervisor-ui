import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';

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
import { VmFormModalComponent } from '@app/components/vm-form-modal/vm-form-modal.component';
import { AppError } from '@app/models/app-error.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { ModalService } from '@app/services/modal.service';
import { VmService } from '@app/services/vm.service';

/**
 * Les VM d'un hyperviseur : une liste avec démarrage, arrêt et suppression.
 * Tant que l'API répond 501 sur ces routes, la page affiche « Pas encore disponible ».
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
  ],
  templateUrl: './vm-list.component.html',
  styleUrl: './vm-list.component.scss',
})
export class VmListComponent implements OnInit {
  private readonly vms = inject(VmService);
  private readonly modal = inject(ModalService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  protected readonly list = signal<VirtualMachine[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  /** L'id de la VM en cours de démarrage ou d'arrêt (pour afficher son chargement). */
  protected readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.vms.list(this.hypervisorId()).subscribe({
      next: (vms) => {
        this.list.set(vms);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  /** Le sous-titre d'une VM, par exemple « 2 vCPU · 4 Go ». */
  protected describe(vm: VirtualMachine): string {
    return `${vm.vcpus} vCPU · ${Math.round((vm.memory_mb / 1024) * 10) / 10} Go`;
  }

  protected start(vm: VirtualMachine): void {
    this.runAction(vm, this.vms.start(this.hypervisorId(), vm.id));
  }

  protected stop(vm: VirtualMachine): void {
    this.runAction(vm, this.vms.stop(this.hypervisorId(), vm.id));
  }

  protected create(): void {
    this.modal
      .open<VmFormModalComponent, VirtualMachine>(VmFormModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), hypervisorName: this.hypervisorName() },
      })
      .afterClosed$.subscribe((vm) => {
        if (vm) {
          this.load();
        }
      });
  }

  protected remove(vm: VirtualMachine): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Supprimer « ${vm.name} » ?`,
          message: 'La machine virtuelle sera supprimée de l’hyperviseur.',
          confirmLabel: 'Supprimer',
          successMessage: 'VM supprimée.',
          danger: true,
          action: () => this.vms.delete(this.hypervisorId(), vm.id),
        },
      })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.load();
        }
      });
  }

  private runAction(vm: VirtualMachine, request: Observable<unknown>): void {
    this.busyId.set(vm.id);
    this.actionError.set(null);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: AppError) => {
        this.busyId.set(null);
        this.actionError.set(error);
      },
    });
  }
}
