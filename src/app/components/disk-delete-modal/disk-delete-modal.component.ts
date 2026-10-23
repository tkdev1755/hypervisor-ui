import { Component, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Disk } from '@app/models/disk.model';
import { InfrastructureService } from '@app/services/infrastructure.service';
import { ModalRef } from '@app/services/modal-ref';

/** Supprimer un disque. Se ferme avec `true` lorsque la suppression a réussi. */
@Component({
  selector: 'app-disk-delete-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, TextComponent],
  templateUrl: './disk-delete-modal.component.html',
  styleUrl: './disk-delete-modal.component.scss',
})
export class DiskDeleteModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly infrastructure = inject(InfrastructureService);

  readonly hypervisorId = input.required<string>();
  readonly disk = input.required<Disk>();

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected confirm(): void {
    this.state.set('loading');
    this.infrastructure.deleteDisk(this.hypervisorId(), this.disk().id).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}