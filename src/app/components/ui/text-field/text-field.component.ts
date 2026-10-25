import { Component, input, model, output } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { TextComponent } from '../text/text.component';

let nextId = 0;

/**
 * TEXT FIELD — un champ de saisie avec son libellé (comme TextField en Flutter).
 *
 *   readonly name = signal('');                                   // dans le .ts
 *   <app-text-field label="Nom" [(value)]="name" />               // dans le .html
 *
 * [(value)] lie le champ à un signal dans les deux sens : ce que l'utilisateur
 * tape arrive dans name(), et name.set('...') change le texte du champ.
 *
 * - label, placeholder, hint (aide sous le champ), error (message en rouge)
 * - type      : 'text' (par défaut), 'number', 'password', 'email'
 * - monospace : police à chasse fixe (pratique pour des adresses)
 * - rows      : plus de 1 = une zone de texte sur plusieurs lignes (un fichier de configuration, par exemple) ;
 *               Entrée y passe alors à la ligne au lieu d'émettre `enter`
 * - enter     : l'événement émis quand l'utilisateur appuie sur Entrée
 */
@Component({
  selector: 'app-text-field',
  imports: [ColumnComponent, TextComponent],
  templateUrl: './text-field.component.html',
  styleUrl: './text-field.component.scss',
})
export class TextFieldComponent {
  readonly value = model('');
  readonly label = input<string>();
  readonly placeholder = input('');
  readonly hint = input<string>();
  readonly error = input<string | null>(null);
  readonly type = input<'text' | 'number' | 'password' | 'email'>('text');
  readonly monospace = input(false);
  readonly rows = input(1);
  readonly enter = output<void>();

  /** Un identifiant unique, pour relier le libellé au champ. */
  protected readonly id = `text-field-${nextId++}`;

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
