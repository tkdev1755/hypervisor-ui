import { Component, input } from '@angular/core';

/**
 * LOADING — un indicateur de chargement (comme CircularProgressIndicator en Flutter).
 *
 *   <app-loading />
 *   <app-loading label="Chargement des VM…" />
 */
@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent {
  readonly label = input('Chargement…');
}
