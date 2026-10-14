/** La réponse de `GET .../vms/{id}/vnc` : de quoi ouvrir la console noVNC. */
export interface VncResponse {
  hypervisor_id: string;
  vm_id: string;
  host: string;
  port: string;
  token: string;
  /** L'adresse de la console noVNC, à ouvrir dans un onglet ou une iframe. */
  novnc_url: string;
  status: string;
}
