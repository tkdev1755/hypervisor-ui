import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Le nom des API que le front appelle. Si un jour le front appelle une autre
 * API, on ajoute son nom ici, puis un « error mapper » dédié (dossier errors/).
 */
export type ApiName = 'hypervisor-api';

/**
 * Une étiquette posée sur chaque requête HTTP. L'intercepteur d'erreurs la lit
 * pour savoir quelle API a répondu, et donc comment traduire ses erreurs.
 */
export const API_CONTEXT = new HttpContextToken<ApiName | null>(() => null);

/** Raccourci : this.http.get(url, { context: apiContext('hypervisor-api') }) */
export function apiContext(api: ApiName): HttpContext {
  return new HttpContext().set(API_CONTEXT, api);
}
