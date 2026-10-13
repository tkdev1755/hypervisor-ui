import { Component, computed, input } from '@angular/core';

/**
 * GRID — range ses enfants en grille, avec autant de colonnes que la largeur
 * le permet (pratique pour des cartes).
 *
 *   <app-grid [minItemWidth]="280" [gap]="16">
 *     <app-card>...</app-card>
 *     <app-card>...</app-card>
 *   </app-grid>
 *
 * - minItemWidth : la largeur minimale d'une case, en pixels (260 par défaut)
 * - gap          : l'espace entre les cases, en pixels (16 par défaut)
 */
@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
  host: {
    '[style.gap.px]': 'gap()',
    '[style.grid-template-columns]': 'columns()',
  },
})
export class GridComponent {
  readonly minItemWidth = input(260);
  readonly gap = input(16);

  protected readonly columns = computed(() => `repeat(auto-fill, minmax(${this.minItemWidth()}px, 1fr))`);
}
