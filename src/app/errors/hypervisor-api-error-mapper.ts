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
  INVALID_CREDENTIALS: {
    title: 'Identifiants incorrects',
    message: "Le nom d'utilisateur ou le mot de passe est incorrect, ou le compte est désactivé.",
  },
  SESSION_EXPIRED: {
    title: 'Session expirée',
    message: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  },
  FORBIDDEN: {
    title: 'Action non autorisée',
    message: "Votre compte n'a pas le droit d'effectuer cette action. Demandez à un administrateur si vous en avez besoin.",
  },
  QUOTA_EXCEEDED: {
    title: 'Quota dépassé',
    message: 'Cette action dépasse une limite fixée pour votre compte. Un administrateur peut augmenter votre quota.',
  },
  TOO_MANY_ATTEMPTS: {
    title: 'Trop de tentatives',
    message: 'Trop de connexions échouées pour ce nom d’utilisateur. Patientez 15 minutes avant de réessayer.',
  },
};

/** Le nom lisible de chaque limite de quota (les noms viennent de l'API, en anglais). */
const QUOTA_LABELS: Record<string, string> = {
  max_vms: 'nombre de VM',
  max_vcpus: 'nombre de vCPU',
  max_memory_mb: 'mémoire (Mo)',
  max_disk_gb: 'espace disque (Go)',
};

/**
 * L'API répond « Quota exceeded: max_vms is limited to 3 (4 requested) » : on en tire un texte français
 * qui nomme la limite. Ce message-là est le seul dont on réutilise un morceau (le nom de la limite et les chiffres).
 */
function quotaMessage(content: string | undefined): string | null {
  const found = /(max_\w+) is limited to (\d+)(?: \((\d+) requested\))?/.exec(content ?? '');
  if (!found) {
    return null;
  }
  const [, limit, max, requested] = found;
  const label = QUOTA_LABELS[limit] ?? limit;
  return `Limite atteinte pour le ${label} : ${max} au maximum${requested ? ` (${requested} demandé${Number(requested) > 1 ? 's' : ''})` : ''}. Un administrateur peut augmenter votre quota.`;
}

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
    const code = this.businessCode(error.status, origin, body);
    if (code) {
      return { kind: 'business', ...origin, code, title: CATALOG[code].title, message: this.messageFor(code, origin, body) };
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

  /** Le texte du catalogue, sauf pour les cas où le contexte permet d'être plus précis. */
  private messageFor(code: BusinessErrorCode, origin: ErrorOrigin, body: ApiMessage | null): string {
    if (code === 'QUOTA_EXCEEDED') {
      return quotaMessage(body?.content) ?? CATALOG[code].message;
    }
    if (code === 'INVALID_CREDENTIALS' && origin.endpoint.startsWith('/api/me/password')) {
      return 'Le mot de passe actuel est incorrect.';
    }
    if (code === 'FORBIDDEN' && origin.endpoint.startsWith('/api/auth/register')) {
      return "Les inscriptions sont fermées. Demandez à un administrateur de créer votre compte.";
    }
    return CATALOG[code].message;
  }

  private businessCode(status: number, origin: ErrorOrigin, body: ApiMessage | null): BusinessErrorCode | null {
    switch (status) {
      // 401 : sur la connexion (ou le changement de mot de passe), c'est « mauvais mot de passe » ;
      // ailleurs, c'est « jeton absent, expiré, ou compte désactivé ».
      case 401:
        return origin.endpoint.startsWith('/api/auth/login') ||
          origin.endpoint.startsWith('/api/auth/token') ||
          origin.endpoint.startsWith('/api/me/password')
          ? 'INVALID_CREDENTIALS'
          : 'SESSION_EXPIRED';
      // 403 : « tu existes mais tu n'as pas le droit » ; un quota dépassé est aussi un 403, repérable à son message.
      case 403:
        return /quota exceeded/i.test(body?.content ?? '') ? 'QUOTA_EXCEEDED' : 'FORBIDDEN';
      case 429:
        return 'TOO_MANY_ATTEMPTS';
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
