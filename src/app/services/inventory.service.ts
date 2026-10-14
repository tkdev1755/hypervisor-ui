import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { Hypervisor } from '../models/hypervisor.model';
import { VirtualMachine } from '../models/virtual-machine.model';
import { HypervisorService } from './hypervisor.service';
import { VmService } from './vm.service';

/**
 * L'inventaire : tous les hyperviseurs et leurs VM, pour la barre latérale.
 *
 * Les pages qui créent, modifient ou suppriment quelque chose appellent
 * `refresh()` ensuite : la barre latérale se met alors à jour toute seule,
 * car elle lit ces signals.
 */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly hypervisorService = inject(HypervisorService);
  private readonly vmService = inject(VmService);

  readonly hypervisors = signal<Hypervisor[]>([]);
  /** Les VM de chaque hyperviseur, rangées par id d'hyperviseur. */
  readonly vms = signal<Record<string, VirtualMachine[]>>({});
  readonly loading = signal(false);

  refresh(): void {
    this.loading.set(true);
    this.hypervisorService
      .list()
      .pipe(
        switchMap((hypervisors) => {
          this.hypervisors.set(hypervisors);
          // Un hyperviseur injoignable (ou une erreur) donne simplement zéro VM.
          const requests = hypervisors.map((h) =>
            h.status === 'connected' ? this.vmService.list(h.id).pipe(catchError(() => of([] as VirtualMachine[]))) : of([] as VirtualMachine[]),
          );
          return requests.length ? forkJoin(requests) : of([] as VirtualMachine[][]);
        }),
        catchError(() => of(null)),
      )
      .subscribe((lists) => {
        if (lists) {
          const byHypervisor: Record<string, VirtualMachine[]> = {};
          this.hypervisors().forEach((h, i) => (byHypervisor[h.id] = lists[i]));
          this.vms.set(byHypervisor);
        }
        this.loading.set(false);
      });
  }
}
