import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CreateShare, Share } from '../models/share.model';
import { apiContext } from '../utils/api-context';

/**
 * Le prêt d'une VM. L'emprunteur obtient la console, démarrer et arrêter, rien d'autre,
 * et ne peut pas la prêter plus loin.
 *
 * Lister, ajouter : le propriétaire ou un admin. Retirer : le propriétaire, un admin,
 * OU l'emprunteur lui-même (il « rend » la VM avec son propre id).
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  private url(hypervisorId: string, vmId: string): string {
    return `/api/hypervisors/${hypervisorId}/vms/${vmId}/shares`;
  }

  list(hypervisorId: string, vmId: string): Observable<Share[]> {
    return this.http.get<Share[]>(this.url(hypervisorId, vmId), { context: this.context });
  }

  /** Prêter à un utilisateur désigné par son nom exact. Re-prêter met simplement la date à jour. */
  create(hypervisorId: string, vmId: string, body: CreateShare): Observable<Share> {
    return this.http.post<Share>(this.url(hypervisorId, vmId), body, { context: this.context });
  }

  revoke(hypervisorId: string, vmId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, vmId)}/${userId}`, { context: this.context });
  }
}
