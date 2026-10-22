import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Disk, DiskRequest } from '../models/disk.model';
import { Network, NetworkRequest } from '../models/network.model';
import { apiContext } from '../utils/api-context';

/** Les routes disques et réseaux d'un hyperviseur. */
@Injectable({ providedIn: 'root' })
export class InfrastructureService {
  private readonly http = inject(HttpClient);
  private readonly context = apiContext('hypervisor-api');

  listDisks(hypervisorId: string): Observable<Disk[]> {
    return this.http.get<Disk[]>(`/api/hypervisors/${hypervisorId}/disks`, { context: this.context });
  }

  createDisk(hypervisorId: string, body: DiskRequest): Observable<Disk> {
    return this.http.post<Disk>(`/api/hypervisors/${hypervisorId}/disks`, body, { context: this.context });
  }

  updateDisk(hypervisorId: string, diskId: string, body: DiskRequest): Observable<Disk> {
    return this.http.patch<Disk>(`/api/hypervisors/${hypervisorId}/disks/${diskId}`, body, { context: this.context });
  }

  deleteDisk(hypervisorId: string, diskId: string): Observable<void> {
    return this.http.delete<void>(`/api/hypervisors/${hypervisorId}/disks/${diskId}`, { context: this.context });
  }

  listNetworks(hypervisorId: string): Observable<Network[]> {
    return this.http.get<Network[]>(`/api/hypervisors/${hypervisorId}/networks`, { context: this.context });
  }

  createNetwork(hypervisorId: string, body: NetworkRequest): Observable<Network> {
    return this.http.post<Network>(`/api/hypervisors/${hypervisorId}/networks`, body, { context: this.context });
  }

  deleteNetwork(hypervisorId: string, networkId: string): Observable<void> {
    return this.http.delete<void>(`/api/hypervisors/${hypervisorId}/networks/${networkId}`, { context: this.context });
  }
}
