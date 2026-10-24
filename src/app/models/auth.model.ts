/** Les échanges de connexion, recopiés de l'API Rust (src/auth.rs, OpenAPI : LoginRequest, TokenResponse). */

/** Ce qu'on envoie pour se connecter ou s'inscrire. */
export interface Credentials {
  username: string;
  password: string;
}

/**
 * La réponse de `POST /api/auth/login` et `POST /api/auth/refresh`.
 * Le rôle n'y figure pas : on le lit avec `GET /api/me`.
 */
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  /** Durée de vie de l'access token, en secondes (900 = 15 minutes). */
  expires_in: number;
  refresh_token: string;
}

/** `GET /api/auth/config` (public) : peut-on créer un compte soi-même ? */
export interface AuthConfig {
  registration_open: boolean;
}

/** `PUT /api/me/password`. */
export interface ChangePassword {
  current_password: string;
  new_password: string;
}
