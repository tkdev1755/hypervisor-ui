import { Component } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';
import { CardComponent } from '@app/components/layout/card/card.component';
import { ExpandedComponent } from '@app/components/layout/expanded/expanded.component';
import { SizedBoxComponent } from '@app/components/layout/sized-box/sized-box.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { IconComponent } from '@app/components/ui/icon/icon.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';

/** Leçon 10 : construire un écran sans écrire de HTML ni de CSS. */
@Component({
  selector: 'app-lesson-layout',
  imports: [
    LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent,
    CardComponent,
    ExpandedComponent,
    SizedBoxComponent,
    SpacerComponent,
    IconComponent,
    StatusBadgeComponent,
    ListComponent,
    ListTileComponent,
  ],
  templateUrl: './lesson-layout.component.html',
  styleUrl: './lesson-layout.component.scss',
})
export class LessonLayoutComponent {
  readonly code = `<app-card>
  <app-row [gap]="16">                       <!-- côte à côte -->
    <app-icon name="user" [size]="28" />
    <app-expanded>                           <!-- prend la place restante -->
      <app-column [gap]="2">                  <!-- l'un sous l'autre -->
        <app-text variant="heading">Ada Lovelace</app-text>
        <app-text color="muted">Administratrice</app-text>
      </app-column>
    </app-expanded>
    <app-button variant="secondary" size="sm">Profil</app-button>
  </app-row>

  <app-sized-box [height]="16" />             <!-- un espace vide de 16 px -->

  <app-row [gap]="8">
    <app-status-badge status="running" />
    <app-spacer />                            <!-- pousse la suite à droite -->
    <app-text variant="small" color="subtle">il y a 2 min</app-text>
  </app-row>
</app-card>`;

  /** Le mémo des composants de mise en page, affiché dans la leçon. */
  readonly memo = [
    { nom: '<app-column [gap]>', role: 'Empile ses enfants de haut en bas.' },
    { nom: '<app-row [gap]>', role: 'Aligne ses enfants de gauche à droite.' },
    { nom: '<app-padding [all]>', role: 'Ajoute de l’espace autour du contenu.' },
    { nom: '<app-sized-box [height]>', role: 'Un espace vide, ou une boîte de taille fixe.' },
    { nom: '<app-expanded>', role: 'Prend toute la place restante dans une ligne ou une colonne.' },
    { nom: '<app-spacer />', role: 'Pousse les éléments suivants au bout de la ligne.' },
    { nom: '<app-center>', role: 'Centre son contenu.' },
    { nom: '<app-grid [minItemWidth]>', role: 'Une grille de cartes qui s’adapte à la largeur.' },
    { nom: '<app-card>', role: 'Un bloc blanc avec bordure ; cliquable avec [clickable].' },
    { nom: '<app-divider />', role: 'Un trait de séparation.' },
    { nom: '<app-page title>', role: 'Le squelette d’une page : titre, description, actions.' },
    { nom: '<app-text variant color>', role: 'Du texte avec un style prédéfini.' },
    { nom: '<app-button (pressed)>', role: 'Un bouton ; un lien avec [to].' },
  ];
}
