import { Component, input } from '@angular/core';

/**
 * SIZED BOX — une boîte de taille fixe (comme SizedBox en Flutter).
 *
 *   <app-sized-box [height]="24" />                    un espace vide de 24 px de haut
 *   <app-sized-box [width]="320">...</app-sized-box>   un contenu limité à 320 px de large
 */
@Component({
  selector: 'app-sized-box',
  templateUrl: './sized-box.component.html',
  styleUrl: './sized-box.component.scss',
  host: {
    '[style.width.px]': 'width()',
    '[style.height.px]': 'height()',
  },
})
export class SizedBoxComponent {
  readonly width = input<number | null>(null);
  readonly height = input<number | null>(null);
}
