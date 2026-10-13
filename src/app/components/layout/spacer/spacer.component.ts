import { Component } from '@angular/core';

/**
 * SPACER — un espace vide qui grandit au maximum (comme Spacer en Flutter).
 * Dans une <app-row>, il pousse tout ce qui le suit vers la droite.
 *
 *   <app-row>
 *     <app-text>Titre</app-text>
 *     <app-spacer />
 *     <app-button>Action</app-button>
 *   </app-row>
 */
@Component({
  selector: 'app-spacer',
  templateUrl: './spacer.component.html',
  styleUrl: './spacer.component.scss',
})
export class SpacerComponent {}
