import { Component, computed, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';

/** Leçon 6 (Angular) : afficher des données, réagir aux clics, les signals. */
@Component({
  selector: 'app-lesson-signals',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent],
  templateUrl: './lesson-signals.component.html',
  styleUrl: './lesson-signals.component.scss',
})
export class LessonSignalsComponent {
  readonly code = `// --- Le .ts ---
compteur = signal(0);                           // une valeur qui prévient quand elle change
double = computed(() => this.compteur() * 2);   // recalculé tout seul

ajouter(): void {
  this.compteur.update((valeur) => valeur + 1); // update : à partir de l'ancienne valeur
}

remettreAZero(): void {
  this.compteur.set(0);                         // set : une nouvelle valeur
}

<!-- --- Le .html --- -->
<!-- {{ }} affiche une valeur ; on LIT un signal avec () -->
<app-text>Compteur : {{ compteur() }}</app-text>
<app-text>Double : {{ double() }}</app-text>

<!-- (pressed)="..." : réagir à un clic -->
<app-button (pressed)="ajouter()">+1</app-button>

<!-- [disabled]="..." : passer une valeur au composant -->
<app-button [disabled]="compteur() === 0" (pressed)="remettreAZero()">Zéro</app-button>`;

  /** Écrites ici car, dans le .html, des accolades doubles seraient interprétées par Angular. */
  accolades = '{{ valeur }}';

  compteur = signal(0);
  double = computed(() => this.compteur() * 2);

  ajouter(): void {
    this.compteur.update((valeur) => valeur + 1);
  }

  remettreAZero(): void {
    this.compteur.set(0);
  }
}
