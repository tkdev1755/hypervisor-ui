/**
 * Les groupes d'utilisateurs (voir src/groups.rs de l'API). Un groupe contient des utilisateurs et
 * d'autres groupes (sous-groupes) ; un utilisateur ou un groupe peut être dans plusieurs groupes.
 * L'API refuse les cycles : un groupe ne peut jamais se retrouver dans lui-même.
 * Les groupes ne donnent encore aucun droit. Seuls les administrateurs les voient et les gèrent.
 */

/** Un groupe, tel que la liste le renvoie (admin seulement). */
export interface Group {
  id: string;
  name: string;
  description: string;
  /** Le nombre d'utilisateurs directement dans le groupe. */
  member_count: number;
  /** Le nombre de groupes directement dans le groupe. */
  subgroup_count: number;
  /** Dates en secondes depuis 1970 (timestamp Unix). */
  created_at: number;
  updated_at: number;
}

/** Un utilisateur directement dans un groupe. */
export interface GroupMember {
  user_id: string;
  username: string;
  added_at: number;
}

/** Un groupe cité par un autre (sous-groupe, ou groupe parent). */
export interface GroupRef {
  id: string;
  name: string;
  added_at: number;
}

/** Un groupe avec son contenu direct, et les groupes qui le contiennent directement (admin seulement). */
export interface GroupDetail {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
  members: GroupMember[];
  subgroups: GroupRef[];
  /** Les groupes dans lesquels ce groupe est directement. */
  parents: GroupRef[];
}

/** Un utilisateur d'un groupe, sous-groupes compris. */
export interface EffectiveMember {
  user_id: string;
  username: string;
  /** Vrai s'il est dans le groupe lui-même, faux s'il n'y est que par un sous-groupe. */
  direct: boolean;
}

/** Un groupe auquel un utilisateur appartient (GET /api/me/groups, ou /api/users/{id}/groups pour un admin). */
export interface UserGroup {
  id: string;
  name: string;
  description: string;
  /** Vrai s'il est dans le groupe lui-même, faux s'il n'y est que par un groupe imbriqué. */
  direct: boolean;
}

/** Ce qu'on envoie pour créer un groupe. */
export interface CreateGroup {
  name: string;
  description?: string;
}

/** Ce qu'on envoie pour modifier un groupe : les champs absents gardent leur valeur. */
export type UpdateGroup = Partial<CreateGroup>;
