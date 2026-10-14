import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';

/** Leçon 11 (Avancé) : le routage, les paramètres d'adresse et le chargement paresseux. */
@Component({
  selector: 'app-lesson-routing',
  imports: [LessonComponent, ColumnComponent, TextComponent, InlineCodeComponent, CalloutComponent, ListComponent, ListTileComponent],
  templateUrl: './lesson-routing.component.html',
  styleUrl: './lesson-routing.component.scss',
})
export class LessonRoutingComponent {
  private readonly router = inject(Router);

  readonly code = `// 1. app.routes.ts : une route = une adresse + une page
{
  path: 'hypervisors/:id',             // :id est un « paramètre d'adresse »
  title: 'Hyperviseur · Hypervisor',   // le titre de l'onglet du navigateur
  loadComponent: () =>                 // chargement paresseux (lazy loading) :
    import('./pages/hypervisor-detail/hypervisor-detail.component')
      .then((m) => m.HypervisorDetailComponent),   // la page n'est téléchargée qu'à la 1re visite
},

// 2. app.config.ts : UNE option qui change tout
provideRouter(routes, withComponentInputBinding())

// 3. La page reçoit :id comme n'importe quel input()
export class HypervisorDetailComponent {
  readonly id = input.required<string>();   // même nom que le paramètre
}

// 4. Naviguer depuis le code (page liste)
private readonly router = inject(Router);

open(hypervisor: Hypervisor): void {
  this.router.navigate(['/hypervisors', hypervisor.id]);   // → /hypervisors/abc-123
}

// 5. Lire l'adresse courante : un Observable converti en signal
adresse = toSignal(
  this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map((e) => e.urlAfterRedirects),
  ),
  { initialValue: this.router.url },
);`;

  /** L'adresse courante, tenue à jour à chaque navigation. */
  readonly adresse = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Les vraies routes de l'application, lues dans la configuration du routeur. */
  readonly routes = (this.router.config[0]?.children ?? [])
    .filter((route) => route.path !== '**')
    .map((route) => ({
      adresse: '/' + (route.path ?? ''),
      titre: typeof route.title === 'string' ? route.title : '',
      parametre: (route.path ?? '').includes(':'),
    }));
}
