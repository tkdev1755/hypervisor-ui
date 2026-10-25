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
 * Qui peut utiliser un template, en plus de ceux qui ont un droit dessus (voir TemplatePermission) :
 *   'hypervisor' → aussi tous les utilisateurs qui ont l'accès à l'hyperviseur, sans limite (par défaut)
 *   'restricted' → seulement ceux qui ont un droit
 */
export type TemplateVisibility = 'hypervisor' | 'restricted';

/**
 * Un droit sur un template, donné à un utilisateur ou à un groupe (donc à tous ses membres,
 * groupes imbriqués compris) :
 *   'use'    → voir ses versions prêtes et créer des VM à partir d'elles
 *   'manage' → aussi le modifier, l'activer ou le désactiver, le reconstruire, arrêter une construction,
 *              lire les journaux et supprimer des versions. Attention : une configuration Packer exécute
 *              des commandes sur la machine qui construit ; donner 'manage', c'est lui confier cette machine.
 */
export type TemplateRole = 'use' | 'manage';

/** Ce que l'utilisateur connecté peut faire d'un template : 'use', 'manage', ou 'admin' (tout). */
export type AccessLevel = 'use' | 'manage' | 'admin';

/** Les droits de l'utilisateur connecté sur un template (tous ses droits combinés : le plus généreux l'emporte). */
export interface TemplateAccess {
  level: AccessLevel;
  /** Combien de VM créées à partir de ce template il peut posséder ; null = sans limite. */
  max_vms: number | null;
  /** Combien il en possède déjà. */
  vm_count: number;
}

/** Un droit donné sur un template (liste réservée aux administrateurs). */
export interface TemplatePermission {
  kind: 'user' | 'group';
  /** L'id de l'utilisateur ou du groupe. */
  id: string;
  /** Le nom d'utilisateur, ou le nom du groupe. */
  name: string;
  role: TemplateRole;
  /** Combien de VM de ce template CHAQUE utilisateur concerné peut posséder ; null = sans limite. */
  max_vms: number | null;
  /** Pour un utilisateur : les VM de ce template qu'il possède. */
  vm_count?: number;
  created_at: number;
  updated_at: number;
}

/** Ce qu'on envoie pour donner ou changer un droit (PUT : remplace le droit existant). */
export interface SetPermission {
  /** Par défaut : 'use'. */
  role?: TemplateRole;
  /** Absent ou null : sans limite. */
  max_vms?: number | null;
}

/** Une construction d'un template : son disque, son état, ses dates. */
export interface TemplateVersion {
  template_id: string;
  /** Le numéro de la version : 1, 2, 3… */
  version: number;
  /** La configuration utilisée pour cette version (gestionnaires et admins seulement). */
  packer_config?: string;
  disk_name: string;
  pool: string;
  /** Le volume libvirt qui garde le disque construit (template-<nom>-v<version>.qcow2). */
  volume: string;
  status: TemplateStatus;
  /** La taille du disque, une fois construit. */
  disk_size_gb?: number | null;
  /** Pourquoi la construction a raté : la fin de sa sortie (gestionnaires et admins seulement). */
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
  /** La configuration actuelle (gestionnaires et admins seulement) : modifiée par PATCH, utilisée par la prochaine construction. */
  packer_config?: string;
  /** Le nom du fichier disque que Packer écrit (`vm_name` du builder qemu). */
  disk_name: string;
  /** Le pool qui reçoit les disques construits. */
  pool: string;
  visibility: TemplateVisibility;
  /**
   * Le template est-il activé ? Désactivé (false), PERSONNE ne peut créer de VM à partir de lui,
   * administrateurs compris (409). L'API le liste quand même : c'est l'interface qui le cache aux utilisateurs.
   */
  allow_vm_creation: boolean;
  /** Ce que l'utilisateur connecté peut en faire. */
  access: TemplateAccess;
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
  /** Activer le template, c'est-à-dire autoriser la création de VM (par défaut : true). */
  allow_vm_creation?: boolean;
}

/**
 * Ce qu'on envoie pour modifier un template : les champs absents gardent leur valeur. Reconstruire pour l'appliquer.
 * `visibility` est réservé aux admins : un gestionnaire ne doit pas l'envoyer (403 sinon).
 */
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
 * Un morceau du journal d'une construction (gestionnaires et admins seulement). Pendant la construction, on le
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

/** L'utilisateur connecté gère-t-il ce template (droit 'manage', ou admin) ? */
export function canManageTemplate(template: Template): boolean {
  return template.access.level === 'manage' || template.access.level === 'admin';
}

/** A-t-il atteint la limite de VM de ce template (jamais pour un admin) ? */
export function templateLimitReached(template: Template): boolean {
  const { level, max_vms, vm_count } = template.access;
  return level !== 'admin' && max_vms !== null && vm_count >= max_vms;
}

/** Une construction est-elle en cours (en attente, en cours ou en train de s'arrêter) ? */
export function isBuilding(status: TemplateStatus | null | undefined): boolean {
  return status === 'pending' || status === 'in_progress' || status === 'stopping';
}
