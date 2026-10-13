import { Component, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';

/** Leçon 7 (Angular) : afficher sous condition (@if) et répéter (@for). */
@Component({
  selector: 'app-lesson-control-flow',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent, ListComponent, ListTileComponent],
  templateUrl: './lesson-control-flow.component.html',
  styleUrl: './lesson-control-flow.component.scss',
})
export class LessonControlFlowComponent {
  readonly code = `// --- Le .ts ---
vms = signal(['web-01', 'db-01']);

ajouter(): void {
  // On crée un NOUVEAU tableau [...ancien, nouveau] : Angular voit le changement
  this.vms.update((liste) => [...liste, \`vm-\${liste.length + 1}\`]);
}

<!-- --- Le .html --- -->
<!-- @if : afficher seulement si la condition est vraie -->
@if (vms().length >= 4) {
  <app-text color="warning">Beaucoup de VM !</app-text>
} @else {
  <app-text>{{ vms().length }} VM</app-text>
}

<!-- @for : répéter pour chaque élément du tableau -->
@for (vm of vms(); track vm) {      <!-- track : comment reconnaître chaque élément -->
  <app-list-tile [title]="vm" />
} @empty {                           <!-- quand le tableau est vide -->
  <app-text>Aucune VM.</app-text>
}`;

  vms = signal(['web-01', 'db-01']);

  ajouter(): void {
    this.vms.update((liste) => [...liste, `vm-${liste.length + 1}`]);
  }

  retirer(): void {
    this.vms.update((liste) => liste.slice(0, -1));
  }

  vider(): void {
    this.vms.set([]);
  }
}
