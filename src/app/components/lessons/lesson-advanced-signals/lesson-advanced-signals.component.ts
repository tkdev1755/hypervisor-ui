import { Component, computed, effect, linkedSignal, signal, untracked } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { NumberFieldComponent } from '@app/components/ui/number-field/number-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';

type Pool = 'ssd' | 'hdd';

/** Valeurs d'exemple, en Go. */
const TAILLE_PAR_DEFAUT: Record<Pool, number> = { ssd: 40, hdd: 100 };
const CAPACITE: Record<Pool, number> = { ssd: 200, hdd: 1000 };

/** Leçon 15 (Avancé) : computed, linkedSignal et effect. */
@Component({
  selector: 'app-lesson-advanced-signals',
  imports: [
    LessonComponent,
    ColumnComponent,
    TextComponent,
    InlineCodeComponent,
    CalloutComponent,
    ChoiceCardsComponent,
    NumberFieldComponent,
  ],
  templateUrl: './lesson-advanced-signals.component.html',
  styleUrl: './lesson-advanced-signals.component.scss',
})
export class LessonAdvancedSignalsComponent {
  readonly code = `const TAILLE_PAR_DEFAUT = { ssd: 40, hdd: 100 };
const CAPACITE = { ssd: 200, hdd: 1000 };

pool = signal<Pool>('ssd');                    // une valeur choisie par l'utilisateur

// computed : une valeur DÉRIVÉE. En lecture seule, recalculée seulement si
// ses dépendances changent, et mémorisée entre-temps.
capacite = computed(() => CAPACITE[this.pool()]);
restant = computed(() => this.capacite() - this.taille());

// linkedSignal : dérivée ET modifiable. Elle se RÉINITIALISE quand pool change,
// mais l'utilisateur peut la modifier entre-temps avec set() ou [(value)].
taille = linkedSignal(() => TAILLE_PAR_DEFAUT[this.pool()]);

historique = signal<string[]>([]);

constructor() {
  // effect : un EFFET DE BORD (journal, stockage, appel à une librairie...).
  // Il s'exécute une fois, puis à chaque changement d'un signal qu'il lit.
  effect(() => {
    const ligne = this.pool() + ' / ' + this.taille() + ' Go';   // ces deux lectures sont suivies
    untracked(() => {                                            // celle-ci ne doit PAS l'être
      this.historique.update((lignes) => [...lignes, ligne].slice(-5));
    });
  });
}`;

  readonly choix: Choice<Pool>[] = [
    { value: 'ssd', label: 'SSD', description: '200 Go' },
    { value: 'hdd', label: 'HDD', description: '1 000 Go' },
  ];

  readonly pool = signal<Pool>('ssd');
  readonly capacite = computed(() => CAPACITE[this.pool()]);
  readonly taille = linkedSignal(() => TAILLE_PAR_DEFAUT[this.pool()]);
  readonly restant = computed(() => this.capacite() - this.taille());

  readonly historique = signal<string[]>([]);

  constructor() {
    effect(() => {
      const ligne = this.pool() + ' / ' + this.taille() + ' Go';
      untracked(() => {
        this.historique.update((lignes) => [...lignes, ligne].slice(-5));
      });
    });
  }
}
