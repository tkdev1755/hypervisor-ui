import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, switchMap, take, timer } from 'rxjs';

import { Job } from '../models/job.model';
import { apiContext } from '../utils/api-context';

/** Les tâches de fond de l'API (aujourd'hui : le clonage de VM). */
@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  get(jobId: string): Observable<Job> {
    return this.http.get<Job>(`/api/jobs/${jobId}`, { context: this.context });
  }

  /**
   * Interroge la tâche toutes les secondes et n'émet qu'une fois, quand elle
   * est terminée (réussie ou échouée). Une 404 (API redémarrée) devient une erreur.
   */
  watch(jobId: string): Observable<Job> {
    return timer(0, 1000).pipe(
      switchMap(() => this.get(jobId)),
      filter((job) => job.status !== 'running'),
      take(1),
    );
  }
}
