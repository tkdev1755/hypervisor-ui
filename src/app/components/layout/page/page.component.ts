import { Component, input } from '@angular/core';

import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { ColumnComponent } from '../column/column.component';
import { ExpandedComponent } from '../expanded/expanded.component';
import { RowComponent } from '../row/row.component';

/**
 * PAGE — le squelette de chaque page (un peu comme Scaffold en Flutter) :
 * un lien retour facultatif, un titre, une description, des boutons d'action,
 * puis le contenu de la page.
 *
 *   <app-page eyebrow="Infrastructure" title="Hyperviseurs" subtitle="...">
 *     <app-button actions icon="plus" (pressed)="ajouter()">Ajouter</app-button>
 *     ... le contenu de la page ...
 *   </app-page>
 *
 * Le mot « actions » posé sur un bouton le place en haut à droite, à côté du titre.
 */
@Component({
  selector: 'app-page',
  imports: [ColumnComponent, RowComponent, ExpandedComponent, TextComponent, ButtonComponent],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss',
})
export class PageComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly eyebrow = input<string>();
  /** Si renseigné, affiche un lien « retour » vers cette adresse. */
  readonly backLink = input<string>();
  readonly backLabel = input('Retour');
}
