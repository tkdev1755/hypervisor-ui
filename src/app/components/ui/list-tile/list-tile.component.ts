import { Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

/**
 * LIST TILE — une ligne de liste : une icône, un titre, un sous-titre, un
 * statut, et des boutons à droite (comme ListTile en Flutter).
 *
 *   <app-list-tile icon="cpu" title="web-01" subtitle="2 vCPU · 4 Go" status="running">
 *     <app-button variant="ghost" size="sm" icon="stop" (pressed)="arreter()">Arrêter</app-button>
 *   </app-list-tile>
 *
 * Ce qui est écrit entre les balises (ici le bouton) s'affiche à droite.
 */
@Component({
  selector: 'app-list-tile',
  imports: [IconComponent, StatusBadgeComponent],
  templateUrl: './list-tile.component.html',
  styleUrl: './list-tile.component.scss',
  host: {
    '[class.is-clickable]': 'clickable()',
    '[attr.role]': "clickable() ? 'button' : null",
    '[attr.tabindex]': 'clickable() ? 0 : null',
    '(click)': 'onTap()',
    '(keydown.enter)': 'onKeydown($event)',
  },
})
export class ListTileComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<IconName>();
  readonly status = input<string>();
  readonly clickable = input(false);
  readonly tap = output<void>();

  protected onTap(): void {
    if (this.clickable()) {
      this.tap.emit();
    }
  }

  protected onKeydown(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onTap();
    }
  }
}
