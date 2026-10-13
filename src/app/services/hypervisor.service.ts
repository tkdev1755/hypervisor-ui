import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiMessage } from '../models/api-message.model';
import { CreateHypervisor, Hypervisor, UpdateHypervisor } from '../models/hypervisor.model';
import { apiContext } from '../utils/api-context';

/**
 * Toutes les routes « hyperviseurs » de l'API, au même endroit.
 *
 * Un service est une classe partagée par toute l'application
 * (providedIn: 'root' = Angular en crée une seule, partagée par tous).
 * Les composants ne font jamais d'appel HTTP eux-mêmes : ils passent par un
 * service comme celui-ci, qu'ils obtiennent avec inject(HypervisorService).
 *
 * Chaque méthode renvoie un Observable : la requête ne part que lorsqu'on
 * appelle .subscribe() dessus.
 */
@Injectable({ providedIn: 'root' })
export class HypervisorService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  /** GET /ping : l'API est-elle démarrée ? */
  ping(): Observable<ApiMessage> {
    return this.http.get<ApiMessage>('/ping', { context: this.context });
  }

  /** GET /api/hypervisors : la liste des hyperviseurs. */
  list(): Observable<Hypervisor[]> {
    return this.http.get<Hypervisor[]>('/api/hypervisors', { context: this.context });
  }

  /** GET /api/hypervisors/{id} : un hyperviseur. */
  get(id: string): Observable<Hypervisor> {
    return this.http.get<Hypervisor>(`/api/hypervisors/${id}`, { context: this.context });
  }

  /** POST /api/hypervisors : en ajouter un. */
  create(body: CreateHypervisor): Observable<Hypervisor> {
    return this.http.post<Hypervisor>('/api/hypervisors', body, { context: this.context });
  }

  /** PATCH /api/hypervisors/{id} : modifier son nom ou son URI. */
  update(id: string, body: UpdateHypervisor): Observable<Hypervisor> {
    return this.http.patch<Hypervisor>(`/api/hypervisors/${id}`, body, { context: this.context });
  }

  /** DELETE /api/hypervisors/{id} : supprimer son enregistrement. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/hypervisors/${id}`, { context: this.context });
  }
}
