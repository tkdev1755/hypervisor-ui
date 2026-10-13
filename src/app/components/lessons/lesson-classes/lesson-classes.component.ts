import { Component } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';

/** La classe de la leçon, utilisée pour de vrai par la démo. */
class Compteur {
  valeur = 0;

  incrementer(): void {
    this.valeur = this.valeur + 1;
  }

  remettreAZero(): void {
    this.valeur = 0;
  }
}

/** Leçon 4 (TypeScript) : les classes, base de tout composant Angular. */
@Component({
  selector: 'app-lesson-classes',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent],
  templateUrl: './lesson-classes.component.html',
  styleUrl: './lesson-classes.component.scss',
})
export class LessonClassesComponent {
  readonly code = `// Une classe est un modèle pour fabriquer des objets
class Compteur {
  valeur = 0;                        // une propriété : une donnée de l'objet

  incrementer(): void {              // une méthode : une action de l'objet
    this.valeur = this.valeur + 1;   // « this » = l'objet lui-même
  }

  remettreAZero(): void {
    this.valeur = 0;
  }
}

const compteur = new Compteur();     // « new » fabrique un objet
compteur.incrementer();
compteur.incrementer();
compteur.valeur;                     // 2

// Deux mots que vous verrez partout dans ce projet :
class Exemple {
  private secret = 42;     // private : utilisable seulement DANS la classe
  readonly nom = 'web';    // readonly : ne peut plus être réassigné
}`;

  compteur = new Compteur();
}
