import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';

/**
 * BUTTON — un bouton (comme ElevatedButton / TextButton en Flutter).
 *
 *   <app-button (pressed)="enregistrer()">Enregistrer</app-button>
 *   <app-button variant="ghost" icon="refresh" (pressed)="recharger()">Actualiser</app-button>
 *   <app-button variant="danger" [loading]="enCours()">Supprimer</app-button>
 *   <app-button to="/hypervisors">Voir les hyperviseurs</app-button>     un lien vers une page
 *
 * - variant  : 'primary' (par défaut), 'secondary', 'ghost' (discret), 'danger', 'danger-ghost'
 * - size     : 'md' (par défaut) ou 'sm'
 * - icon     : le nom d'une icône à afficher avant le texte
 * - loading  : affiche un indicateur de chargement et désactive le bouton
 * - disabled : grise le bouton
 * - to       : transforme le bouton en lien vers une page de l'application
 * - fullWidth: le bouton prend toute la largeur
 * - pressed  : l'événement émis au clic
 */
@Component({
  selector: 'app-button',
  imports: [IconComponent, RouterLink, NgTemplateOutlet],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  host: { '[class.is-full]': 'fullWidth()' },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<'sm' | 'md'>('md');
  readonly icon = input<IconName | null>(null);
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly to = input<string | (string | number)[] | null>(null);
  readonly fullWidth = input(false);
  readonly pressed = output<void>();

  protected readonly iconSize = computed(() => (this.size() === 'sm' ? 14 : 16));

  protected readonly classes = computed(() => {
    const variants: Record<ButtonVariant, string> = {
      primary: 'btn-primary',
      secondary: 'btn-outline-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
      'danger-ghost': 'btn-ghost text-danger',
    };
    return ['btn', variants[this.variant()], this.size() === 'sm' ? 'btn-sm' : '', this.fullWidth() ? 'w-100' : ''].join(' ');
  });

  protected onClick(event: Event): void {
    // Le clic ne « traverse » pas le bouton : utile dans une carte cliquable.
    event.stopPropagation();
    if (!this.disabled() && !this.loading()) {
      this.pressed.emit();
    }
  }
}
