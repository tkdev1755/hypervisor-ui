import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Job } from '../models/job.model';
import {
  BuildLog,
  CreateTemplate,
  CreateVmFromTemplate,
  Template,
  TemplateAccessEntry,
  TemplateVersion,
  UpdateTemplate,
} from '../models/template.model';
import { apiContext } from '../utils/api-context';

/**
 * Les routes des templates d'un hyperviseur, de leurs versions et de leurs accès.
 *
 * Un administrateur voit tout, crée, modifie, reconstruit, arrête et supprime les templates,
 * lit les journaux de construction et choisit qui peut utiliser un template restreint.
 * Un utilisateur qui a l'accès à l'hyperviseur voit les templates prêts qui lui sont ouverts
 * (et seulement leurs versions prêtes), et crée des VM à partir d'eux.
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

  // ---------- accès (templates restreints) ----------

  listAccess(hypervisorId: string, templateId: string): Observable<TemplateAccessEntry[]> {
    return this.http.get<TemplateAccessEntry[]>(`${this.url(hypervisorId, templateId)}/access`, { context: this.context });
  }

  grantAccess(hypervisorId: string, templateId: string, userId: string): Observable<void> {
    return this.http.put<void>(`${this.url(hypervisorId, templateId)}/access/${userId}`, null, { context: this.context });
  }

  revokeAccess(hypervisorId: string, templateId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, templateId)}/access/${userId}`, { context: this.context });
  }

  // ---------- VM ----------

  /** La copie du disque prend du temps : l'API répond 202 avec une tâche à suivre (JobService.watch). */
  createVm(hypervisorId: string, templateId: string, body: CreateVmFromTemplate): Observable<Job> {
    return this.http.post<Job>(`${this.url(hypervisorId, templateId)}/vms`, body, { context: this.context });
  }
}
