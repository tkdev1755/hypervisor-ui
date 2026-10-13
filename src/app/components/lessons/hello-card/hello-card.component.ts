import { Component } from '@angular/core';

import { CardComponent } from '@app/components/layout/card/card.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { IconComponent } from '@app/components/ui/icon/icon.component';
import { TextComponent } from '@app/components/ui/text/text.component';

/**
 * Le plus petit composant possible, utilisé par la leçon 5.
 * Il s'affiche partout où l'on écrit <app-hello-card />.
 */
@Component({
  selector: 'app-hello-card',
  imports: [CardComponent, RowComponent, IconComponent, TextComponent],
  templateUrl: './hello-card.component.html',
  styleUrl: './hello-card.component.scss',
})
export class HelloCardComponent {
  prenom = 'Ada';
}
