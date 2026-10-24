import { Component, computed, inject, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { AuthService } from '@app/services/auth.service';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Changer SON mot de passe (il faut saisir l'ancien). L'API ferme ensuite toutes les sessions du compte :
 * AuthService.changePassword reconnecte aussitôt l'utilisateur avec le nouveau mot de passe.
 */
@Component({
  selector: 'app-password-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, ButtonComponent],
  templateUrl: './password-form-modal.component.html',
  styleUrl: './password-form-modal.component.scss',
})
export class PasswordFormModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly auth = inject(AuthService);

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirmation = signal('');

  protected readonly submitted = signal(false);
  protected readonly currentError = computed(() => (this.submitted() && this.current() === '' ? 'Saisissez votre mot de passe actuel.' : null));
  protected readonly nextError = computed(() =>
    this.submitted() && (this.next().length < 8 || this.next().length > 128) ? 'Entre 8 et 128 caractères.' : null,
  );
  protected readonly confirmationError = computed(() =>
    this.submitted() && this.confirmation() !== this.next() ? 'Les deux mots de passe sont différents.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    if (this.currentError() || this.nextError() || this.confirmationError()) {
      return;
    }
    this.state.set('loading');
    this.auth.changePassword({ current_password: this.current(), new_password: this.next() }).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
