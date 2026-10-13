import { Component, computed, input } from '@angular/core';

import { CrossAlign, MainAlign, toCss } from '@app/utils/layout';

/**
 * COLUMN — empile ses enfants de haut en bas (comme Column en Flutter).
 *
 *   <app-column [gap]="16">
 *     <app-text>Premier</app-text>
 *     <app-text>Second</app-text>
 *   </app-column>
 *
 * - gap        : l'espace entre deux enfants, en pixels (0 par défaut)
 * - crossAlign : la position des enfants en largeur :
 *                'stretch' (toute la largeur, par défaut), 'start', 'center', 'end'
 * - mainAlign  : la répartition des enfants en hauteur :
 *                'start' (par défaut), 'center', 'end', 'space-between'
 */
@Component({
  selector: 'app-column',
  templateUrl: './column.component.html',
  styleUrl: './column.component.scss',
  host: {
    '[style.gap.px]': 'gap()',
    '[style.align-items]': 'cssCross()',
    '[style.justify-content]': 'cssMain()',
  },
})
export class ColumnComponent {
  readonly gap = input(0);
  readonly crossAlign = input<CrossAlign>('stretch');
  readonly mainAlign = input<MainAlign>('start');

  protected readonly cssCross = computed(() => toCss(this.crossAlign()));
  protected readonly cssMain = computed(() => toCss(this.mainAlign()));
}
