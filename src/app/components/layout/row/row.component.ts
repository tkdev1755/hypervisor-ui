import { Component, computed, input } from '@angular/core';

import { CrossAlign, MainAlign, toCss } from '@app/utils/layout';

/**
 * ROW — aligne ses enfants de gauche à droite (comme Row en Flutter).
 *
 *   <app-row [gap]="8">
 *     <app-button>Annuler</app-button>
 *     <app-button>Valider</app-button>
 *   </app-row>
 *
 * - gap        : l'espace entre deux enfants, en pixels
 * - crossAlign : la position verticale des enfants : 'center' (par défaut), 'start', 'end', 'stretch'
 * - mainAlign  : la répartition horizontale : 'start' (par défaut), 'center', 'end', 'space-between'
 * - wrap       : true pour passer à la ligne quand il n'y a plus de place
 *
 * Astuce : <app-expanded> prend toute la place restante dans la ligne,
 * <app-spacer /> pousse les éléments suivants tout à droite.
 */
@Component({
  selector: 'app-row',
  templateUrl: './row.component.html',
  styleUrl: './row.component.scss',
  host: {
    '[style.gap.px]': 'gap()',
    '[style.align-items]': 'cssCross()',
    '[style.justify-content]': 'cssMain()',
    '[style.flex-wrap]': "wrap() ? 'wrap' : 'nowrap'",
  },
})
export class RowComponent {
  readonly gap = input(0);
  readonly crossAlign = input<CrossAlign>('center');
  readonly mainAlign = input<MainAlign>('start');
  readonly wrap = input(false);

  protected readonly cssCross = computed(() => toCss(this.crossAlign()));
  protected readonly cssMain = computed(() => toCss(this.mainAlign()));
}
