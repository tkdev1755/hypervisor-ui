import { Component, computed, inject, input, signal } from '@angular/core';
import { of, switchMap, throwError, timer } from 'rxjs';

import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Une modale d'exemple pour la leçon 13 : renommer une VM (sans appeler l'API).
 * Elle montre toutes les pièces d'une vraie modale : un input, un champ validé,
 * les quatre états du cadre, et un résultat renvoyé à la fermeture.
 *
 * Le nom « db-01 » est déjà pris : il provoque une erreur 409 fabriquée.
 */
@Component({
  selector: 'app-demo-rename-modal',
  imports: [ModalShellComponent, RowComponent, TextFieldComponent, ButtonComponent],
  templateUrl: './demo-rename-modal.component.html',
  styleUrl: './demo-rename-modal.component.scss',
})
export class DemoRenameModalComponent {
  protected readonly modalRef = inject(ModalRef<string>);

  readonly currentName = input.required<string>();

  protected readonly name = signal('');
  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && !/^[a-z0-9-]+$/.test(this.name()) ? 'Minuscules, chiffres et tirets uniquement.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError()) {
      return;
    }
    this.state.set('loading');
    // Une fausse requête d'une seconde ; « db-01 » est refusé.
    timer(1000)
      .pipe(switchMap(() => (this.name() === 'db-01' ? throwError(() => this.conflit()) : of(this.name()))))
      .subscribe({
        next: () => this.state.set('success'),
        error: (error: unknown) => {
          this.error.set(isAppError(error) ? error : null);
          this.state.set('error');
        },
      });
  }

  private conflit(): AppError {
    return {
      kind: 'business',
      code: 'CONFLICT',
      api: 'hypervisor-api',
      method: 'PATCH',
      endpoint: '/api/demo',
      status: 409,
      title: 'Nom déjà utilisé',
      message: 'Une machine virtuelle porte déjà ce nom. Choisissez-en un autre, puis cliquez sur « Réessayer ».',
    };
  }
}
