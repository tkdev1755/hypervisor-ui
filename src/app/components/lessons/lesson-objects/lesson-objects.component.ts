import { Component } from '@angular/core';

import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';

/** Une interface décrit la forme d'un objet. */
interface Vm {
  nom: string;
  memoireGo: number;
  allumee: boolean;
}

/** Leçon 2 (TypeScript) : les objets, les interfaces et les tableaux. */
@Component({
  selector: 'app-lesson-objects',
  imports: [LessonComponent, TextComponent, InlineCodeComponent, CalloutComponent, ListComponent, ListTileComponent],
  templateUrl: './lesson-objects.component.html',
  styleUrl: './lesson-objects.component.scss',
})
export class LessonObjectsComponent {
  readonly code = `// Une « interface » décrit la forme d'un objet
interface Vm {
  nom: string;
  memoireGo: number;
  allumee: boolean;
  description?: string;   // le « ? » rend ce champ facultatif
}

// Un objet qui respecte l'interface
const web: Vm = { nom: 'web-01', memoireGo: 4, allumee: true };
web.nom;                  // on lit un champ avec un point : 'web-01'

// Un tableau de Vm s'écrit Vm[]
const vms: Vm[] = [
  web,
  { nom: 'db-01', memoireGo: 8, allumee: false },
  { nom: 'ci', memoireGo: 2, allumee: true },
];

vms.length;                          // le nombre d'éléments
vms[0];                              // le premier (on compte à partir de 0)
vms.filter((vm) => vm.allumee);      // garde seulement certains éléments
vms.map((vm) => vm.nom);             // transforme chaque élément
vms.reduce((total, vm) => total + vm.memoireGo, 0);  // additionne`;

  vms: Vm[] = [
    { nom: 'web-01', memoireGo: 4, allumee: true },
    { nom: 'db-01', memoireGo: 8, allumee: false },
    { nom: 'ci', memoireGo: 2, allumee: true },
  ];

  /** Chaque ligne de la démo : l'expression et son résultat, calculé pour de vrai. */
  resultats = [
    { expression: 'vms.length', resultat: String(this.vms.length) },
    { expression: 'vms[0].nom', resultat: this.vms[0].nom },
    { expression: 'vms.filter((vm) => vm.allumee)', resultat: this.vms.filter((vm) => vm.allumee).map((vm) => vm.nom).join(', ') },
    { expression: 'vms.map((vm) => vm.nom)', resultat: this.vms.map((vm) => vm.nom).join(', ') },
    { expression: 'vms.reduce(...)', resultat: this.vms.reduce((total, vm) => total + vm.memoireGo, 0) + ' Go au total' },
  ];
}
