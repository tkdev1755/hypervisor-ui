import { Component, computed, inject, input, signal } from '@angular/core';

import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { UserPickerComponent } from '@app/components/user-picker/user-picker.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { ModalRef } from '@app/services/modal-ref';
import { VmService } from '@app/services/vm.service';

/**
 * Changer le propriétaire d'une VM (admin seulement). C'est aussi ainsi qu'une VM créée
 * hors de l'API (avec virsh, par exemple) reçoit son propriétaire : sans lui, seuls les admins la voient.
 * Se ferme avec la VM mise à jour.
 */
@Component({
  selector: 'app-vm-owner-modal',
  imports: [ModalShellComponent, RowComponent, ButtonComponent, TextComponent, UserPickerComponent],
  templateUrl: './vm-owner-modal.component.html',
  styleUrl: './vm-owner-modal.component.scss',
})
export class VmOwnerModalComponent {
  protected readonly modalRef = inject(ModalRef<VirtualMachine>);
  private readonly vms = inject(VmService);

  readonly hypervisorId = input.required<string>();
  readonly vm = input.required<VirtualMachine>();

  protected readonly ownerId = signal<string | undefined>(undefined);
  protected readonly submitted = signal(false);
  protected readonly ownerError = computed(() => (this.submitted() && !this.ownerId() ? 'Choisissez un utilisateur.' : null));

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<VirtualMachine | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    const ownerId = this.ownerId();
    if (!ownerId) {
      return;
    }
    this.state.set('loading');
    this.vms.setOwner(this.hypervisorId(), this.vm().id, ownerId).subscribe({
      next: (vm) => {
        this.result.set(vm);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
