import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideResourceDescriptors } from './config/resource-descriptors';
import { provideErrorMapper } from './errors/error-mapper';
import { HypervisorApiErrorMapper } from './errors/hypervisor-api-error-mapper';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { AuthService } from './services/auth.service';

/**
 * La configuration de l'application : ce qu'Angular met à disposition de
 * toutes les pages (le routeur, le client HTTP...), et le branchement du socle.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // L'ordre compte : authInterceptor est AVANT errorInterceptor, donc il reçoit les erreurs déjà
    // transformées en AppError (voir les commentaires de auth.interceptor.ts).
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),

    // Avant le premier affichage : rouvrir la session si un refresh token est gardé (rechargement de la page).
    provideAppInitializer(() => inject(AuthService).restore()),

    // Moteur d'erreurs : un mapper par API appelée.
    provideErrorMapper(HypervisorApiErrorMapper),

    // ResourceCacheService : comment recharger chaque type de donnée.
    provideResourceDescriptors(),
  ],
};
