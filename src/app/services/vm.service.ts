import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Job } from '../models/job.model';
import { VmOptions } from '../models/vm-options.model';
import { VncResponse } from '../models/vnc.model';
import { CloneVm, CreateVm, VirtualMachine } from '../models/virtual-machine.model';
import { apiContext } from '../utils/api-context';

/** Les routes des machines virtuelles d'un hyperviseur. */
@Injectable({ providedIn: 'root' })
export class VmService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  private url(hypervisorId: string): string {
    return `/api/hypervisors/${hypervisorId}/vms`;
  }

  list(hypervisorId: string): Observable<VirtualMachine[]> {
    return this.http.get<VirtualMachine[]>(this.url(hypervisorId), { context: this.context });
  }

  get(hypervisorId: string, vmId: string): Observable<VirtualMachine> {
    return this.http.get<VirtualMachine>(`${this.url(hypervisorId)}/${vmId}`, { context: this.context });
  }

  create(hypervisorId: string, body: CreateVm): Observable<VirtualMachine> {
    return this.http.post<VirtualMachine>(this.url(hypervisorId), body, { context: this.context });
  }

  /** Les choix possibles pour créer une VM (pools, réseaux, limites, valeurs par défaut). */
  options(hypervisorId: string): Observable<VmOptions> {
    return this.http.get<VmOptions>(`/api/hypervisors/${hypervisorId}/vm-options`, { context: this.context });
  }

  start(hypervisorId: string, vmId: string): Observable<VirtualMachine> {
    return this.http.post<VirtualMachine>(`${this.url(hypervisorId)}/${vmId}/start`, null, { context: this.context });
  }

  /** Arrêt ACPI (la VM peut mettre du temps à s'éteindre) ; `force` coupe l'alimentation tout de suite. */
  stop(hypervisorId: string, vmId: string, force = false): Observable<VirtualMachine> {
    const params: Record<string, string> = force ? { force: 'true' } : {};
    return this.http.post<VirtualMachine>(`${this.url(hypervisorId)}/${vmId}/stop`, null, { params, context: this.context });
  }

  /** Le clonage est asynchrone : l'API répond 202 avec une tâche à suivre (JobService.watch). */
  clone(hypervisorId: string, vmId: string, body: CloneVm): Observable<Job> {
    return this.http.post<Job>(`${this.url(hypervisorId)}/${vmId}/clone`, body, { context: this.context });
  }

  /** Supprime une VM arrêtée ; `deleteDisks` supprime aussi ses volumes. */
  delete(hypervisorId: string, vmId: string, deleteDisks = false): Observable<void> {
    const params: Record<string, string> = deleteDisks ? { delete_disks: 'true' } : {};
    return this.http.delete<void>(`${this.url(hypervisorId)}/${vmId}`, { params, context: this.context });
  }

  /** Changer le propriétaire d'une VM (admin seulement). Une VM créée hors de l'API reçoit ainsi son propriétaire. */
  setOwner(hypervisorId: string, vmId: string, ownerId: string): Observable<VirtualMachine> {
    return this.http.put<VirtualMachine>(`${this.url(hypervisorId)}/${vmId}/owner`, { owner_id: ownerId }, { context: this.context });
  }

  /** De quoi ouvrir la console VNC d'une VM en marche (le jeton de l'adresse expire au bout de 2 minutes). */
  vnc(hypervisorId: string, vmId: string): Observable<VncResponse> {
    return this.http.get<VncResponse>(`${this.url(hypervisorId)}/${vmId}/vnc`, { context: this.context });
  }
}
