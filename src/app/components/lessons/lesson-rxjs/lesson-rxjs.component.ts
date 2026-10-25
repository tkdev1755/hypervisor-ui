import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, delay, filter, of, switchMap, take, tap, timer } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LessonComponent } from '../lesson/lesson.component';

/** Ce que renvoie la fausse API de la démonstration. */
interface FausseTache {
  status: 'running' | 'succeeded';
  progression: number;
}

/** Leçon 16 (Avancé) : RxJS en pratique, avec le suivi d'une tâche de fond. */
@Component({
  selector: 'app-lesson-rxjs',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent],
  templateUrl: './lesson-rxjs.component.html',
  styleUrl: './lesson-rxjs.component.scss',
})
export class LessonRxjsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private abonnement?: Subscription;
  private interrogations = 0;

  readonly code = `// JobService.watch : suivre une tâche de fond (le clonage d'une VM)
watch(jobId: string): Observable<Job> {
  return timer(0, 1000).pipe(                   // 0, 1, 2, 3... toutes les secondes
    switchMap(() => this.get(jobId)),           // à chaque tic : interroger l'API
    filter((job) => job.status !== 'running'),  // ignorer tant que la tâche tourne
    take(1),                                    // à la première réponse finale : terminer
  );
}

// Dans un composant : s'abonner, et ne pas oublier de se désabonner
this.abonnement = this.jobs.watch(id)
  .pipe(takeUntilDestroyed(this.destroyRef))    // s'arrête si le composant est détruit
  .subscribe((job) => { /* terminé */ });

this.abonnement.unsubscribe();                  // ou à la main, par exemple sur « Annuler »

// Un Observable est PARESSEUX et FROID : rien ne part avant subscribe(),
// et chaque subscribe() relance tout depuis le début.
// shareReplay partage UNE exécution entre plusieurs abonnés (voir le ResourceCache).`;

  readonly etat = signal<'repos' | 'en-cours' | 'terminee' | 'annulee'>('repos');
  readonly progression = signal(0);
  readonly journal = signal<string[]>([]);

  lancer(): void {
    this.abonnement?.unsubscribe();
    this.interrogations = 0;
    this.progression.set(0);
    this.journal.set([]);
    this.etat.set('en-cours');

    this.abonnement = timer(0, 800)
      .pipe(
        switchMap(() => this.fausseApi()),
        tap((tache) => {
          this.progression.set(tache.progression);
          this.noter('Interrogation n°' + this.interrogations + ' → ' + tache.status);
        }),
        filter((tache) => tache.status !== 'running'),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.etat.set('terminee'));
  }

  annuler(): void {
    this.abonnement?.unsubscribe();
    this.etat.set('annulee');
    this.noter('Désabonnement : plus aucune interrogation ne part.');
  }

  /** Une fausse réponse de l'API, qui met 0,2 s à arriver ; la tâche réussit à la 5e interrogation. */
  private fausseApi(): Observable<FausseTache> {
    this.interrogations++;
    const reussie = this.interrogations >= 5;
    return of<FausseTache>({ status: reussie ? 'succeeded' : 'running', progression: Math.min(this.interrogations * 20, 100) }).pipe(
      delay(200),
    );
  }

  private noter(ligne: string): void {
    this.journal.update((lignes) => [...lignes, ligne].slice(-7));
  }
}
