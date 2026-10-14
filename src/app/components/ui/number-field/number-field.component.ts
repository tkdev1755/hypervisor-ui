import { Component, computed, input, model } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '../button/button.component';
import { TextComponent } from '../text/text.component';

let nextId = 0;

/**
 * NUMBER FIELD — un nombre à saisir ou à ajuster avec les boutons − et +.
 *
 *   readonly vcpus = signal(2);                                                       // dans le .ts
 *   <app-number-field label="vCPU" [(value)]="vcpus" [min]="1" [max]="8" />          // dans le .html
 *   <app-number-field label="Mémoire" [(value)]="memoire" [min]="256" [max]="16384" [step]="256" unit="Mo" />
 *
 * - min / max : les bornes (les boutons s'arrêtent dessus ; le champ affiche une erreur si on les dépasse en tapant)
 * - step      : le pas des boutons − et +
 * - unit      : l'unité affichée à droite du champ
 * - hint      : une aide sous le champ
 */
@Component({
  selector: 'app-number-field',
  imports: [ColumnComponent, RowComponent, ButtonComponent, TextComponent],
  templateUrl: './number-field.component.html',
  styleUrl: './number-field.component.scss',
})
export class NumberFieldComponent {
  readonly value = model(0);
  readonly label = input<string>();
  readonly min = input(0);
  readonly max = input(Number.MAX_SAFE_INTEGER);
  readonly step = input(1);
  readonly unit = input<string>();
  readonly hint = input<string>();

  protected readonly id = `number-field-${nextId++}`;

  protected readonly error = computed(() => {
    const value = this.value();
    if (!Number.isInteger(value) || value < this.min() || value > this.max()) {
      return `Entre ${this.min()} et ${this.max()}.`;
    }
    return null;
  });

  protected onInput(event: Event): void {
    this.value.set(Number((event.target as HTMLInputElement).value));
  }

  /** Les boutons − et + : on reste entre min et max. */
  protected change(direction: 1 | -1): void {
    const next = this.value() + direction * this.step();
    this.value.set(Math.min(Math.max(next, this.min()), this.max()));
  }
}
