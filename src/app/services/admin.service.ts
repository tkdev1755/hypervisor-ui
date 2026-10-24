import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AuditEntry, AuditFilter, Settings } from '../models/audit.model';
import { AccessEntry } from '../models/share.model';
import { apiContext } from '../utils/api-context';

/** Les réglages de l'API, le journal d'audit et l'accès aux hyperviseurs : réservés aux administrateurs. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  // --- Paramètres ---
  settings(): Observable<Settings> {
    return this.http.get<Settings>('/api/settings', { context: this.context });
  }

  /** Ouvrir ou fermer les inscriptions libres. */
  updateSettings(body: Settings): Observable<Settings> {
    return this.http.put<Settings>('/api/settings', body, { context: this.context });
  }

  // --- Journal d'audit (le plus récent d'abord) ---
  audit(filter: AuditFilter = {}): Observable<AuditEntry[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<AuditEntry[]>('/api/audit', { params, context: this.context });
  }

  // --- Qui peut créer des VM sur un hyperviseur ---
  listAccess(hypervisorId: string): Observable<AccessEntry[]> {
    return this.http.get<AccessEntry[]>(`/api/hypervisors/${hypervisorId}/access`, { context: this.context });
  }

  grantAccess(hypervisorId: string, userId: string): Observable<void> {
    return this.http.put<void>(`/api/hypervisors/${hypervisorId}/access/${userId}`, null, { context: this.context });
  }

  /** Retirer l'accès n'enlève PAS à l'utilisateur les VM qu'il possède déjà. */
  revokeAccess(hypervisorId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`/api/hypervisors/${hypervisorId}/access/${userId}`, { context: this.context });
  }
}
