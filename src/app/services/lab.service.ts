import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateLab,
  CreateLabInstance,
  CreateLabNetwork,
  Lab,
  LabDetail,
  LabInstance,
  LabNetwork,
  LabPermission,
  LabVm,
  LabVmBody,
  MyLabInstance,
  SetLabPermission,
  UpdateLab,
} from '../models/lab.model';
import { apiContext } from '../utils/api-context';

/**
 * Les routes des labos d'un hyperviseur : leur définition (réseaux, VM), les droits sur eux, et leurs instances.
 *
 * - Un administrateur peut tout faire : créer et supprimer des labos, changer leur visibilité, donner des droits.
 * - Un droit 'manage' permet de modifier le labo (nom, description, réseaux, VM) et de voir et piloter
 *   toutes ses instances.
 * - Un droit 'use' (ou un labo 'hypervisor' quand on a l'accès à l'hyperviseur) permet de voir le labo,
 *   de déployer des instances (dans la limite éventuelle `max_instances`) et de piloter les siennes.
 * Chaque labo dit à l'utilisateur connecté ce qu'il peut en faire (`access`).
 */
@Injectable({ providedIn: 'root' })
export class LabService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  private url(hypervisorId: string, labId?: string): string {
    const base = `/api/hypervisors/${hypervisorId}/labs`;
    return labId ? `${base}/${labId}` : base;
  }

  // ---------- labos ----------

  /** Les labos sur lesquels j'ai un droit (admin : tous). */
  list(hypervisorId: string): Observable<Lab[]> {
    return this.http.get<Lab[]>(this.url(hypervisorId), { context: this.context });
  }

  /** Le labo, ses réseaux et ses VM (routeurs d'abord, cartes réseau dans l'ordre). */
  get(hypervisorId: string, labId: string): Observable<LabDetail> {
    return this.http.get<LabDetail>(this.url(hypervisorId, labId), { context: this.context });
  }

  create(hypervisorId: string, body: CreateLab): Observable<LabDetail> {
    return this.http.post<LabDetail>(this.url(hypervisorId), body, { context: this.context });
  }

  update(hypervisorId: string, labId: string, body: UpdateLab): Observable<LabDetail> {
    return this.http.patch<LabDetail>(this.url(hypervisorId, labId), body, { context: this.context });
  }

  /** 409 tant que le labo a des instances. */
  delete(hypervisorId: string, labId: string): Observable<void> {
    return this.http.delete<void>(this.url(hypervisorId, labId), { context: this.context });
  }

  // ---------- réseaux et VM de la définition ----------

  addNetwork(hypervisorId: string, labId: string, body: CreateLabNetwork): Observable<LabNetwork> {
    return this.http.post<LabNetwork>(`${this.url(hypervisorId, labId)}/networks`, body, { context: this.context });
  }

  /** 409 si une VM du labo ou une instance l'utilise. */
  removeNetwork(hypervisorId: string, labId: string, networkId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, labId)}/networks/${networkId}`, { context: this.context });
  }

  addVm(hypervisorId: string, labId: string, body: LabVmBody): Observable<LabVm> {
    return this.http.post<LabVm>(`${this.url(hypervisorId, labId)}/vms`, body, { context: this.context });
  }

  /** Remplace la VM entière. Les instances déjà déployées gardent ce qu'elles ont. */
  updateVm(hypervisorId: string, labId: string, labVmId: string, body: LabVmBody): Observable<LabVm> {
    return this.http.put<LabVm>(`${this.url(hypervisorId, labId)}/vms/${labVmId}`, body, { context: this.context });
  }

  /** 409 si une instance l'a encore. */
  removeVm(hypervisorId: string, labId: string, labVmId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, labId)}/vms/${labVmId}`, { context: this.context });
  }

  // ---------- droits (admin seulement) ----------

  /** Les droits donnés sur le labo : les utilisateurs d'abord, puis les groupes. */
  listPermissions(hypervisorId: string, labId: string): Observable<LabPermission[]> {
    return this.http.get<LabPermission[]>(`${this.url(hypervisorId, labId)}/permissions`, { context: this.context });
  }

  /** Donne ou change le droit d'un utilisateur ('user') ou d'un groupe ('group'). */
  setPermission(hypervisorId: string, labId: string, kind: 'user' | 'group', id: string, body: SetLabPermission): Observable<void> {
    return this.http.put<void>(`${this.url(hypervisorId, labId)}/permissions/${kind}s/${id}`, body, { context: this.context });
  }

  /** Retire un droit : les instances déjà déployées sont gardées. */
  removePermission(hypervisorId: string, labId: string, kind: 'user' | 'group', id: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, labId)}/permissions/${kind}s/${id}`, { context: this.context });
  }

  // ---------- instances ----------

  /** Mes instances de ce labo ; toutes pour un gestionnaire ou un admin. */
  listInstances(hypervisorId: string, labId: string): Observable<LabInstance[]> {
    return this.http.get<LabInstance[]>(`${this.url(hypervisorId, labId)}/instances`, { context: this.context });
  }

  /**
   * Déploie le labo. L'API répond tout de suite (202) avec l'instance en 'deploying' : on la relit
   * ensuite (getInstance) jusqu'à 'ready' ou 'failed'.
   */
  createInstance(hypervisorId: string, labId: string, body: CreateLabInstance): Observable<LabInstance> {
    return this.http.post<LabInstance>(`${this.url(hypervisorId, labId)}/instances`, body, { context: this.context });
  }

  getInstance(hypervisorId: string, labId: string, instanceId: string): Observable<LabInstance> {
    return this.http.get<LabInstance>(`${this.url(hypervisorId, labId)}/instances/${instanceId}`, { context: this.context });
  }

  /** Démarre toutes les VM, routeurs d'abord. */
  startInstance(hypervisorId: string, labId: string, instanceId: string): Observable<LabInstance> {
    return this.http.post<LabInstance>(`${this.url(hypervisorId, labId)}/instances/${instanceId}/start`, null, { context: this.context });
  }

  /** Arrêt propre de toutes les VM (routeurs en dernier) ; `force` les coupe tout de suite. */
  stopInstance(hypervisorId: string, labId: string, instanceId: string, force = false): Observable<LabInstance> {
    const params: Record<string, string> = force ? { force: 'true' } : {};
    return this.http.post<LabInstance>(`${this.url(hypervisorId, labId)}/instances/${instanceId}/stop`, null, { params, context: this.context });
  }

  /** Supprime les VM, leurs disques et les réseaux internes de l'instance (409 pendant le déploiement). */
  deleteInstance(hypervisorId: string, labId: string, instanceId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId, labId)}/instances/${instanceId}`, { context: this.context });
  }

  /** Toutes mes instances, sur tous les hyperviseurs. */
  myInstances(): Observable<MyLabInstance[]> {
    return this.http.get<MyLabInstance[]>('/api/me/lab-instances', { context: this.context });
  }
}
