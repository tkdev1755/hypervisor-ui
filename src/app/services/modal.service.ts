import { createBlockScrollStrategy, createGlobalPositionStrategy, createOverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Injectable, Injector, InputSignalWithTransform, Type, inject } from '@angular/core';
import { filter } from 'rxjs';

import { ModalRef } from './modal-ref';

/**
 * Les entrées d'un composant, déduites de ses input(). Si ConfirmModalComponent
 * déclare `title = input.required<string>()`, alors
 * open(ConfirmModalComponent, { inputs: { title: 'Supprimer ?' } }) est vérifié par TypeScript.
 */
export type InputsOf<C> = {
  [K in keyof C as C[K] extends InputSignalWithTransform<unknown, unknown> ? K : never]?: C[K] extends InputSignalWithTransform<
    unknown,
    infer Write
  >
    ? Write
    : never;
};

/** 'screen' : 80 % de la largeur et 95 % de la hauteur de l'écran (pour la console VNC). */
export type ModalSize = 'sm' | 'md' | 'lg' | 'screen';

export interface ModalOptions<C> {
  inputs?: InputsOf<C>;
  size?: ModalSize;
}

const WIDTHS: Record<ModalSize, string> = { sm: '420px', md: '560px', lg: '760px', screen: '80vw' };
const CLOSE_ANIMATION_MS = 180;

/**
 * Ouvre un composant dans une modale (avec le CDK Overlay d'Angular).
 *
 *   this.modal.open<MaModaleComponent, Resultat>(MaModaleComponent, { inputs: { ... } })
 *     .afterClosed$.subscribe((resultat) => { if (resultat) this.load(); });
 *
 * Une seule modale à la fois : en ouvrir une ferme la précédente.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly injector = inject(Injector);
  private current: ModalRef<unknown> | null = null;

  open<C, R = unknown>(component: Type<C>, options: ModalOptions<C> = {}): ModalRef<R> {
    this.current?.close();
    const screen = options.size === 'screen';

    const overlayRef = createOverlayRef(this.injector, {
      hasBackdrop: true,
      backdropClass: 'app-modal-backdrop',
      panelClass: 'app-modal-panel',
      width: WIDTHS[options.size ?? 'md'],
      maxWidth: 'calc(100vw - 32px)',
      // Les modales normales sont limitées à la hauteur de l'écran (leur corps défile) ;
      // la modale 'screen' a une hauteur fixe.
      ...(screen ? { height: '95vh' } : { maxHeight: 'calc(88vh - 16px)' }),
      positionStrategy: createGlobalPositionStrategy(this.injector)
        .centerHorizontally()
        .top(screen ? '2.5vh' : '12vh'),
      scrollStrategy: createBlockScrollStrategy(this.injector),
    });

    const modalRef = new ModalRef<R>();
    modalRef.setCloseHandler((done) => {
      overlayRef.overlayElement.classList.add('is-closing');
      overlayRef.backdropElement?.classList.add('is-closing');
      setTimeout(() => {
        overlayRef.dispose();
        if (this.current === modalRef) {
          this.current = null;
        }
        done();
      }, CLOSE_ANIMATION_MS);
    });

    // Un injecteur dédié : c'est ce qui rend ModalRef injectable dans la modale.
    const modalInjector = Injector.create({ parent: this.injector, providers: [{ provide: ModalRef, useValue: modalRef }] });
    const componentRef = overlayRef.attach(new ComponentPortal(component, null, modalInjector));
    for (const [name, value] of Object.entries(options.inputs ?? {})) {
      componentRef.setInput(name, value);
    }

    overlayRef.backdropClick().subscribe(() => modalRef.requestClose());
    overlayRef
      .keydownEvents()
      .pipe(filter((event) => event.key === 'Escape'))
      .subscribe(() => modalRef.requestClose());

    this.current = modalRef as ModalRef<unknown>;
    return modalRef;
  }
}
