import { Component } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';

type Statut = 'allumee' | 'eteinte';

/** Leçon 3 (TypeScript) : les fonctions, les fonctions fléchées et les types union. */
@Component({
  selector: 'app-lesson-functions',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, ButtonComponent],
  templateUrl: './lesson-functions.component.html',
  styleUrl: './lesson-functions.component.scss',
})
export class LessonFunctionsComponent {
  readonly code = `// Une fonction : des paramètres typés, et le type de ce qu'elle renvoie
function enGo(memoireMo: number): number {
  return memoireMo / 1024;
}
enGo(4096);                       // 4

// La même chose en « fonction fléchée » (très utilisée en Angular)
const enGoBis = (memoireMo: number): number => memoireMo / 1024;

// Un type union : seulement ces valeurs-là sont acceptées
type Statut = 'allumee' | 'eteinte';

function libelle(statut: Statut): string {
  if (statut === 'allumee') {     // === compare deux valeurs
    return 'En marche';
  }
  return 'Arrêtée';
}
libelle('allumee');               // 'En marche'
// libelle('cassee');             // ❌ erreur : ce n'est pas un Statut

// Entre accents graves, \${...} insère une valeur dans le texte
const resume = \`web-01 : \${enGo(4096)} Go\`;   // 'web-01 : 4 Go'`;

  memoireMo = 4096;
  statut: Statut = 'allumee';

  // Les fonctions de la leçon, utilisées par la démo.
  enGo(memoireMo: number): number {
    return memoireMo / 1024;
  }

  libelle(statut: Statut): string {
    if (statut === 'allumee') {
      return 'En marche';
    }
    return 'Arrêtée';
  }

  basculerStatut(): void {
    this.statut = this.statut === 'allumee' ? 'eteinte' : 'allumee';
  }
}
