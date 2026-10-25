import { AccessLevel, TemplateRole, TemplateVisibility } from './template.model';

/**
 * Les labos (labs.rs de l'API) : plusieurs VM issues de templates, branchées sur plusieurs réseaux,
 * que l'on DÉPLOIE en INSTANCES. Chaque instance a ses propres réseaux internes et ses propres VM.
 */

/**
 * Un réseau de labo :
 *   'external' → un réseau libvirt QUI EXISTE DÉJÀ sur l'hyperviseur (NAT ou bridge vers Internet,
 *                par exemple `default`), partagé par toutes les instances
 *   'internal' → un réseau isolé, créé pour chaque instance (lab-<instance>-<nom>)
 */
export type LabNetworkKind = 'external' | 'internal';

/**
 * Le rôle d'une VM de labo :
 *   'vm'     → une VM ordinaire
 *   'router' → relie les réseaux du labo (OPNsense…) : créée et démarrée avant les autres
 */
export type LabVmRole = 'vm' | 'router';

/** L'état d'une instance : 'deploying' (réseaux et VM en création) → 'ready' ou 'failed' (voir `error`). */
export type LabInstanceStatus = 'deploying' | 'ready' | 'failed';

/** Comme pour un template : 'hypervisor' = aussi tous ceux qui ont l'accès à l'hyperviseur ; 'restricted' (par défaut) = seulement par les droits. */
export type LabVisibility = TemplateVisibility;

/** Comme pour un template : 'use' = déployer des instances et piloter les siennes ; 'manage' = aussi modifier le labo et piloter toutes ses instances. */
export type LabRole = TemplateRole;

/** Ce que l'utilisateur connecté peut faire d'un labo (tous ses droits combinés : le plus généreux l'emporte). */
export interface LabAccess {
  level: AccessLevel;
  /** Combien d'instances de ce labo il peut posséder ; null = sans limite. */
  max_instances: number | null;
  /** Combien il en possède déjà. */
  instance_count: number;
}

/** Un labo, tel que la liste le renvoie (sans ses réseaux ni ses VM). */
export interface Lab {
  id: string;
  hypervisor_id: string;
  name: string;
  description: string;
  visibility: LabVisibility;
  access: LabAccess;
  created_at: number;
  updated_at: number;
}

/** Un réseau de la définition du labo. */
export interface LabNetwork {
  id: string;
  name: string;
  kind: LabNetworkKind;
  /** Pour un réseau externe : le réseau libvirt qu'il désigne (null pour un réseau interne). */
  libvirt_network: string | null;
}

/** Une VM de la définition du labo. */
export interface LabVm {
  id: string;
  name: string;
  role: LabVmRole;
  template_id: string;
  template_name: string;
  /** null = la dernière version prête du template, au moment du déploiement. */
  version: number | null;
  memory_mb: number;
  vcpus: number;
  firmware: string;
  /** Les ids des réseaux du labo, une carte réseau chacun, DANS L'ORDRE (le premier = la première carte vue par la VM). */
  networks: string[];
}

/** Un labo avec ses réseaux et ses VM (routeurs d'abord). */
export interface LabDetail extends Lab {
  networks: LabNetwork[];
  vms: LabVm[];
}

/** Ce qu'on envoie pour créer un labo (admin seulement). */
export interface CreateLab {
  name: string;
  description?: string;
  /** Par défaut : 'restricted'. */
  visibility?: LabVisibility;
}

/** Ce qu'on envoie pour modifier un labo : les champs absents gardent leur valeur. `visibility` : admin seulement (403 sinon). */
export type UpdateLab = Partial<CreateLab>;

/** Ce qu'on envoie pour ajouter un réseau au labo. */
export interface CreateLabNetwork {
  /** De 1 à 32 lettres, chiffres, « - » ou « _ » (il entre dans le nom du réseau libvirt). */
  name: string;
  kind: LabNetworkKind;
  /** Obligatoire pour un réseau externe (un réseau libvirt de l'hyperviseur), interdit pour un interne. */
  libvirt_network?: string;
}

/** Ce qu'on envoie pour ajouter une VM au labo (POST) ou la remplacer (PUT : la VM entière). */
export interface LabVmBody {
  name: string;
  /** Par défaut : 'vm'. */
  role?: LabVmRole;
  /** Un template du même hyperviseur, que l'utilisateur a le droit d'utiliser. */
  template_id: string;
  /** null ou absent : la dernière version prête au moment du déploiement. */
  version?: number | null;
  memory_mb: number;
  vcpus: number;
  /** 'bios' (par défaut) ou 'uefi'. */
  firmware?: string;
  /** Les ids des réseaux du labo, dans l'ordre des cartes (8 au plus). Pour un OPNsense : le WAN d'abord. */
  networks: string[];
}

/** Un droit donné sur un labo (liste réservée aux administrateurs). */
export interface LabPermission {
  kind: 'user' | 'group';
  /** L'id de l'utilisateur ou du groupe. */
  id: string;
  /** Le nom d'utilisateur, ou le nom du groupe. */
  name: string;
  role: LabRole;
  /** Combien d'instances de ce labo CHAQUE utilisateur concerné peut posséder ; null = sans limite. */
  max_instances: number | null;
  /** Pour un utilisateur : les instances de ce labo qu'il possède. */
  instance_count?: number;
  created_at: number;
  updated_at: number;
}

/** Ce qu'on envoie pour donner ou changer un droit (PUT : remplace le droit existant). */
export interface SetLabPermission {
  /** Par défaut : 'use'. */
  role?: LabRole;
  /** Absent ou null : sans limite. */
  max_instances?: number | null;
}

/** Ce qu'on envoie pour déployer une instance. */
export interface CreateLabInstance {
  /** Par défaut : le nom du labo. */
  name?: string;
  /** Démarrer les VM une fois créées, routeurs d'abord (par défaut : non). */
  start?: boolean;
}

/** Un réseau d'une instance : le réseau libvirt qu'il est devenu sur l'hyperviseur. */
export interface LabInstanceNetwork {
  network_id: string;
  name: string;
  kind: LabNetworkKind;
  libvirt_network: string;
}

/** Une VM d'une instance. */
export interface LabInstanceVm {
  lab_vm_id: string;
  /** L'id de la VM : les routes et la page des VM marchent dessus (console, démarrer, arrêter). */
  vm_id: string;
  name: string;
  role: LabVmRole;
  /** 'running', 'stopped'… comme pour une VM ; 'missing' si elle a disparu de l'hyperviseur. */
  status: string;
  /** Les réseaux libvirt de ses cartes, dans l'ordre. */
  networks: string[];
}

/** Un labo déployé : ses réseaux et ses VM. */
export interface LabInstance {
  id: string;
  lab_id: string;
  lab_name: string;
  hypervisor_id: string;
  owner_id: string;
  /** Le nom d'utilisateur du propriétaire. */
  owner: string;
  name: string;
  status: LabInstanceStatus;
  /** Pourquoi le déploiement a raté. */
  error: string | null;
  created_at: number;
  networks: LabInstanceNetwork[];
  vms: LabInstanceVm[];
}

/** Une de MES instances, sur n'importe quel hyperviseur (GET /api/me/lab-instances). */
export interface MyLabInstance {
  id: string;
  name: string;
  status: LabInstanceStatus;
  lab_id: string;
  lab_name: string;
  hypervisor_id: string;
  created_at: number;
}

/** L'utilisateur connecté gère-t-il ce labo (droit 'manage', ou admin) ? */
export function canManageLab(lab: Lab): boolean {
  return lab.access.level === 'manage' || lab.access.level === 'admin';
}

/** A-t-il atteint la limite d'instances de ce labo (jamais pour un admin) ? */
export function labLimitReached(lab: Lab): boolean {
  const { level, max_instances, instance_count } = lab.access;
  return level !== 'admin' && max_instances !== null && instance_count >= max_instances;
}
