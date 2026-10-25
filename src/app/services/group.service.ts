import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CreateGroup, EffectiveMember, Group, GroupDetail, UpdateGroup, UserGroup } from '../models/group.model';
import { apiContext } from '../utils/api-context';

/**
 * Les groupes d'utilisateurs.
 *
 * Tout est réservé aux administrateurs (403 sinon), sauf `myGroups()` : chaque utilisateur peut
 * voir les groupes dont il fait partie, sans rien pouvoir y changer.
 */
@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  // ---------- pour tout le monde ----------

  /** Les groupes de l'utilisateur connecté, directement ou par un groupe imbriqué. */
  myGroups(): Observable<UserGroup[]> {
    return this.http.get<UserGroup[]>('/api/me/groups', { context: this.context });
  }

  // ---------- administrateurs ----------

  list(): Observable<Group[]> {
    return this.http.get<Group[]>('/api/groups', { context: this.context });
  }

  /** Un groupe avec ses membres directs, ses sous-groupes et ses groupes parents. */
  get(groupId: string): Observable<GroupDetail> {
    return this.http.get<GroupDetail>(`/api/groups/${groupId}`, { context: this.context });
  }

  create(body: CreateGroup): Observable<Group> {
    return this.http.post<Group>('/api/groups', body, { context: this.context });
  }

  update(groupId: string, body: UpdateGroup): Observable<Group> {
    return this.http.patch<Group>(`/api/groups/${groupId}`, body, { context: this.context });
  }

  /** Supprime le groupe : ses membres et sous-groupes ne sont pas supprimés, seulement leur lien avec lui. */
  delete(groupId: string): Observable<void> {
    return this.http.delete<void>(`/api/groups/${groupId}`, { context: this.context });
  }

  /** Tous les utilisateurs du groupe, sous-groupes compris (`direct` dit comment ils y sont). */
  members(groupId: string): Observable<EffectiveMember[]> {
    return this.http.get<EffectiveMember[]>(`/api/groups/${groupId}/members`, { context: this.context });
  }

  addMember(groupId: string, userId: string): Observable<void> {
    return this.http.put<void>(`/api/groups/${groupId}/members/${userId}`, null, { context: this.context });
  }

  removeMember(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`/api/groups/${groupId}/members/${userId}`, { context: this.context });
  }

  /** Met `childId` dans le groupe (409 si cela mettait le groupe dans lui-même). */
  addSubgroup(groupId: string, childId: string): Observable<void> {
    return this.http.put<void>(`/api/groups/${groupId}/subgroups/${childId}`, null, { context: this.context });
  }

  removeSubgroup(groupId: string, childId: string): Observable<void> {
    return this.http.delete<void>(`/api/groups/${groupId}/subgroups/${childId}`, { context: this.context });
  }

  /** Les groupes d'un utilisateur, pour un administrateur. */
  userGroups(userId: string): Observable<UserGroup[]> {
    return this.http.get<UserGroup[]>(`/api/users/${userId}/groups`, { context: this.context });
  }
}
