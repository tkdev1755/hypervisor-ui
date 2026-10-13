import { Component, computed, input } from '@angular/core';

/**
 * PADDING — ajoute un espace vide autour de son contenu (comme Padding en Flutter).
 *
 *   <app-padding [all]="16">...</app-padding>                          16 px de chaque côté
 *   <app-padding [horizontal]="24" [vertical]="8">...</app-padding>    24 px à gauche et à droite, 8 en haut et en bas
 *   <app-padding [top]="32">...</app-padding>                          seulement en haut
 *
 * Les valeurs sont en pixels. Le côté le plus précis gagne : top > vertical > all.
 */
@Component({
  selector: 'app-padding',
  templateUrl: './padding.component.html',
  styleUrl: './padding.component.scss',
  host: { '[style.padding]': 'padding()' },
})
export class PaddingComponent {
  readonly all = input<number>();
  readonly horizontal = input<number>();
  readonly vertical = input<number>();
  readonly top = input<number>();
  readonly right = input<number>();
  readonly bottom = input<number>();
  readonly left = input<number>();

  protected readonly padding = computed(() => {
    const top = this.top() ?? this.vertical() ?? this.all() ?? 0;
    const bottom = this.bottom() ?? this.vertical() ?? this.all() ?? 0;
    const left = this.left() ?? this.horizontal() ?? this.all() ?? 0;
    const right = this.right() ?? this.horizontal() ?? this.all() ?? 0;
    return `${top}px ${right}px ${bottom}px ${left}px`;
  });
}
