import { Component, computed, input } from '@angular/core';

/**
 * EXPANDED — dans une <app-row> ou une <app-column>, prend toute la place
 * restante (comme Expanded en Flutter).
 *
 *   <app-row>
 *     <app-expanded><app-text>Prend toute la largeur restante</app-text></app-expanded>
 *     <app-button>Action</app-button>
 *   </app-row>
 *
 * - flex : la part de place prise quand il y a plusieurs <app-expanded> (1 par défaut).
 */
@Component({
  selector: 'app-expanded',
  templateUrl: './expanded.component.html',
  styleUrl: './expanded.component.scss',
  host: { '[style.flex]': 'cssFlex()' },
})
export class ExpandedComponent {
  readonly flex = input(1);

  protected readonly cssFlex = computed(() => `${this.flex()} 1 0%`);
}
