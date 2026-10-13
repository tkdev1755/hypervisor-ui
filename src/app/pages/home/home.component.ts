import { Component } from '@angular/core';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { IconComponent } from '@app/components/ui/icon/icon.component';
import { IconName } from '@app/components/ui/icon/icons';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { TextComponent } from '@app/components/ui/text/text.component';

interface Raccourci {
  icon: IconName;
  titre: string;
  texte: string;
  lien: string;
  bouton: string;
}

/** La page d'accueil : par où commencer. */
@Component({
  selector: 'app-home',
  imports: [
    PageComponent,
    GridComponent,
    CardComponent,
    ColumnComponent,
    IconComponent,
    TextComponent,
    InlineCodeComponent,
    ButtonComponent,
    CalloutComponent,
    ListComponent,
    ListTileComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly raccourcis: Raccourci[] = [
    {
      icon: 'learn',
      titre: 'Apprendre',
      texte: 'Dix leçons courtes, de « qu’est-ce qu’une variable ? » jusqu’aux appels à l’API.',
      lien: '/learn',
      bouton: 'Commencer les leçons',
    },
    {
      icon: 'server',
      titre: 'Hyperviseurs',
      texte: 'L’application elle-même : la liste des hôtes KVM, leurs VM, disques et réseaux.',
      lien: '/hypervisors',
      bouton: 'Ouvrir',
    },
  ];

  readonly etapes = [
    { titre: '1. Lancer l’API et le front', texte: 'npm run mock, puis npm start (voir le README).' },
    { titre: '2. Suivre les leçons dans l’ordre', texte: 'TypeScript d’abord, puis Angular, puis la mise en page.' },
    { titre: '3. Lire une vraie page', texte: 'pages/hypervisor-list : chaque ligne est commentée.' },
    { titre: '4. Faire les exercices', texte: 'Ils sont dans GUIDE.md, du plus simple au plus complet.' },
  ];
}
