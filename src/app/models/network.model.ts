/** Un réseau virtuel d'un hyperviseur. */
export interface Network {
  id: string;
  hypervisor_id: string;
  name: string;
  /** null = pas de bridge */
  bridge: string | null;
  status: string;
}

/** Ce qu'on envoie pour créer un réseau. */
export interface NetworkRequest {
  name: string;
  bridge?: string | null;
}
