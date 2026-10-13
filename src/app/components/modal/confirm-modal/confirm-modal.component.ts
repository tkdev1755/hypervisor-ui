import { Component, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { ModalRef } from '@app/services/modal-ref';
import { ModalShellComponent, ModalState } from '../modal-shell/modal-shell.component';

/**
 * CONFIRM MODAL — demande confirmation, puis exécute elle-même l'action
 * (avec son chargement et son résultat). Elle se ferme avec `true` si
 * l'action a réussi.
 *
 *   this.modal
 *     .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
 *       size: 'sm',
 *       inputs: {
 *         title: 'Supprimer kvm-local ?',
 *         message: 'Cette action est définitive.',
 *         confirmLabel: 'Supprimer',
 *         danger: true,
 *         action: () => this.hypervisors.delete(id),
 *       },
 *     })
 *     .afterClosed$.subscribe((ok) => { if (ok) this.load(); });
 */
@Component({
  selector: 'app-confirm-modal',
  imports: [ModalShellComponent, RowComponent, ButtonComponent, TextComponent],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.scss',
})
export class ConfirmModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);

  readonly title = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input('Confirmer');
  readonly successMessage = input('C’est fait.');
  readonly danger = input(false);
  /** L'action à exécuter après confirmation : une fonction qui renvoie un Observable. */
  readonly action = input.required<() => Observable<unknown>>();

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected confirm(): void {
    this.state.set('loading');
    this.action()().subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
