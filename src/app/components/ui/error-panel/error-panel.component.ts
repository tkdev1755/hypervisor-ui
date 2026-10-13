import { DatePipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';

import { AppError } from '@app/models/app-error.model';
import { IconComponent } from '../icon/icon.component';

/**
 * ERROR PANEL — l'affichage unique de toutes les erreurs : un titre, un
 * message clair, et, pour les erreurs techniques seulement, des détails repliés
 * (API, requête, code HTTP) à transmettre à l'équipe.
 *
 *   <app-error-panel [error]="error" />
 *   <app-error-panel [error]="error" [retryable]="true" (retry)="load()" />
 */
@Component({
  selector: 'app-error-panel',
  imports: [IconComponent, DatePipe],
  templateUrl: './error-panel.component.html',
  styleUrl: './error-panel.component.scss',
})
export class ErrorPanelComponent {
  readonly error = input.required<AppError>();
  readonly retryable = input(false);
  readonly retry = output<void>();

  protected readonly detailsOpen = signal(false);
}
