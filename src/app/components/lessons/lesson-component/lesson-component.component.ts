import { Component } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';
import { HelloCardComponent } from '../hello-card/hello-card.component';

/** Leçon 5 (Angular) : qu'est-ce qu'un composant ? */
@Component({
  selector: 'app-lesson-component',
  imports: [LessonComponent, ColumnComponent, TextComponent, InlineCodeComponent, CalloutComponent, HelloCardComponent],
  templateUrl: './lesson-component.component.html',
  styleUrl: './lesson-component.component.scss',
})
export class LessonComponentComponent {
  readonly code = `// hello-card.component.ts : la logique (une classe)
import { Component } from '@angular/core';

@Component({
  selector: 'app-hello-card',                   // la balise qui l'affiche
  imports: [CardComponent, TextComponent],      // les composants utilisés dans le .html
  templateUrl: './hello-card.component.html',   // ce qui s'affiche
  styleUrl: './hello-card.component.scss',      // l'apparence (souvent vide ici)
})
export class HelloCardComponent {
  prenom = 'Ada';                               // une donnée
}

<!-- hello-card.component.html : l'affichage -->
<app-card>
  <app-text variant="heading">Bonjour {{ prenom }} !</app-text>
</app-card>

<!-- N'importe où ailleurs, pour l'afficher : -->
<app-hello-card />`;
}
