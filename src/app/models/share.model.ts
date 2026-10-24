/** Le prêt de VM et l'accès aux hyperviseurs (OpenAPI : ShareView, CreateShare, AccessEntry). */

/** Un emprunteur d'une VM. */
export interface Share {
  user_id: string;
  username: string;
  created_at: number;
  /** Date de fin du prêt (secondes Unix) ; `null` = jusqu'à révocation. */
  expires_at: number | null;
}

/** Ce qu'on envoie pour prêter une VM : le nom EXACT de l'emprunteur. */
export interface CreateShare {
  username: string;
  expires_at?: number;
}

/** Un utilisateur autorisé à créer des VM sur un hyperviseur. */
export interface AccessEntry {
  user_id: string;
  username: string;
  created_at: number;
}
