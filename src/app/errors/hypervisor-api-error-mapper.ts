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
      'Un nom est déjà pris, une ressource est déjà utilisée, ou l’élément n’est pas dans le bon état (une VM doit être arrêtée pour être clonée ou supprimée ; un compte qui possède des VM ne peut pas être supprimé ; on ne peut pas retirer le dernier administrateur).',
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

/**
 * Les templates ont plusieurs raisons très différentes de répondre 409 (ou 400) : le texte générique
 * du catalogue n'aiderait pas. On reconnaît le message anglais de l'API (templates.rs) et on affiche
 * le texte français qui lui correspond. Le premier motif qui correspond l'emporte.
 */
const TEMPLATE_MESSAGES: { pattern: RegExp; message: string }[] = [
  { pattern: /template with this name already exists/i, message: 'Un template porte déjà ce nom sur cet hyperviseur.' },
  { pattern: /template is being built: stop/i, message: "Le template est en construction : arrêtez d'abord la construction pour le supprimer." },
  { pattern: /version is being built: stop/i, message: "Cette version est en construction : arrêtez d'abord la construction pour la supprimer." },
  { pattern: /build of this template is already running/i, message: 'Une construction de ce template est déjà en cours : attendez sa fin ou arrêtez-la.' },
  { pattern: /No build of this template is running/i, message: "Aucune construction de ce template n'est en cours (elle vient sans doute de se terminer)." },
  { pattern: /Creating VMs from this template is disabled/i, message: "Ce template est désactivé : un administrateur doit l'activer pour qu'on puisse créer des VM à partir de lui." },
  { pattern: /no built version yet/i, message: "Le template n'a encore aucune version prête : attendez la fin de sa construction." },
  { pattern: /version of the template is not built/i, message: "Cette version du template n'est pas prête." },
  { pattern: /Invalid offset/i, message: 'Le journal a changé : rechargez-le depuis le début.' },
  { pattern: /disk of the template is in use/i, message: "Le disque du template est en cours d'utilisation (une VM est en train d'être créée à partir de lui). Réessayez dans un instant." },
  { pattern: /disk of the template is missing/i, message: "Le disque du template a disparu de son pool : un administrateur doit le reconstruire." },
  { pattern: /VM with this name already exists/i, message: 'Une VM porte déjà ce nom sur cet hyperviseur.' },
  { pattern: /volume named .* already exists/i, message: 'Un disque de ce nom existe déjà dans le pool : choisissez un autre nom.' },
  { pattern: /network is not active/i, message: "Le réseau choisi n'est pas démarré sur l'hyperviseur." },
  { pattern: /storage pool .* is not active/i, message: "Le pool de stockage n'est pas démarré sur l'hyperviseur." },
  { pattern: /need a local or qemu\+ssh/i, message: 'Les templates demandent un hyperviseur local ou en qemu+ssh:// : Packer est lancé par SSH.' },
  { pattern: /^disk_name/i, message: 'Le nom du fichier disque doit faire de 1 à 64 caractères : lettres, chiffres, « - », « _ » ou « . » (pas au début).' },
  { pattern: /^packer_config/i, message: 'La configuration Packer est vide ou trop longue (64 Ko au maximum).' },
  { pattern: /^Invalid pool/i, message: 'Le nom du pool est invalide.' },
];

/** Même principe pour les groupes (groups.rs). */
const GROUP_MESSAGES: { pattern: RegExp; message: string }[] = [
  { pattern: /group with this name already exists/i, message: 'Un groupe porte déjà ce nom (les majuscules ne comptent pas).' },
  { pattern: /would put the group inside itself/i, message: 'Impossible : ce groupe contient déjà, directement ou non, le groupe dans lequel vous voulez le mettre. Un groupe ne peut pas se retrouver dans lui-même.' },
  { pattern: /cannot contain itself/i, message: 'Un groupe ne peut pas se contenir lui-même.' },
  { pattern: /^name must be/i, message: 'Le nom doit faire de 1 à 64 caractères imprimables.' },
  { pattern: /^description must be/i, message: 'La description fait au plus 500 caractères.' },
];

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
    if ((code === 'CONFLICT' || code === 'INVALID_REQUEST') && origin.endpoint.includes('/templates')) {
      const found = TEMPLATE_MESSAGES.find((entry) => entry.pattern.test(body?.content ?? ''));
      if (found) {
        return found.message;
      }
    }
    if ((code === 'CONFLICT' || code === 'INVALID_REQUEST') && origin.endpoint.startsWith('/api/groups')) {
      const found = GROUP_MESSAGES.find((entry) => entry.pattern.test(body?.content ?? ''));
      if (found) {
        return found.message;
      }
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
