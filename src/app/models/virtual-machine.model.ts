/** Une machine virtuelle, telle que l'API la renvoie. */
export interface VirtualMachine {
  id: string;
  hypervisor_id: string;
  name: string;
  memory_mb: number;
  vcpus: number;
  status: string;
}

/** Ce qu'on envoie pour créer (ou cloner) une VM. */
export interface CreateVm {
  name: string;
  memory_mb: number;
  vcpus: number;
}
