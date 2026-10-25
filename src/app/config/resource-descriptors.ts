import { Provider, inject } from '@angular/core';

import { HypervisorService } from '../services/hypervisor.service';
import { provideResourceDescriptor } from '../services/resource-cache.service';

/**
 * Apprend au ResourceCacheService à recharger chaque type de donnée depuis
 * l'API quand il n'est pas en cache. Enregistré dans app.config.ts.
 */
export function provideResourceDescriptors(): Provider[] {
  return [
    provideResourceDescriptor(() => {
      const hypervisors = inject(HypervisorService);
      return { type: 'hypervisor', fetch: (id: string) => hypervisors.get(id) };
    }),
  ];
}
