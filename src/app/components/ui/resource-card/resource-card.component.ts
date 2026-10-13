import { Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

/**
 * RESOURCE CARD — la carte d'une ressource (hyperviseur, disque, réseau) dans
 * une <app-grid> : une icône, un statut, un titre, un sous-titre, une ligne
 * d'information, et des boutons en bas (écrits entre les balises).
 *
 *   <app-resource-card icon="server" title="kvm-local" subtitle="qemu:///system"
 *                      status="connected" [clickable]="true" (tap)="ouvrir()">
 *     <app-button variant="ghost" size="sm" (pressed)="modifier()">Modifier</app-button>
 *   </app-resource-card>
 */
@Component({
  selector: 'app-resource-card',
  imports: [IconComponent, StatusBadgeComponent],
  templateUrl: './resource-card.component.html',
  styleUrl: './resource-card.component.scss',
  host: {
    '[class.is-clickable]': 'clickable()',
    '[attr.role]': "clickable() ? 'button' : null",
    '[attr.tabindex]': 'clickable() ? 0 : null',
    '[attr.aria-label]': "clickable() ? 'Ouvrir ' + title() : null",
    '(click)': 'onTap()',
    '(keydown.enter)': 'onTap()',
  },
})
export class ResourceCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<IconName>('server');
  readonly status = input<string>();
  readonly meta = input<string>();
  readonly clickable = input(false);
  readonly tap = output<void>();

  protected onTap(): void {
    if (this.clickable()) {
      this.tap.emit();
    }
  }
}
