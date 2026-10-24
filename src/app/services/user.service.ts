import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CreateUser, Quota, UpdateUser, User } from '../models/user.model';
import { apiContext } from '../utils/api-context';

/** Les comptes utilisateurs : toutes ces routes sont réservées aux administrateurs (403 sinon). */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  list(): Observable<User[]> {
    return this.http.get<User[]>('/api/users', { context: this.context });
  }

  create(body: CreateUser): Observable<User> {
    return this.http.post<User>('/api/users', body, { context: this.context });
  }

  /** Changer le rôle ou désactiver un compte (effet immédiat, même avec un jeton encore valide). */
  update(id: string, body: UpdateUser): Observable<User> {
    return this.http.patch<User>(`/api/users/${id}`, body, { context: this.context });
  }

  /** Refusé (409) si c'est le dernier admin actif, ou si l'utilisateur possède encore des VM. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`, { context: this.context });
  }

  /** Réinitialise le mot de passe de quelqu'un d'autre (ferme toutes ses sessions). */
  resetPassword(id: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`/api/users/${id}/password`, { new_password: newPassword }, { context: this.context });
  }

  /** Remplace TOUT le quota : un champ absent ou `null` = illimité. */
  setQuota(id: string, quota: Quota): Observable<User> {
    return this.http.put<User>(`/api/users/${id}/quota`, quota, { context: this.context });
  }
}
