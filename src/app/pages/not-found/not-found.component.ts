import { Component } from '@angular/core';

import { CenterComponent } from '@app/components/layout/center/center.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';

/** Affichée pour toute adresse inconnue (route '**'). */
@Component({
  selector: 'app-not-found',
  imports: [CenterComponent, EmptyStateComponent, ButtonComponent],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {}
