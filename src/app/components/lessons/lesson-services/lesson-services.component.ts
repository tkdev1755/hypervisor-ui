import { Component, inject, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ApiMessage } from '@app/models/api-message.model';
import { AppError } from '@app/models/app-error.model';
import { HypervisorService } from '@app/services/hypervisor.service';

/** Leçon 9 (Angular) : les services, l'injection et les appels HTTP. */
@Component({
  selector: 'app-lesson-services',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent, ErrorPanelComponent],
  templateUrl: './lesson-services.component.html',
  styleUrl: './lesson-services.component.scss',
})
export class LessonServicesComponent {
  private readonly hypervisors = inject(HypervisorService);

  readonly code = `// 1. Le service (services/hypervisor.service.ts) regroupe les appels à l'API
@Injectable({ providedIn: 'root' })
export class HypervisorService {
  private readonly http = inject(HttpClient);

  ping(): Observable<ApiMessage> {
    return this.http.get<ApiMessage>('/ping');
  }
}

// 2. Le composant demande le service avec inject()
private readonly hypervisors = inject(HypervisorService);

chargement = signal(false);
reponse = signal<ApiMessage | null>(null);
erreur = signal<AppError | null>(null);

appeler(): void {
  this.chargement.set(true);
  this.hypervisors.ping().subscribe({        // .subscribe() : la requête part ICI
    next: (reponse) => {                     // la réponse est arrivée
      this.reponse.set(reponse);
      this.chargement.set(false);
    },
    error: (erreur: AppError) => {           // l'appel a échoué
      this.erreur.set(erreur);
      this.chargement.set(false);
    },
  });
}

<!-- 3. Une erreur s'affiche avec un seul composant -->
@if (erreur(); as erreur) {
  <app-error-panel [error]="erreur" />
}`;

  chargement = signal(false);
  reponse = signal<ApiMessage | null>(null);
  erreur = signal<AppError | null>(null);

  appeler(): void {
    this.chargement.set(true);
    this.reponse.set(null);
    this.erreur.set(null);
    this.hypervisors.ping().subscribe({
      next: (reponse) => {
        this.reponse.set(reponse);
        this.chargement.set(false);
      },
      error: (erreur: AppError) => {
        this.erreur.set(erreur);
        this.chargement.set(false);
      },
    });
  }
}
