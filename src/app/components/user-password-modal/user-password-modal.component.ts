import { Component, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { User } from '@app/models/user.model';
import { ModalRef } from '@app/services/modal-ref';
import { UserService } from '@app/services/user.service';

/**
 * Réinitialiser le mot de passe de quelqu'un (admin seulement). Il n'y a pas d'e-mail :
 * c'est la seule façon de récupérer un compte. Toutes les sessions de ce compte sont fermées.
 */
@Component({
  selector: 'app-user-password-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, ButtonComponent],
  templateUrl: './user-password-modal.component.html',
  styleUrl: './user-password-modal.component.scss',
})
export class UserPasswordModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly users = inject(UserService);

  readonly user = input.required<User>();

  protected readonly password = signal('');
  protected readonly submitted = signal(false);
  protected readonly passwordError = computed(() =>
    this.submitted() && (this.password().length < 8 || this.password().length > 128) ? 'Entre 8 et 128 caractères.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    if (this.passwordError()) {
      return;
    }
    this.state.set('loading');
    this.users.resetPassword(this.user().id, this.password()).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
