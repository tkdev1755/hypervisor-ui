import { Component, input } from '@angular/core';

/**
 * DIVIDER — un trait horizontal de séparation (comme Divider en Flutter).
 *
 *   <app-divider />
 *   <app-divider [spacing]="16" />     avec 16 px de vide au-dessus et en dessous
 */
@Component({
  selector: 'app-divider',
  templateUrl: './divider.component.html',
  styleUrl: './divider.component.scss',
  host: { '[style.margin-block.px]': 'spacing()' },
})
export class DividerComponent {
  readonly spacing = input(0);
}
