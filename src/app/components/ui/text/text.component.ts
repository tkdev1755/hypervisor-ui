import { Component, computed, input } from '@angular/core';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'caption' | 'eyebrow' | 'code';
export type TextColor = 'default' | 'muted' | 'subtle' | 'accent' | 'success' | 'warning' | 'danger';

/**
 * TEXT — afficher du texte, avec un style prédéfini (comme Text en Flutter).
 *
 *   <app-text variant="title">Mes hyperviseurs</app-text>
 *   <app-text color="muted">Une phrase d'explication.</app-text>
 *   <app-text variant="small" color="danger">Ce champ est obligatoire.</app-text>
 *
 * - variant : 'display' (titre de page), 'title', 'heading', 'body' (par défaut),
 *             'small', 'caption', 'eyebrow' (petit libellé en majuscules), 'code'
 * - color   : 'default', 'muted', 'subtle', 'accent', 'success', 'warning', 'danger'
 * - weight  : 'regular', 'medium' ou 'bold' (sinon, celui de la variante)
 * - align   : 'start' (par défaut), 'center', 'end'
 * - ellipsis: true pour couper un texte trop long avec « … »
 */
@Component({
  selector: 'app-text',
  templateUrl: './text.component.html',
  styleUrl: './text.component.scss',
  host: {
    '[attr.data-variant]': 'variant()',
    '[attr.data-color]': 'color()',
    '[attr.data-weight]': 'weight()',
    '[attr.data-ellipsis]': 'ellipsis()',
    '[style.text-align]': 'align()',
    '[attr.role]': "level() ? 'heading' : null",
    '[attr.aria-level]': 'level()',
  },
})
export class TextComponent {
  readonly variant = input<TextVariant>('body');
  readonly color = input<TextColor>('default');
  readonly weight = input<'regular' | 'medium' | 'bold' | null>(null);
  readonly align = input<'start' | 'center' | 'end'>('start');
  readonly ellipsis = input(false);

  /** Pour les lecteurs d'écran : les titres sont annoncés comme des titres. */
  protected readonly level = computed(() => ({ display: 1, title: 2, heading: 3 })[this.variant() as string] ?? null);
}
