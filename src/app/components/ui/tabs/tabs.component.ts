import { Component, input, model } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

/** Un onglet : son identifiant, son texte et une icône facultative. */
export interface Tab<T extends string = string> {
  id: T;
  label: string;
  icon?: IconName;
}

/**
 * TABS — des onglets (comme TabBar en Flutter).
 *
 *   readonly onglet = signal<'vms' | 'disques'>('vms');
 *   <app-tabs [tabs]="onglets" [(active)]="onglet" />
 *   @switch (onglet()) { @case ('vms') { ... } @case ('disques') { ... } }
 */
@Component({
  selector: 'app-tabs',
  imports: [IconComponent],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
})
export class TabsComponent<T extends string> {
  readonly tabs = input.required<Tab<T>[]>();
  readonly active = model.required<T>();
}
