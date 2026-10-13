import { Component, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';
import { DemoVm, DemoVmCardComponent } from '../demo-vm-card/demo-vm-card.component';

/** Leçon 8 (Angular) : faire communiquer un parent et ses enfants. */
@Component({
  selector: 'app-lesson-inputs-outputs',
  imports: [LessonComponent, ColumnComponent, TextComponent, InlineCodeComponent, CalloutComponent, DemoVmCardComponent],
  templateUrl: './lesson-inputs-outputs.component.html',
  styleUrl: './lesson-inputs-outputs.component.scss',
})
export class LessonInputsOutputsComponent {
  readonly code = `// --- L'enfant : demo-vm-card.component.ts ---
vm = input.required<DemoVm>();   // une donnée REÇUE du parent
basculer = output<string>();     // un événement ENVOYÉ au parent

<!-- demo-vm-card.component.html -->
<app-text>{{ vm().nom }}</app-text>
<app-button (pressed)="basculer.emit(vm().nom)">Allumer / éteindre</app-button>

<!-- --- Le parent : [entrée]="valeur" et (sortie)="méthode($event)" --- -->
@for (vm of vms(); track vm.nom) {
  <app-demo-vm-card [vm]="vm" (basculer)="basculer($event)" />
}

// Le parent détient les données et décide ; l'enfant affiche et prévient.
basculer(nom: string): void {
  this.vms.update((liste) =>
    liste.map((vm) => (vm.nom === nom ? { ...vm, allumee: !vm.allumee } : vm)),
  );
}`;

  vms = signal<DemoVm[]>([
    { nom: 'web-01', allumee: true },
    { nom: 'db-01', allumee: false },
  ]);

  basculer(nom: string): void {
    this.vms.update((liste) => liste.map((vm) => (vm.nom === nom ? { ...vm, allumee: !vm.allumee } : vm)));
  }
}
