import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Job } from '../models/job.model';
import {
  BuildLog,
  CreateTemplate,
  CreateVmFromTemplate,
  SetPermission,
  Template,
  TemplatePermission,
  TemplateVersion,
  UpdateTemplate,
} from '../models/template.model';
import { apiContext } from '../utils/api-context';

/**
 * Les routes des templates d'un hyperviseur, de leurs versions et des droits sur eux.
 *
 * - Un administrateur peut tout faire : créer et supprimer des templates, changer leur visibilité,
 *   donner des droits à des utilisateurs ou à des groupes.
 * - Un droit 'manage' permet de modifier un template, de l'activer ou le désactiver, de le reconstruire,
 *   d'arrêter une construction, de lire les journaux et de supprimer des versions.
 * - Un droit 'use' (ou un template 'hypervisor' quand on a l'accès à l'hyperviseur) permet de voir ses
 *   versions prêtes et d'en créer des VM, dans la limite éventuelle `max_vms`.
 * Chaque template dit à l'utilisateur connecté ce qu'il peut en faire (`access`).
 */
@Injectable({ providedIn: 'root' })
export class TemplateService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  private url(hypervisorId: string, templateId?: string): string {
    const base = `/api/hypervisors/${hypervisorId}/templates`;
    return templateId ? `${base}/${templateId}` : base;
  }

  // ---------- templates ----------

  list(hypervisorId: string): Observable<Template[]> {
    return this.http.get<Template[]>(this.url(hypervisorId), { context: this.context });
  }

  get(hypervisorId: string, templateId: string): Observable<Template> {
    return this.http.get<Template>(this.url(hypervisorId, templateId), { context: this.context });
  }

  /** Crée le template et lance la construction de sa version 1 (202 : à suivre avec get()). */
  create(hypervisorId: string, body: CreateTemplate): Observable<Template> {
    return this.http.post<Template>(this.url(hypervisorId), body, { context: this.context });
  }

  /** Modifie la définition. Les versions existantes ne changent pas : il faut reconstruire. */
  update(hypervisorId: string, templateId: string, body: UpdateTemplate): Observable<Template> {
    return this.http.patch<Template>(this.url(hypervisorId, templateId), body, { context: this.context });
  }

  /** Supprime le template, toutes ses versions et leurs disques (les VM gardent leur copie). */
  delete(hypervisorId: string, templateId: string): Observable<void> {
    return this.http.delete<void>(this.url(hypervisorId, templateId), { context: this.context });
  }

  // ---------- versions ----------

  /** Les versions, la plus récente en premier (un utilisateur ne reçoit que les versions prêtes). */
  listVersions(hypervisorId: string, templateId: string): Observable<TemplateVersion[]> {
    return this.http.get<TemplateVersion[]>(`${this.url(hypervisorId, templateId)}/versions`, { context: this.context });
  }

  /** Lance une nouvelle version à partir de la définition actuelle (409 si une construction tourne déjà). */
  rebuild(hypervisorId: string, templateId: string): Observable<TemplateVersion> {
    return this.http.post<TemplateVersion>(`${this.url(hypervisorId, templateId)}/versions`, null, { context: this.context });
  }

  deleteVersion(hypervisorId: string, templateId: string, version: number): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, templateId)}/versions/${version}`, { context: this.context });
  }

  /** Le journal d'une version à partir de `offset` (0 = depuis le début). */
  logs(hypervisorId: string, templateId: string, version: number, offset = 0): Observable<BuildLog> {
    return this.http.get<BuildLog>(`${this.url(hypervisorId, templateId)}/versions/${version}/logs`, {
      params: { offset },
      context: this.context,
    });
  }

  /** Arrête la construction en cours : Packer fait le ménage ; `force` la tue tout de suite. */
  stop(hypervisorId: string, templateId: string, force = false): Observable<TemplateVersion> {
    const params: Record<string, string> = force ? { force: 'true' } : {};
    return this.http.post<TemplateVersion>(`${this.url(hypervisorId, templateId)}/stop`, null, { params, context: this.context });
  }

  // ---------- droits (admin seulement) ----------

  /** Les droits donnés sur le template : les utilisateurs d'abord, puis les groupes. */
  listPermissions(hypervisorId: string, templateId: string): Observable<TemplatePermission[]> {
    return this.http.get<TemplatePermission[]>(`${this.url(hypervisorId, templateId)}/permissions`, { context: this.context });
  }

  /** Donne ou change le droit d'un utilisateur ('user') ou d'un groupe ('group'). */
  setPermission(hypervisorId: string, templateId: string, kind: 'user' | 'group', id: string, body: SetPermission): Observable<void> {
    return this.http.put<void>(`${this.url(hypervisorId, templateId)}/permissions/${kind}s/${id}`, body, { context: this.context });
  }

  /** Retire un droit : les VM déjà créées sont gardées. */
  removePermission(hypervisorId: string, templateId: string, kind: 'user' | 'group', id: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, templateId)}/permissions/${kind}s/${id}`, { context: this.context });
  }

  // ---------- VM ----------

  /** La copie du disque prend du temps : l'API répond 202 avec une tâche à suivre (JobService.watch). */
  createVm(hypervisorId: string, templateId: string, body: CreateVmFromTemplate): Observable<Job> {
    return this.http.post<Job>(`${this.url(hypervisorId, templateId)}/vms`, body, { context: this.context });
  }
}
