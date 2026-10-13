import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideContextDescriptors } from './config/context-descriptors';
import { provideErrorMapper } from './errors/error-mapper';
import { HypervisorApiErrorMapper } from './errors/hypervisor-api-error-mapper';
import { errorInterceptor } from './interceptors/error.interceptor';

/**
 * La configuration de l'application : ce qu'Angular met à disposition de
 * toutes les pages (le routeur, le client HTTP...), et le branchement du socle.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([errorInterceptor])),

    // Moteur d'erreurs : un mapper par API appelée.
    provideErrorMapper(HypervisorApiErrorMapper),

    // ContextBridgeService : comment recharger chaque type de donnée.
    provideContextDescriptors(),
  ],
};
