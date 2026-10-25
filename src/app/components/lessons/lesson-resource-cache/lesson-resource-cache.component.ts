import { Component, inject, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { ResourceCacheService } from '@app/services/resource-cache.service';
import { LessonComponent } from '../lesson/lesson.component';

/** L'identifiant et la donnée utilisés par la démonstration (aucun vrai hyperviseur n'a cet id). */
const ID_DEMO = 'demo-lecon';
const HYPERVISEUR_DEMO: Hypervisor = { id: ID_DEMO, name: 'kvm-demo', uri: 'qemu:///system', status: 'connected' };

/** Leçon 14 (Avancé) : le ResourceCacheService, ou comment passer une donnée d'une page à l'autre. */
@Component({
  selector: 'app-lesson-resource-cache',
  imports: [
    LessonComponent,
    ColumnComponent,
    RowComponent,
    TextComponent,
    InlineCodeComponent,
    CalloutComponent,
    ButtonComponent,
    ErrorPanelComponent,
  ],
  templateUrl: './lesson-resource-cache.component.html',
  styleUrl: './lesson-resource-cache.component.scss',
})
export class LessonResourceCacheComponent {
  private readonly resourceCache = inject(ResourceCacheService);

  readonly code = `// 1. Le catalogue des types (services/resource-cache.service.ts)
export interface ResourceTypes {
  hypervisor: Hypervisor;     // un nouveau type = une ligne ici
}

// 2. Son descripteur : comment le recharger (config/resource-descriptors.ts)
provideResourceDescriptor(() => {
  const hypervisors = inject(HypervisorService);
  return { type: 'hypervisor', fetch: (id) => hypervisors.get(id) };
}),

// 3. La page LISTE range ce qu'elle vient de charger, et ne met que l'id dans l'URL
open(hypervisor: Hypervisor): void {
  this.resourceCache.prime('hypervisor', hypervisor.id, hypervisor);
  this.router.navigate(['/hypervisors', hypervisor.id]);
}

// 4. La page DÉTAIL relit : le cache si possible, l'API sinon
ngOnInit(): void {
  this.resourceCache.resolve('hypervisor', this.id()).subscribe({
    next: (hypervisor) => this.hypervisor.set(hypervisor),
    error: (error: unknown) => { /* afficher l'erreur */ },
  });
}

// 5. Après une modification ou une suppression : OUBLIER la copie périmée
this.resourceCache.invalidate('hypervisor', hypervisor.id);

// Les quatre méthodes
//   prime(type, id, valeur)   ranger
//   peek(type, id)            lire le cache, sans jamais appeler l'API
//   resolve(type, id)         le cache, sinon l'API (Observable)
//   invalidate(type, id?)     oublier un élément (sans id : tout le type)`;

  readonly journal = signal<string[]>([]);
  readonly enCours = signal(false);
  readonly erreur = signal<AppError | null>(null);

  ranger(): void {
    this.resourceCache.prime('hypervisor', ID_DEMO, HYPERVISEUR_DEMO);
    this.noter('prime → « kvm-demo » rangé dans le cache');
  }

  lire(): void {
    const valeur = this.resourceCache.peek('hypervisor', ID_DEMO);
    this.noter(valeur ? 'peek → trouvé : ' + valeur.name : 'peek → rien en cache (undefined)');
  }

  resoudre(): void {
    const origine = this.resourceCache.peek('hypervisor', ID_DEMO) ? 'cache' : 'appel à l’API';
    this.enCours.set(true);
    this.erreur.set(null);
    this.resourceCache.resolve('hypervisor', ID_DEMO).subscribe({
      next: (valeur) => {
        this.noter('resolve (' + origine + ') → ' + valeur.name);
        this.enCours.set(false);
      },
      error: (error: unknown) => {
        this.noter('resolve (' + origine + ') → échec');
        this.erreur.set(isAppError(error) ? error : null);
        this.enCours.set(false);
      },
    });
  }

  oublier(): void {
    this.resourceCache.invalidate('hypervisor', ID_DEMO);
    this.noter('invalidate → cache vidé pour cet id');
  }

  /** On garde les 7 dernières lignes. */
  private noter(ligne: string): void {
    this.journal.update((lignes) => [...lignes, ligne].slice(-7));
  }
}
