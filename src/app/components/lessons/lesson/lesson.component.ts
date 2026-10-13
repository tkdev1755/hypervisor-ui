import { Component, input } from '@angular/core';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { CodeBlockComponent } from '@app/components/ui/code-block/code-block.component';
import { TextComponent } from '@app/components/ui/text/text.component';

/**
 * LESSON — le cadre d'une leçon : un numéro, un titre, l'explication, puis le
 * code à gauche et son résultat en direct à droite.
 *
 *   <app-lesson [number]="1" title="Les variables" [code]="code">
 *     ... l'explication ...
 *     <app-column demo> ... le résultat en direct ... </app-column>
 *   </app-lesson>
 *
 * Le mot « demo » place un élément dans la zone « Résultat ».
 */
@Component({
  selector: 'app-lesson',
  imports: [CardComponent, ColumnComponent, GridComponent, TextComponent, CodeBlockComponent],
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.scss',
})
export class LessonComponent {
  readonly number = input.required<number>();
  readonly title = input.required<string>();
  readonly code = input.required<string>();
  readonly codeTitle = input('exemple.ts');
}
