import { Component, computed, input } from '@angular/core';

import { ICONS, IconName } from './icons';

/**
 * ICON — une icône (la liste des noms est dans icons.ts).
 *
 *   <app-icon name="server" />
 *   <app-icon name="plus" [size]="20" />
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(16);

  protected readonly paths = computed(() => ICONS[this.name()]);
}
