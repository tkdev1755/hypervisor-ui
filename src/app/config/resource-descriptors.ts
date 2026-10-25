import { Provider, inject } from '@angular/core';

import { HypervisorService } from '../services/hypervisor.service';
import { provideContextDescriptor } from '../services/context-bridge.service';

/**
 * Apprend au ContextBridgeService à recharger chaque type de donnée depuis
 * l'API quand il n'est pas en cache. Enregistré dans app.config.ts.
 */
export function provideContextDescriptors(): Provider[] {
  return [
    provideContextDescriptor(() => {
      const hypervisors = inject(HypervisorService);
      return { type: 'hypervisor', fetch: (id: string) => hypervisors.get(id) };
    }),
  ];
}
