/** La réponse de `GET .../vms/{id}/vnc` : de quoi ouvrir la console noVNC. */
export interface VncResponse {
  hypervisor_id: string;
  vm_id: string;
  uuid: string;
  host: string;
  port: string;
  /** Un jeton aléatoire, valable 2 minutes : il ne sert qu'à ouvrir la connexion. */
  token: string;
  /** L'adresse de la console noVNC, à ouvrir TOUT DE SUITE dans un onglet ou une iframe (ne pas la garder). */
  novnc_url: string;
  status: string;
  /** Fin de validité du jeton (secondes Unix). Pour se reconnecter, rappeler la route. */
  expires_at: number;
}
