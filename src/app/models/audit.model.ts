/** Le journal d'audit et les paramètres (admin seulement ; OpenAPI : AuditEntry, Settings). */

/** Une ligne du journal : qui a fait quoi, quand, et si ça a réussi. */
export interface AuditEntry {
  id: number;
  /** Secondes Unix. */
  at: number;
  /** Par exemple `auth.login`, `vm.create`, `vm.start`, `user.create`, `hypervisor.grant`. */
  action: string;
  success: boolean;
  user_id: string | null;
  username: string | null;
  /** Sur quoi (une VM, un compte...). */
  target: string | null;
  detail: string | null;
}

/** Les filtres de `GET /api/audit` (tous facultatifs). */
export interface AuditFilter {
  limit?: number;
  offset?: number;
  user_id?: string;
  action?: string;
}

/** `GET` / `PUT /api/settings`. */
export interface Settings {
  registration_open: boolean;
}
