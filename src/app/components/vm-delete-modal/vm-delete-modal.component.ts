import { Component, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { ModalRef } from '@app/services/modal-ref';
import { VmService } from '@app/services/vm.service';

/** Supprimer une VM arrêtée, en gardant ou en supprimant ses disques. Se ferme avec `true`. */
@Component({
  selector: 'app-vm-delete-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, ChoiceCardsComponent],
  templateUrl: './vm-delete-modal.component.html',
  styleUrl: './vm-delete-modal.component.scss',
})
export class VmDeleteModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly vms = inject(VmService);

  readonly hypervisorId = input.required<string>();
  readonly vm = input.required<VirtualMachine>();

  protected readonly deleteDisks = signal(false);
  protected readonly choices: Choice<boolean>[] = [
    { value: false, label: 'Garder les disques', description: 'Seule la VM est supprimée' },
    { value: true, label: 'Supprimer les disques', description: 'Définitif' },
  ];

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected confirm(): void {
    this.state.set('loading');
    this.vms.delete(this.hypervisorId(), this.vm().id, this.deleteDisks()).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
