import { Component, computed, inject, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Role, User } from '@app/models/user.model';
import { ModalRef } from '@app/services/modal-ref';
import { UserService } from '@app/services/user.service';

/** Créer un compte (admin seulement). Se ferme avec l'utilisateur créé. */
@Component({
  selector: 'app-user-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, ButtonComponent, ChoiceCardsComponent],
  templateUrl: './user-form-modal.component.html',
  styleUrl: './user-form-modal.component.scss',
})
export class UserFormModalComponent {
  protected readonly modalRef = inject(ModalRef<User>);
  private readonly users = inject(UserService);

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly role = signal<Role>('user');
  protected readonly roles: Choice<Role>[] = [
    { value: 'user', label: 'Utilisateur', description: 'Ses VM et celles qu’on lui prête' },
    { value: 'admin', label: 'Administrateur', description: 'Gère tout' },
  ];

  // Les mêmes règles que l'API : nom de 3 à 32 caractères, mot de passe de 8 à 128.
  protected readonly submitted = signal(false);
  protected readonly usernameError = computed(() =>
    this.submitted() && !/^[a-zA-Z0-9._-]{3,32}$/.test(this.username()) ? '3 à 32 caractères : lettres, chiffres, point, tiret et tiret bas.' : null,
  );
  protected readonly passwordError = computed(() =>
    this.submitted() && (this.password().length < 8 || this.password().length > 128) ? 'Entre 8 et 128 caractères.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<User | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    if (this.usernameError() || this.passwordError()) {
      return;
    }
    this.state.set('loading');
    this.users.create({ username: this.username(), password: this.password(), role: this.role() }).subscribe({
      next: (user) => {
        this.result.set(user);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
