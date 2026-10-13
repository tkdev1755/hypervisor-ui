import { Component, input } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

/**
 * EMPTY STATE — ce qu'on affiche quand une liste est vide, avec une action
 * pour la remplir (placée entre les balises).
 *
 *   <app-empty-state icon="server" title="Aucun hyperviseur" message="Ajoutez-en un pour commencer.">
 *     <app-button icon="plus" (pressed)="ajouter()">Ajouter</app-button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>();
  readonly icon = input<IconName>('info');
}
