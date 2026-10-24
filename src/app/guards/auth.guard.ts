import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Un « garde » décide si le routeur a le droit d'afficher une page.
 * Il renvoie true (c'est permis) ou une redirection (l'adresse où envoyer l'utilisateur).
 *
 *   { path: 'hypervisors', canActivate: [authGuard], ... }
 */

/** Il faut être connecté. Sinon : page de connexion, qui ramènera ici ensuite (returnUrl). */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthService).isLoggedIn() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Il faut être administrateur. Sinon : retour à l'accueil. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).isAdmin() ? true : router.createUrlTree(['/']);
};
