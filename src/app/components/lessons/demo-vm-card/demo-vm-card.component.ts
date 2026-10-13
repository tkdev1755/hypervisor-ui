import { Component, input, output } from '@angular/core';

import { CardComponent } from '@app/components/layout/card/card.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { IconComponent } from '@app/components/ui/icon/icon.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { TextComponent } from '@app/components/ui/text/text.component';

/** Une VM de démonstration (leçon 8). */
export interface DemoVm {
  nom: string;
  allumee: boolean;
}

/**
 * Un composant ENFANT, utilisé par la leçon 8.
 *  - input()  : la VM arrive du parent      → <app-demo-vm-card [vm]="vm" />
 *  - output() : le clic remonte au parent   → (basculer)="basculer($event)"
 * L'enfant ne modifie jamais la VM lui-même : il prévient le parent, qui décide.
 */
@Component({
  selector: 'app-demo-vm-card',
  imports: [CardComponent, RowComponent, SpacerComponent, IconComponent, TextComponent, StatusBadgeComponent, ButtonComponent],
  templateUrl: './demo-vm-card.component.html',
  styleUrl: './demo-vm-card.component.scss',
})
export class DemoVmCardComponent {
  readonly vm = input.required<DemoVm>();
  readonly basculer = output<string>();
}
