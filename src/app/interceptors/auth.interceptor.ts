import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { isAppError } from '../models/app-error.model';
import { AuthService } from '../services/auth.service';

/**
 * Cet intercepteur gère le jeton de connexion de TOUTES les requêtes :
 *
 *  1. il ajoute « Authorization: Bearer <jeton> » aux appels /api
 *     (sauf /api/auth/* : se connecter, se rafraîchir, s'inscrire ne demandent pas de jeton) ;
 *  2. si l'API répond 401 « session expirée » (jeton expiré), il demande un nouveau jeton (UN seul refresh à la fois,
 *     même si dix requêtes échouent ensemble), puis rejoue la requête UNE fois ;
 *  3. si le refresh échoue, ou si la requête rejouée échoue encore en 401, la session est terminée :
 *     retour à la page de connexion.
 *
 * Il est placé AVANT errorInterceptor dans app.config.ts. Les erreurs HTTP qu'il reçoit
 * sont donc déjà des AppError. On regarde leur code métier plutôt que le seul statut 401 :
 * un 401 sur « changer mon mot de passe » veut dire « l'ancien mot de passe est faux », pas « jeton expiré »
 * (le mapper d'erreurs fait la différence).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);

  if (!isProtected(request)) {
    return next(request);
  }

  return next(withBearer(request, auth.token())).pipe(
    catchError((error: unknown) => {
      if (!isSessionExpired(error)) {
        return throwError(() => error);
      }
      if (!auth.hasRefreshToken()) {
        auth.expireSession();
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError(() => {
          auth.expireSession();
          return throwError(() => error);
        }),
        switchMap((token) =>
          next(withBearer(request, token)).pipe(
            catchError((retryError: unknown) => {
              if (isSessionExpired(retryError)) {
                auth.expireSession();
              }
              return throwError(() => retryError);
            }),
          ),
        ),
      );
    }),
  );
};

/** Un 401 qui signifie « jeton absent, expiré, ou compte désactivé » (voir HypervisorApiErrorMapper). */
function isSessionExpired(error: unknown): boolean {
  return isAppError(error) && error.kind === 'business' && error.code === 'SESSION_EXPIRED';
}

/** Une route de l'API qui demande un jeton. */
function isProtected(request: HttpRequest<unknown>): boolean {
  return request.url.startsWith('/api/') && !request.url.startsWith('/api/auth/');
}

function withBearer(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}
