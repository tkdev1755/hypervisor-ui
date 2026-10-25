import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

import { AuthConfig, ChangePassword, Credentials, TokenResponse } from '../models/auth.model';
import { User } from '../models/user.model';
import { apiContext } from '../utils/api-context';
import { ResourceCacheService } from './resource-cache.service';
import { InventoryService } from './inventory.service';

/** Où le refresh token est gardé pour survivre à un rechargement de page (effacé à la fermeture de l'onglet). */
const REFRESH_KEY = 'hypervisor.refresh_token';

/**
 * AUTH SERVICE — la session de l'utilisateur connecté.
 *
 *   auth.login({ username, password }).subscribe(...)   se connecter
 *   auth.user()                                         l'utilisateur courant (un signal ; null = déconnecté)
 *   auth.isAdmin()                                      est-il administrateur ?
 *   auth.logout()                                       se déconnecter
 *
 * Les deux jetons de l'API :
 *  - access token : valable 15 minutes, envoyé à chaque requête (par auth.interceptor.ts).
 *    Gardé EN MÉMOIRE seulement : un script malveillant ne peut pas le lire dans le stockage du navigateur.
 *  - refresh token : valable 7 jours et À USAGE UNIQUE ; sert à obtenir une nouvelle paire.
 *    Gardé dans sessionStorage pour qu'un rechargement de la page (F5) ne déconnecte pas.
 *
 * Le rôle n'est pas dans la réponse de connexion : on appelle ensuite GET /api/me.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly resourceCache = inject(ResourceCacheService);
  private readonly inventory = inject(InventoryService);
  private readonly context = apiContext('hypervisor-api');

  private readonly accessToken = signal<string | null>(null);
  /** Le refresh en cours, partagé : un refresh token ne sert qu'une fois, il ne faut jamais en lancer deux. */
  private refreshing$: Observable<string> | null = null;

  /** L'utilisateur connecté, avec son quota et sa consommation. */
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  /** Le jeton à mettre dans l'en-tête Authorization (lu par l'intercepteur). */
  token(): string | null {
    return this.accessToken();
  }

  hasRefreshToken(): boolean {
    return this.readRefreshToken() !== null;
  }

  /** POST /api/auth/login, puis GET /api/me pour connaître le rôle. */
  login(credentials: Credentials): Observable<User> {
    return this.http.post<TokenResponse>('/api/auth/login', credentials, { context: this.context }).pipe(
      tap((tokens) => this.storeTokens(tokens)),
      switchMap(() => this.loadMe()),
    );
  }

  /** POST /api/auth/register : seulement si l'admin a ouvert les inscriptions. On connecte ensuite le nouvel utilisateur. */
  register(credentials: Credentials): Observable<User> {
    return this.http
      .post<unknown>('/api/auth/register', credentials, { context: this.context })
      .pipe(switchMap(() => this.login(credentials)));
  }

  /** GET /api/auth/config (public) : faut-il proposer « Créer un compte » ? */
  config(): Observable<AuthConfig> {
    return this.http.get<AuthConfig>('/api/auth/config', { context: this.context });
  }

  /** GET /api/me : relit l'utilisateur (à faire après un changement de quota ou de VM pour rafraîchir la consommation). */
  loadMe(): Observable<User> {
    return this.http.get<User>('/api/me', { context: this.context }).pipe(tap((user) => this.user.set(user)));
  }

  /** Relit l'utilisateur en silence, pour mettre à jour sa consommation de quota (après création, clonage, suppression de VM). */
  refreshUsage(): void {
    this.loadMe().subscribe({ error: () => undefined });
  }

  /**
   * PUT /api/me/password. L'API ferme ensuite TOUTES les sessions du compte, la nôtre comprise :
   * on se reconnecte tout de suite avec le nouveau mot de passe.
   */
  changePassword(body: ChangePassword): Observable<User> {
    const username = this.user()?.username ?? '';
    return this.http
      .put<void>('/api/me/password', body, { context: this.context })
      .pipe(switchMap(() => this.login({ username, password: body.new_password })));
  }

  /**
   * Obtient un nouvel access token avec le refresh token. Appelée par l'intercepteur sur un 401.
   * Si plusieurs requêtes échouent en même temps, elles partagent UN SEUL refresh.
   */
  refresh(): Observable<string> {
    if (this.refreshing$) {
      return this.refreshing$;
    }
    const refreshToken = this.readRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Aucun refresh token.'));
    }
    this.refreshing$ = this.http
      .post<TokenResponse>('/api/auth/refresh', { refresh_token: refreshToken }, { context: this.context })
      .pipe(
        tap((tokens) => this.storeTokens(tokens)),
        map((tokens) => tokens.access_token),
        finalize(() => (this.refreshing$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshing$;
  }

  /** Au démarrage de l'application : si un refresh token est gardé, on rouvre la session sans redemander le mot de passe. */
  restore(): Observable<unknown> {
    if (!this.hasRefreshToken()) {
      return of(null);
    }
    return this.refresh().pipe(
      switchMap(() => this.loadMe()),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  /** Déconnexion volontaire : on révoque le refresh token côté API (sans attendre la réponse), puis on retourne à /login. */
  logout(): void {
    const refreshToken = this.readRefreshToken();
    if (refreshToken) {
      this.http
        .post<void>('/api/auth/logout', { refresh_token: refreshToken }, { context: this.context })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  /** La session n'est plus valide (refresh refusé, compte désactivé...) : retour à /login avec un message. */
  expireSession(): void {
    const returnUrl = this.router.url;
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: { expired: 1, ...(!returnUrl.startsWith('/login') ? { returnUrl } : {}) } });
  }

  /** Oublie tout : jetons, utilisateur, et les données en cache qui dépendent des droits de l'utilisateur précédent. */
  private clearSession(): void {
    this.accessToken.set(null);
    this.user.set(null);
    this.refreshing$ = null;
    try {
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      // Stockage indisponible (navigation privée stricte) : rien à effacer.
    }
    // Un hyperviseur gardé en cache montre son URI à un admin : il ne doit pas être revu par le prochain utilisateur.
    this.resourceCache.invalidate('hypervisor');
    this.inventory.clear();
  }

  private storeTokens(tokens: TokenResponse): void {
    this.accessToken.set(tokens.access_token);
    try {
      sessionStorage.setItem(REFRESH_KEY, tokens.refresh_token);
    } catch {
      // Sans stockage, la session ne survit pas à un rechargement : acceptable.
    }
  }

  private readRefreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  }
}
