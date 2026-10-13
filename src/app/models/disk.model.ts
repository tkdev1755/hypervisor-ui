/** Un disque virtuel d'un hyperviseur. */
export interface Disk {
  id: string;
  hypervisor_id: string;
  name: string;
  size_gb: number;
  format: string;
}

/** Ce qu'on envoie pour créer ou modifier un disque. */
export interface DiskRequest {
  name: string;
  size_gb: number;
  format: string;
}
