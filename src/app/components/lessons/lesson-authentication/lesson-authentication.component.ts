import { Component, inject, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { isAppError } from '@app/models/app-error.model';
import { AuthService } from '@app/services/auth.service';
import { LessonComponent } from '../lesson/lesson.component';

/** Leçon 18 (Avancé) : l'authentification, ses jetons, l'intercepteur et les gardes de routes. */
@Component({
  selector: 'app-lesson-authentication',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent],
  templateUrl: './lesson-authentication.component.html',
  styleUrl: './lesson-authentication.component.scss',
})
export class LessonAuthenticationComponent {
  protected readonly auth = inject(AuthService);

  readonly code = `// 1. app.config.ts : l'ORDRE des intercepteurs compte
provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]))
//   à l'aller : authInterceptor (ajoute le jeton) puis errorInterceptor
//   au retour : errorInterceptor (HttpErrorResponse → AppError) puis authInterceptor
//   donc authInterceptor reçoit des AppError : il lit leur code métier

// 2. auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);

  return next(withBearer(request, auth.token())).pipe(   // Authorization: Bearer <jeton>
    catchError((error) => {
      if (!isSessionExpired(error)) {
        return throwError(() => error);                  // une autre erreur : on la laisse passer
      }
      return auth.refresh().pipe(                        // UN nouveau jeton (partagé)
        switchMap((token) => next(withBearer(request, token))),   // puis on REJOUE la requête
      );
    }),
  );
};

// 3. AuthService.refresh : un refresh token ne sert QU'UNE FOIS
refresh(): Observable<string> {
  if (this.refreshing$) {
    return this.refreshing$;                             // un refresh est déjà parti : on attend le même
  }
  this.refreshing$ = this.http.post('/api/auth/refresh', { refresh_token }).pipe(
    tap((tokens) => this.storeTokens(tokens)),
    map((tokens) => tokens.access_token),
    finalize(() => (this.refreshing$ = null)),
    shareReplay({ bufferSize: 1, refCount: false }),     // dix requêtes, un seul appel
  );
  return this.refreshing$;
}

// 4. Un garde de route : true, ou l'adresse où rediriger
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthService).isLoggedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

// app.routes.ts
{ path: '', component: ShellComponent, canActivate: [authGuard], children: [ ... ] }
{ path: 'admin/users', canActivate: [adminGuard], loadComponent: ... }`;

  protected readonly journal = signal<string[]>([]);
  protected readonly busy = signal(false);

  /** GET /api/me : relit l'utilisateur. Lecture seule. */
  protected readMe(): void {
    this.busy.set(true);
    this.auth.loadMe().subscribe({
      next: (user) => {
        this.note('GET /api/me → ' + user.username + ' (' + user.role + ')');
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.note('GET /api/me → ' + (isAppError(error) ? error.title : 'échec'));
        this.busy.set(false);
      },
    });
  }

  /** Demande un nouveau jeton : l'ancien refresh token est détruit côté API, le nouveau le remplace dans le stockage. */
  protected forceRefresh(): void {
    this.busy.set(true);
    this.auth.refresh().subscribe({
      next: () => {
        this.note('POST /api/auth/refresh → nouvelle paire de jetons (l’ancien refresh token est détruit)');
        this.busy.set(false);
      },
      error: () => {
        this.note('refresh refusé : la session est terminée');
        this.busy.set(false);
      },
    });
  }

  /** On garde les 6 dernières lignes. */
  private note(line: string): void {
    this.journal.update((lines) => [...lines, line].slice(-6));
  }
}
