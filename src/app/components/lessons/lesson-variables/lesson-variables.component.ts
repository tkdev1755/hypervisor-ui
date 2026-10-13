import { Component } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';

/** Leçon 1 (TypeScript) : les variables et les types de base. */
@Component({
  selector: 'app-lesson-variables',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent, ListComponent, ListTileComponent],
  templateUrl: './lesson-variables.component.html',
  styleUrl: './lesson-variables.component.scss',
})
export class LessonVariablesComponent {
  readonly code = `// « let » : une variable dont la valeur peut changer
let nom: string = 'web-01';
nom = 'web-02';                 // ✅ autorisé

// « const » : une constante, sa valeur ne change plus
const memoireGo: number = 4;
// memoireGo = 8;               // ❌ erreur : une const ne se réassigne pas

const allumee: boolean = true;

// TypeScript vérifie les types AVANT de lancer le programme :
// let cpu: number = 'deux';    // ❌ erreur : 'deux' n'est pas un number

// Le type peut aussi être deviné : total est un number
const total = memoireGo * 2;`;

  // Les mêmes variables, affichées dans la démo (ce sont des propriétés de la classe).
  nom: string = 'web-01';
  memoireGo: number = 4;
  allumee: boolean = true;

  changerNom(): void {
    this.nom = this.nom === 'web-01' ? 'web-02' : 'web-01';
  }
}
