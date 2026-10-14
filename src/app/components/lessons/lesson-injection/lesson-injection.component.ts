import { Component, inject } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { ERROR_MAPPERS } from '@app/errors/error-mapper';
import { CONTEXT_DESCRIPTORS } from '@app/services/context-bridge.service';
import { LessonComponent } from '../lesson/lesson.component';

/** Leçon 17 (Avancé) : jetons d'injection, listes de fournisseurs et génériques TypeScript. */
@Component({
  selector: 'app-lesson-injection',
  imports: [LessonComponent, ColumnComponent, TextComponent, InlineCodeComponent, CalloutComponent, ListComponent, ListTileComponent],
  templateUrl: './lesson-injection.component.html',
  styleUrl: './lesson-injection.component.scss',
})
export class LessonInjectionComponent {
  readonly code = `// --- 1. Un jeton + multi: true = une LISTE à laquelle chacun ajoute son élément ---
export const ERROR_MAPPERS = new InjectionToken<ErrorMapper[]>('ERROR_MAPPERS');

export function provideErrorMapper(mapper: Type<ErrorMapper>): Provider {
  return { provide: ERROR_MAPPERS, useClass: mapper, multi: true };
}

// app.config.ts : on ajoute un mapper par API, sans toucher au code de l'intercepteur
providers: [
  provideErrorMapper(HypervisorApiErrorMapper),
  provideErrorMapper(UneAutreApiErrorMapper),
],

// Celui qui en a besoin reçoit la liste complète
const mappers = inject(ERROR_MAPPERS);

// optional: true → pas d'erreur si personne n'a rien fourni
const descripteurs = inject(CONTEXT_DESCRIPTORS, { optional: true }) ?? [];


// --- 2. Les génériques : une fonction qui s'adapte au type qu'on lui donne ---
export interface ContextTypes {
  hypervisor: Hypervisor;
}
export type ContextType = keyof ContextTypes;      // 'hypervisor' (et plus tard 'vm'...)

// K est « l'un des types du catalogue » ; la valeur DOIT correspondre à ce K
prime<K extends ContextType>(type: K, id: string, value: ContextTypes[K]): void

this.bridge.prime('hypervisor', id, hypervisor);   // OK
this.bridge.prime('hypervisor', id, 42);           // ERREUR de compilation
this.bridge.prime('vm', id, hypervisor);           // ERREUR : le type 'vm' n'existe pas`;

  /** Écrit ici car, dans le .html, des accolades seraient interprétées par Angular. */
  readonly objetFournisseur = '{ provide: JETON, useClass: MaClasse, multi: true }';

  /** Tout ce qui a été ajouté au jeton CONTEXT_DESCRIPTORS (une ligne par provideContextDescriptor). */
  readonly descripteurs = (inject(CONTEXT_DESCRIPTORS, { optional: true }) ?? []).map((descripteur) => ({
    type: descripteur.type,
    rechargeable: !!descripteur.fetch,
  }));

  /** Tout ce qui a été ajouté au jeton ERROR_MAPPERS (une ligne par provideErrorMapper). */
  readonly mappers = (inject(ERROR_MAPPERS, { optional: true }) ?? []).map((mapper) => mapper.api);
}
