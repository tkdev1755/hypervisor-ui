/**
 * Les types des hyperviseurs, recopiés de l'API Rust (src/models.rs).
 * Si l'API change un champ, on le change ici : TypeScript signalera alors
 * tous les endroits du front à adapter.
 */

/** Un « type union » : la valeur ne peut être QUE l'une de ces deux chaînes. */
export type HypervisorStatus = 'connected' | 'disconnected';

/** Une machine physique qui fait tourner des VM (KVM / libvirt). */
export interface Hypervisor {
  id: string;
  name: string;
  /** L'adresse libvirt, par exemple qemu:///system ou qemu+ssh://admin@serveur/system */
  uri: string;
  status: HypervisorStatus;
}

/** Ce qu'on envoie pour créer un hyperviseur. */
export interface CreateHypervisor {
  name: string;
  uri: string;
}

/** Pour une modification, chaque champ est facultatif (Partial = tous les champs deviennent optionnels). */
export type UpdateHypervisor = Partial<CreateHypervisor>;
