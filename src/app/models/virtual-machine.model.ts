/** Une machine virtuelle, telle que l'API la renvoie. */
export interface VirtualMachine {
  id: string;
  hypervisor_id: string;
  name: string;
  memory_mb: number;
  vcpus: number;
  status: string;
}

/** Un volume désigné par son pool et son nom (jamais par un chemin). */
export interface VolumeRef {
  pool: string;
  volume: string;
}

/** Un disque de VM : neuf (`size_gb`) ou existant (`volume`). */
export interface DiskSpec {
  pool: string;
  size_gb?: number;
  volume?: string;
}

/** Ce qu'on envoie pour créer une VM (voir `GET .../vm-options` pour les choix possibles). */
export interface CreateVm {
  name: string;
  memory_mb: number;
  vcpus: number;
  disks: DiskSpec[];
  iso?: VolumeRef;
  network?: string;
  firmware?: string;
  start?: boolean;
}

/** Ce qu'on envoie pour cloner une VM arrêtée. */
export interface CloneVm {
  name: string;
}
