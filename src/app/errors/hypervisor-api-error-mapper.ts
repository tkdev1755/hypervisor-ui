import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { ApiMessage } from '../models/api-message.model';
import { AppError, BusinessErrorCode, ErrorOrigin } from '../models/app-error.model';
import { ErrorMapper } from './error-mapper';

/**
 * Le texte affiché pour chaque erreur métier : un seul endroit à relire.
 * Record<A, B> = un objet dont les clés sont de type A et les valeurs de type B.
 */
const CATALOG: Record<BusinessErrorCode, { title: string; message: string }> = {
  NOT_FOUND: {
    title: 'Ressource introuvable',
    message: "Cet élément n'existe pas ou a été supprimé.",
  },
  NOT_IMPLEMENTED: {
    title: 'Pas encore disponible',
    message: "Cette fonctionnalité est prévue, mais l'API ne la fournit pas encore.",
  },
  HYPERVISOR_UNREACHABLE: {
    title: 'Hyperviseur injoignable',
    message: "L'API n'a pas pu se connecter à libvirt avec cette URI. Vérifiez l'adresse et que l'hôte est démarré.",
  },
  INVALID_REQUEST: {
    title: 'Requête invalide',
    message: "Les informations envoyées n'ont pas été acceptées par l'API.",
  },
  CONFLICT: {
    title: 'Action impossible en l’état',
    message:
      'Un nom est déjà pris, un disque est déjà utilisé, ou la VM n’est pas dans le bon état (par exemple : elle doit être arrêtée pour être clonée ou supprimée).',
  },
  TIMEOUT: {
    title: 'Délai dépassé',
    message: "L'hyperviseur n'a pas répondu à temps. Réessayez dans un instant.",
  },
};

/** L'API répond { status, content } en cas d'erreur (voir common.rs). */
function asApiMessage(body: unknown): ApiMessage | null {
  if (typeof body === 'object' && body !== null && 'status' in body && 'content' in body) {
    return body as ApiMessage;
  }
  return null;
}

/** Traduit les erreurs de hypervisor-api (Rust / Axum) en AppError. */
@Injectable()
export class HypervisorApiErrorMapper implements ErrorMapper {
  readonly api = 'hypervisor-api' as const;

  map(error: HttpErrorResponse, origin: ErrorOrigin): AppError {
    const body = asApiMessage(error.error);

    // Pas de corps { status, content } : ce n'est pas l'API qui a répondu, mais
    // le réseau ou le proxy de développement. L'API est sans doute arrêtée.
    if (error.status === 0 || (!body && error.status >= 500)) {
      return {
        kind: 'technical',
        ...origin,
        title: 'API injoignable',
        message: 'Le serveur ne répond pas. Vérifiez que hypervisor-api tourne (cargo run, port 3000).',
        detail: typeof error.error === 'string' ? error.error : error.message,
        occurredAt: new Date(),
      };
    }

    // 502 / 504 / 409 portent un corps { status, content } : l'API a bien répondu.
    const code = this.businessCode(error.status);
    if (code) {
      return { kind: 'business', ...origin, code, title: CATALOG[code].title, message: CATALOG[code].message };
    }

    return {
      kind: 'technical',
      ...origin,
      title: 'Erreur inattendue',
      message: "Une erreur s'est produite. Réessayez, ou transmettez les détails ci-dessous à l'équipe.",
      detail: body?.content ?? (typeof error.error === 'string' ? error.error : error.message),
      occurredAt: new Date(),
    };
  }

  private businessCode(status: number): BusinessErrorCode | null {
    switch (status) {
      case 400:
      case 422:
        return 'INVALID_REQUEST';
      case 404:
        return 'NOT_FOUND';
      case 501:
        return 'NOT_IMPLEMENTED';
      case 409:
        return 'CONFLICT';
      case 502:
        return 'HYPERVISOR_UNREACHABLE';
      case 504:
        return 'TIMEOUT';
      default:
        return null;
    }
  }
}
