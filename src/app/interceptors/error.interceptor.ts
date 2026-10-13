import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ERROR_MAPPERS } from '../errors/error-mapper';
import { AppError, ErrorOrigin } from '../models/app-error.model';
import { API_CONTEXT } from '../utils/api-context';

/**
 * Un intercepteur voit passer TOUTES les requêtes HTTP de l'application.
 * Quand une requête échoue, celui-ci lit l'étiquette API_CONTEXT, choisit le
 * mapper de cette API, et renvoie une AppError à la place de l'erreur brute.
 *
 * Résultat : dans un composant, l'erreur reçue est toujours une AppError,
 * prête à être affichée par <app-error-panel [error]="error" />.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const mappers = inject(ERROR_MAPPERS, { optional: true }) ?? [];

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const api = request.context.get(API_CONTEXT);
      const origin: ErrorOrigin = {
        api: api ?? 'unknown',
        method: request.method,
        endpoint: request.urlWithParams,
        status: error.status,
      };
      const mapper = mappers.find((candidate) => candidate.api === api);
      const appError: AppError = mapper
        ? mapper.map(error, origin)
        : { kind: 'technical', ...origin, title: 'Erreur réseau', message: 'La requête a échoué.', detail: error.message, occurredAt: new Date() };
      return throwError(() => appError);
    }),
  );
};
