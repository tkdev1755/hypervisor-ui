import { Component, inject, signal } from '@angular/core';
import { Observable, switchMap, throwError, timer } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { ModalService } from '@app/services/modal.service';
import { LessonComponent } from '../lesson/lesson.component';

/** Une erreur métier fabriquée pour la démonstration (aucun appel réseau). */
const ERREUR_DEMO: AppError = {
  kind: 'business',
  code: 'CONFLICT',
  api: 'hypervisor-api',
  method: 'DELETE',
  endpoint: '/api/demo',
  status: 409,
  title: 'Action impossible',
  message: "Cette machine virtuelle est en cours d'utilisation. (Erreur fabriquée pour la leçon.)",
};

/** Leçon 12 (Avancé) : ouvrir une modale et récupérer son résultat. */
@Component({
  selector: 'app-lesson-modals',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent],
  templateUrl: './lesson-modals.component.html',
  styleUrl: './lesson-modals.component.scss',
})
export class LessonModalsComponent {
  private readonly modal = inject(ModalService);

  readonly code = `// 1. Ouvrir : le composant, ses inputs, et le type du résultat
private readonly modal = inject(ModalService);

supprimer(): void {
  this.modal
    .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
      size: 'sm',                              // 'sm' | 'md' | 'lg' | 'screen'
      inputs: {                                // vérifiés par TypeScript !
        title: 'Supprimer web-01 ?',
        confirmLabel: 'Supprimer',
        danger: true,
        action: () => this.vms.delete(id),     // une FONCTION qui renvoie un Observable
      },
    })
    .afterClosed$.subscribe((ok) => {          // émis UNE fois, à la fermeture
      if (ok) {
        this.load();                           // recharger la liste
      }
    });
}

// 2. Ce que vaut le résultat selon la façon de fermer
//    true       l'action a réussi, puis « Terminer »
//    false      le bouton « Annuler »
//    undefined  la croix, Échap, un clic à côté, ou « Fermer » après une erreur`;

  readonly resultat = signal('Aucune modale ouverte pour l’instant.');

  /** Une confirmation dont l'action réussit au bout d'1,2 seconde. */
  supprimer(): void {
    this.ouvrir(() => timer(1200));
  }

  /** La même, mais l'action échoue : la modale passe à l'état « error ». */
  supprimerEnEchec(): void {
    this.ouvrir(() => timer(1200).pipe(switchMap(() => throwError(() => ERREUR_DEMO))));
  }

  private ouvrir(action: () => Observable<unknown>): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: 'Supprimer web-01 ?',
          message: "Démonstration : rien n'est réellement supprimé.",
          confirmLabel: 'Supprimer',
          successMessage: 'Machine supprimée (pour de faux).',
          danger: true,
          action,
        },
      })
      .afterClosed$.subscribe((ok) => {
        if (ok === true) {
          this.resultat.set('true : l’action a réussi.');
        } else if (ok === false) {
          this.resultat.set('false : l’utilisateur a cliqué sur « Annuler ».');
        } else {
          this.resultat.set('undefined : fermée sans résultat (croix, Échap, clic à côté, ou « Fermer »).');
        }
      });
  }
}
