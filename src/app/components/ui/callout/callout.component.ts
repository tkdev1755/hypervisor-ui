import { Component, computed, input } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

/**
 * CALLOUT — un encadré pour une remarque, une astuce ou un avertissement.
 *
 *   <app-callout type="tip" title="Astuce">Le texte de l'astuce.</app-callout>
 *
 * - type : 'info' (par défaut), 'tip' (astuce), 'warning' (attention)
 */
@Component({
  selector: 'app-callout',
  imports: [IconComponent],
  templateUrl: './callout.component.html',
  styleUrl: './callout.component.scss',
  host: { '[attr.data-type]': 'type()' },
})
export class CalloutComponent {
  readonly type = input<'info' | 'tip' | 'warning'>('info');
  readonly title = input<string>();

  protected readonly icon = computed<IconName>(() => ({ info: 'info', tip: 'bulb', warning: 'alert' } as const)[this.type()]);
}
