export interface VolumeOption {
  name: string;
  format: string;
  size_mb: number;
  kind: 'disk' | 'iso';
  /** Les VM qui utilisent déjà ce disque. */
  used_by: string[];
}

export interface PoolOption {
  name: string;
  capacity_gb: number;
  available_gb: number;
  volumes: VolumeOption[];
}

export interface NetworkOption {
  name: string;
  bridge?: string;
  forward_mode?: string;
}

export interface Range {
  min: number;
  max: number;
}

/** Ce que l'interface peut proposer pour créer une VM. */
export interface VmOptions {
  storage_pools: PoolOption[];
  networks: NetworkOption[];
  firmware: string[];
  limits: { memory_mb: Range; vcpus: Range; disk_gb: Range };
  defaults: { network: string; firmware: string; memory_mb: number; vcpus: number; disk_gb: number };
}
