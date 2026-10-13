import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiMessage } from '../models/api-message.model';
import { CreateVm, VirtualMachine } from '../models/virtual-machine.model';
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

  start(hypervisorId: string, vmId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.url(hypervisorId)}/${vmId}/start`, null, { context: this.context });
  }

  stop(hypervisorId: string, vmId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.url(hypervisorId)}/${vmId}/stop`, null, { context: this.context });
  }

  clone(hypervisorId: string, vmId: string, body: CreateVm): Observable<VirtualMachine> {
    return this.http.post<VirtualMachine>(`${this.url(hypervisorId)}/${vmId}/clone`, body, { context: this.context });
  }

  delete(hypervisorId: string, vmId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(hypervisorId)}/${vmId}`, { context: this.context });
  }
}
