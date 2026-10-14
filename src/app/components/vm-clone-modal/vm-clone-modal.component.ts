import { Component, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { JobService } from '@app/services/job.service';
import { ModalRef } from '@app/services/modal-ref';
import { VmService } from '@app/services/vm.service';

/**
 * Cloner une VM arrêtée. L'API répond tout de suite avec une tâche
 * (« job »), puis la copie des disques se fait en arrière-plan : la modale
 * reste en chargement et interroge la tâche jusqu'à sa fin.
 */
@Component({
  selector: 'app-vm-clone-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, ButtonComponent],
  templateUrl: './vm-clone-modal.component.html',
  styleUrl: './vm-clone-modal.component.scss',
})
export class VmCloneModalComponent {
  protected readonly modalRef = inject(ModalRef<VirtualMachine>);
  private readonly vms = inject(VmService);
  private readonly jobs = inject(JobService);

  readonly hypervisorId = input.required<string>();
  readonly source = input.required<VirtualMachine>();

  protected readonly name = signal('');
  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && !/^[a-zA-Z0-9-]+$/.test(this.name()) ? 'Lettres, chiffres et tirets uniquement.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<VirtualMachine | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError()) {
      return;
    }
    this.state.set('loading');
    this.vms.clone(this.hypervisorId(), this.source().id, { name: this.name() }).subscribe({
      next: (job) => this.followJob(job.id),
      error: (error: unknown) => this.fail(error),
    });
  }

  private followJob(jobId: string): void {
    this.jobs.watch(jobId).subscribe({
      next: (job) => {
        if (job.status === 'succeeded') {
          this.result.set(job.result ?? null);
          this.state.set('success');
        } else {
          this.fail(null, job.error);
        }
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown, jobError?: string): void {
    if (isAppError(error)) {
      this.error.set(error);
    } else {
      // La tâche a échoué : on fabrique une erreur à partir de sa raison.
      this.error.set({
        kind: 'technical',
        api: 'hypervisor-api',
        method: 'POST',
        endpoint: 'clone',
        status: 0,
        title: 'Le clonage a échoué',
        message: "L'hyperviseur n'a pas pu copier la machine virtuelle.",
        detail: jobError,
        occurredAt: new Date(),
      });
    }
    this.state.set('error');
  }
}
