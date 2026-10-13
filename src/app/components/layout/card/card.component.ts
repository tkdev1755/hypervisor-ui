import { Component, input, output } from '@angular/core';

/**
 * CARD — un bloc blanc avec bordure et coins arrondis (comme Card en Flutter).
 *
 *   <app-card>...</app-card>
 *   <app-card [padding]="24">...</app-card>
 *   <app-card [clickable]="true" (tap)="ouvrir()">...</app-card>    toute la carte est cliquable
 *
 * - padding   : l'espace intérieur, en pixels (20 par défaut)
 * - clickable : la carte réagit au survol et au clic
 * - tap       : l'événement émis au clic (ou avec la touche Entrée)
 */
@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  host: {
    '[style.padding.px]': 'padding()',
    '[class.is-clickable]': 'clickable()',
    '[attr.role]': "clickable() ? 'button' : null",
    '[attr.tabindex]': 'clickable() ? 0 : null',
    '(click)': 'onTap()',
    '(keydown.enter)': 'onTap()',
  },
})
export class CardComponent {
  readonly padding = input(20);
  readonly clickable = input(false);
  readonly tap = output<void>();

  protected onTap(): void {
    if (this.clickable()) {
      this.tap.emit();
    }
  }
}
