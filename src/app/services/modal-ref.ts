import { signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * La « télécommande » d'une modale ouverte.
 *
 * - La modale la récupère avec inject(ModalRef) et se ferme avec
 *   this.modalRef.close(resultat).
 * - Celui qui a ouvert la modale écoute le résultat :
 *   this.modal.open(MaModale).afterClosed$.subscribe((resultat) => ...)
 *   resultat vaut undefined si l'utilisateur a annulé.
 */
export class ModalRef<R = unknown> {
  private readonly closedSubject = new Subject<R | undefined>();
  private closing = false;
  private onClose: (done: () => void) => void = (done) => done();

  /** Émet une seule fois, à la fermeture. */
  readonly afterClosed$: Observable<R | undefined> = this.closedSubject.asObservable();

  /** true pendant un chargement : l'utilisateur ne peut pas fermer la modale. Géré par ModalShellComponent. */
  readonly closeGuard = signal(false);

  /** Ferme la modale par le code : toujours autorisé. */
  close(result?: R): void {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.onClose(() => {
      this.closedSubject.next(result);
      this.closedSubject.complete();
    });
  }

  /** Demande de l'utilisateur (croix, Échap, clic à côté) : ignorée pendant un chargement. */
  requestClose(): void {
    if (!this.closeGuard()) {
      this.close();
    }
  }

  /** @internal Réservé à ModalService. */
  setCloseHandler(handler: (done: () => void) => void): void {
    this.onClose = handler;
  }
}
