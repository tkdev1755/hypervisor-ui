/**
 * Les comptes, recopiés de l'API Rust (src/users.rs, OpenAPI : UserView, Quota, Usage).
 * Les dates sont des secondes Unix (des nombres entiers).
 */

/** Les deux rôles : l'admin gère tout, l'utilisateur ne voit que ses VM et celles qu'on lui prête. */
export type Role = 'admin' | 'user';

/** Les limites d'un utilisateur. `null` = illimité. */
export interface Quota {
  max_vms: number | null;
  max_vcpus: number | null;
  max_memory_mb: number | null;
  max_disk_gb: number | null;
}

/** Ce que l'utilisateur consomme actuellement. */
export interface Usage {
  vms: number;
  vcpus: number;
  memory_mb: number;
  disk_gb: number;
}

/** Un compte : renvoyé par `GET /api/me` (le sien) et `GET /api/users` (tous, admin seulement). */
export interface User {
  id: string;
  username: string;
  role: Role;
  disabled: boolean;
  created_at: number;
  quota: Quota;
  usage: Usage;
}

/** Ce qu'un admin envoie pour créer un compte. Sans `role`, le compte est un `user`. */
export interface CreateUser {
  username: string;
  password: string;
  role?: Role;
}

/** Modifier un compte : chaque champ est facultatif. */
export type UpdateUser = Partial<Pick<User, 'role' | 'disabled'>>;
