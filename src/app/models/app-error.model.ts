import { ApiName } from '../utils/api-context';

// =============================================================================
// AppError : la forme unique de toutes les erreurs HTTP de l'application.
//
// Les composants ne voient jamais une erreur HTTP brute : l'intercepteur
// (interceptors/error.interceptor.ts) la transforme toujours en AppError.
// Il en existe deux sortes, reconnaissables à leur champ `kind` :
//
//  - BusinessError  : une erreur « normale » que l'utilisateur peut comprendre
//                     (ressource introuvable, hyperviseur injoignable...).
//  - TechnicalError : une panne (serveur arrêté, erreur 500...). L'écran
//                     affiche un message simple et garde les détails
//                     techniques dans un encadré dépliable.
// =============================================================================

/** D'où vient l'erreur : utile pour le diagnostic. */
export interface ErrorOrigin {
  api: ApiName | 'unknown';
  method: string;
  endpoint: string;
  /** Code HTTP ; 0 si le serveur n'a pas répondu du tout. */
  status: number;
}

export type BusinessErrorCode = 'NOT_FOUND' | 'NOT_IMPLEMENTED' | 'HYPERVISOR_UNREACHABLE' | 'INVALID_REQUEST';

/** « extends ErrorOrigin » : BusinessError a tous les champs de ErrorOrigin, plus les siens. */
export interface BusinessError extends ErrorOrigin {
  kind: 'business';
  code: BusinessErrorCode;
  title: string;
  message: string;
}

export interface TechnicalError extends ErrorOrigin {
  kind: 'technical';
  title: string;
  message: string;
  /** Texte brut renvoyé par le serveur, s'il y en a un. */
  detail?: string;
  occurredAt: Date;
}

export type AppError = BusinessError | TechnicalError;

/** Vérifie qu'une valeur inconnue est bien une AppError. */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value.kind === 'business' || value.kind === 'technical')
  );
}

/**
 * Force à traiter tous les cas d'un switch : si quelqu'un ajoute une troisième
 * sorte d'erreur, chaque switch qui l'oublie ne compilera plus.
 */
export function assertNever(value: never): never {
  throw new Error(`Cas non géré : ${JSON.stringify(value)}`);
}
