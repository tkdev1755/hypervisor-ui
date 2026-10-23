import { Component, computed, inject, input, signal } from '@angular/core';

import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { UserPickerComponent } from '@app/components/user-picker/user-picker.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { AdminService } from '@app/services/admin.service';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Autoriser un utilisateur à créer des VM sur un hyperviseur (admin seulement).
 * Se ferme avec `true` si l'accès a été accordé.
 */
@Component({
  selector: 'app-hypervisor-access-modal',
  imports: [ModalShellComponent, RowComponent, ButtonComponent, TextComponent, UserPickerComponent],
  templateUrl: './hypervisor-access-modal.component.html',
  styleUrl: './hypervisor-access-modal.component.scss',
})
export class HypervisorAccessModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly admin = inject(AdminService);

  readonly hypervisorId = input.required<string>();
  /** Les ids qui ont déjà l'accès (on ne les propose pas). */
  readonly alreadyGranted = input<string[]>([]);

  protected readonly userId = signal<string | undefined>(undefined);
  protected readonly submitted = signal(false);
  protected readonly userError = computed(() => (this.submitted() && !this.userId() ? 'Choisissez un utilisateur.' : null));

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.state.set('loading');
    this.admin.grantAccess(this.hypervisorId(), userId).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
