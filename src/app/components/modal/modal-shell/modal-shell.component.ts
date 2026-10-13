import { A11yModule } from '@angular/cdk/a11y';
import { Component, effect, inject, input, output } from '@angular/core';

import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { IconComponent } from '@app/components/ui/icon/icon.component';
import { AppError } from '@app/models/app-error.model';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Les états d'une modale d'action, dans cet ordre :
 *   'form'    → l'utilisateur remplit le formulaire
 *   'loading' → la requête est partie (impossible de fermer la modale)
 *   'success' → c'est fait
 *   'error'   → c'est raté (« Réessayer » ramène en général au formulaire)
 */
export type ModalState = 'form' | 'loading' | 'success' | 'error';

/**
 * MODAL SHELL — le cadre commun de toutes les modales : titre, croix de
 * fermeture, et affichage automatique des états chargement / succès / erreur.
 * Chaque modale ne fournit que son contenu et ses boutons :
 *
 *   <app-modal-shell title="Ajouter" [state]="state()" [error]="error()" (retry)="state.set('form')">
 *     ... le formulaire ...
 *     <app-row footer [gap]="8"> ... les boutons ... </app-row>
 *   </app-modal-shell>
 *
 * Le mot « footer » place les boutons en bas de la modale.
 */
@Component({
  selector: 'app-modal-shell',
  imports: [A11yModule, ErrorPanelComponent, IconComponent],
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.scss',
})
export class ModalShellComponent {
  protected readonly modalRef = inject(ModalRef);

  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly state = input<ModalState>('form');
  readonly error = input<AppError | null>(null);
  readonly loadingLabel = input('Traitement en cours…');
  readonly successMessage = input('Opération réussie.');

  /** Clic sur « Réessayer » (état error). */
  readonly retry = output<void>();
  /** Clic sur « Terminer » (état success). */
  readonly done = output<void>();

  constructor() {
    // Pendant le chargement, la modale ne peut pas être fermée par erreur.
    effect(() => this.modalRef.closeGuard.set(this.state() === 'loading'));
  }
}
