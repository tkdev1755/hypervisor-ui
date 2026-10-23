import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Observable, Subscription, interval } from 'rxjs';

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
import { VmDeleteModalComponent } from '@app/components/vm-delete-modal/vm-delete-modal.component';
import { VmFormModalComponent } from '@app/components/vm-form-modal/vm-form-modal.component';
import { AppError } from '@app/models/app-error.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { InventoryService } from '@app/services/inventory.service';
import { ModalService } from '@app/services/modal.service';
import { VmService } from '@app/services/vm.service';

type StatusFilter = 'all' | 'running' | 'stopped';

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

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  protected readonly list = signal<VirtualMachine[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  protected readonly busyId = signal<string | null>(null);

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
        if (!silent) {
          this.error.set(error);
          this.loading.set(false);
        }
      },
    });
  }

  protected describe(vm: VirtualMachine): string {
    const specs = `${vm.vcpus} vCPU · ${Math.round((vm.memory_mb / 1024) * 10) / 10} Go`;
    if (this.isShuttingDown(vm.id)) {
      return `${specs} — Arrêt en cours…`;
    }
    return specs;
  }

  protected isShuttingDown(vmId: string): boolean {
    return this.shuttingDownIds().has(vmId);
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
    this.pollSub = interval(2000).subscribe(() => {
      this.load(true);
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

  private changed(): void {
    this.load();
    this.inventory.refresh();
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
