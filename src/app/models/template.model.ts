/**
 * L'état d'une version de template (chaque construction par Packer crée une nouvelle version) :
 *   'pending'     → en attente d'une place (deux constructions au plus en même temps sur l'API)
 *   'in_progress' → Packer installe le système
 *   'stopping'    → un administrateur a demandé l'arrêt : Packer fait le ménage
 *   'created'     → prête : on peut créer des VM à partir d'elle
 *   'failed'      → ratée (`error` garde la fin de la sortie, admin seulement)
 *   'cancelled'   → arrêtée par un administrateur
 */
export type TemplateStatus = 'pending' | 'in_progress' | 'stopping' | 'created' | 'failed' | 'cancelled';

/**
 * Qui peut utiliser un template (les administrateurs le peuvent toujours) :
 *   'hypervisor' → tous les utilisateurs qui ont l'accès à l'hyperviseur (par défaut)
 *   'restricted' → seulement les utilisateurs listés dans ses accès (qui ont aussi l'accès à l'hyperviseur)
 */
export type TemplateVisibility = 'hypervisor' | 'restricted';

/** Une construction d'un template : son disque, son état, ses dates. */
export interface TemplateVersion {
  template_id: string;
  /** Le numéro de la version : 1, 2, 3… */
  version: number;
  /** La configuration utilisée pour cette version (admin seulement). */
  packer_config?: string;
  disk_name: string;
  pool: string;
  /** Le volume libvirt qui garde le disque construit (template-<nom>-v<version>.qcow2). */
  volume: string;
  status: TemplateStatus;
  /** La taille du disque, une fois construit. */
  disk_size_gb?: number | null;
  /** Pourquoi la construction a raté : la fin de sa sortie (admin seulement). */
  error?: string | null;
  /** Dates en secondes depuis 1970 (timestamp Unix). */
  created_at: number;
  started_at?: number | null;
  finished_at?: number | null;
}

/**
 * Un template : une définition modifiable (configuration Packer, nom du disque, pool) et ses versions.
 * On peut le reconstruire (après une modification, ou pour les mises à jour) pendant que les VM
 * continuent d'être créées à partir de sa dernière version réussie.
 */
export interface Template {
  id: string;
  hypervisor_id: string;
  name: string;
  /** La configuration actuelle (admin seulement) : modifiée par PATCH, utilisée par la prochaine construction. */
  packer_config?: string;
  /** Le nom du fichier disque que Packer écrit (`vm_name` du builder qemu). */
  disk_name: string;
  /** Le pool qui reçoit les disques construits. */
  pool: string;
  visibility: TemplateVisibility;
  /** L'état de la dernière version (pour un utilisateur : de la dernière version prête). */
  status?: TemplateStatus | null;
  /** La version utilisée par défaut pour créer une VM : la dernière prête ; null s'il n'y en a aucune. */
  default_version?: number | null;
  latest_version?: TemplateVersion | null;
  created_at: number;
  updated_at: number;
}

/** Ce qu'on envoie pour créer un template (admin seulement) : sa version 1 est construite tout de suite. */
export interface CreateTemplate {
  name: string;
  packer_config: string;
  disk_name: string;
  /** Le pool qui recevra les disques (par défaut : `default`). */
  pool?: string;
  /** Par défaut : 'hypervisor'. */
  visibility?: TemplateVisibility;
}

/** Ce qu'on envoie pour modifier un template : les champs absents gardent leur valeur. Reconstruire pour l'appliquer. */
export type UpdateTemplate = Partial<CreateTemplate>;

/** Ce qu'on envoie pour créer une VM à partir d'un template : son disque sera une copie de celui de la version. */
export interface CreateVmFromTemplate {
  name: string;
  memory_mb: number;
  vcpus: number;
  /** La version prête à utiliser (par défaut : la dernière prête). */
  version?: number;
  network?: string;
  /** 'bios' (par défaut) ou 'uefi' : doit correspondre à la façon dont le template a été installé. */
  firmware?: string;
  start?: boolean;
  /** Admin seulement : l'id de l'utilisateur à qui la VM appartiendra. */
  owner_id?: string;
}

/**
 * Un morceau du journal d'une construction (admin seulement). Pendant la construction, on le
 * relit régulièrement en passant `next_offset` comme `offset` : on ne reçoit alors que la suite.
 */
export interface BuildLog {
  template_id: string;
  version: number;
  status: TemplateStatus;
  /** Vrai une fois la construction terminée : le journal ne grandira plus. */
  finished: boolean;
  offset: number;
  next_offset: number;
  content: string;
  /** La sortie a dépassé la limite (2 Mo) : sa fin n'a pas été gardée (voir `error` de la version). */
  truncated: boolean;
}

/** Un utilisateur autorisé à utiliser un template restreint. */
export interface TemplateAccessEntry {
  user_id: string;
  username: string;
  created_at: number;
}

/** Une construction est-elle en cours (en attente, en cours ou en train de s'arrêter) ? */
export function isBuilding(status: TemplateStatus | null | undefined): boolean {
  return status === 'pending' || status === 'in_progress' || status === 'stopping';
}
