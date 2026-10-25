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
  { pattern: /^max_vms must be/i, message: 'La limite de VM doit être 0 ou plus (vide : sans limite).' },
  { pattern: /template is used by the lab (.+): remove/i, message: 'Ce template est utilisé par un labo : retirez-le d’abord des VM de ce labo.' },
];

/**
 * Même principe pour les labos (labs.rs) : leurs 409, 400 et certains 404 ont des raisons précises.
 * « VM x: … » : un déploiement refusé à cause d'une VM du labo (le nom de la VM est repris dans le texte).
 */
const LAB_MESSAGES: { pattern: RegExp; message: string }[] = [
  { pattern: /lab with this name already exists/i, message: 'Un labo porte déjà ce nom sur cet hyperviseur.' },
  { pattern: /lab still has \d+ instance/i, message: 'Ce labo a encore des instances : supprimez-les d’abord.' },
  { pattern: /already has a network with this name/i, message: 'Le labo a déjà un réseau de ce nom.' },
  { pattern: /already has a VM with this name/i, message: 'Le labo a déjà une VM de ce nom.' },
  { pattern: /plugged into this network: unplug/i, message: 'Une VM du labo est branchée sur ce réseau : retirez-le d’abord de ses cartes réseau.' },
  { pattern: /instance\(s\) of the lab were deployed with it/i, message: 'Des instances ont été déployées avec cet élément : supprimez-les d’abord.' },
  { pattern: /has no libvirt network named/i, message: 'L’hyperviseur n’a pas de réseau libvirt de ce nom.' },
  { pattern: /external network needs libvirt_network/i, message: 'Un réseau externe doit désigner un réseau libvirt existant de l’hyperviseur.' },
  { pattern: /internal network is created for each instance/i, message: 'Un réseau interne est créé pour chaque instance : il ne désigne pas de réseau libvirt.' },
  { pattern: /external network .* is missing/i, message: 'Un réseau externe du labo n’existe plus sur l’hyperviseur : un gestionnaire doit corriger le labo.' },
  { pattern: /external network .* is not active/i, message: 'Un réseau externe du labo n’est pas démarré sur l’hyperviseur.' },
  { pattern: /lab has no VM to deploy/i, message: 'Ce labo n’a encore aucune VM : ajoutez-en avant de le déployer.' },
  { pattern: /creating VMs from the template .* is disabled/i, message: 'Une VM du labo vient d’un template désactivé : un administrateur doit l’activer.' },
  { pattern: /no built version yet|version \d+ of the template .* is not built/i, message: 'Une VM du labo vient d’un template sans version prête (ou d’une version qui n’est pas prête).' },
  { pattern: /still being deployed/i, message: 'L’instance est en cours de déploiement : attendez la fin.' },
  { pattern: /instance is not ready/i, message: 'L’instance n’est pas prête (déploiement en cours ou raté).' },
  { pattern: /A lab has at most \d+ networks/i, message: 'Un labo a au plus 16 réseaux.' },
  { pattern: /A lab has at most \d+ VMs/i, message: 'Un labo a au plus 32 VM.' },
  { pattern: /A VM has at most \d+ networks/i, message: 'Une VM a au plus 8 cartes réseau.' },
  { pattern: /name of a lab VM has at most/i, message: 'Le nom d’une VM de labo fait au plus 55 caractères.' },
  { pattern: /network name is 1 to/i, message: 'Le nom d’un réseau fait de 1 à 32 caractères : lettres, chiffres, « - » ou « _ ».' },
  { pattern: /lab has no network/i, message: 'Un des réseaux choisis n’existe plus dans le labo : rechargez la page.' },
  { pattern: /^Template not found/i, message: 'Template introuvable, ou vous n’avez pas le droit de l’utiliser.' },
  { pattern: /^Template version not found/i, message: 'Cette version du template n’existe pas.' },
  { pattern: /^(memory_mb|vcpus) must be between/i, message: 'La mémoire ou les vCPU sont hors des limites.' },
  { pattern: /^firmware must be/i, message: 'Le firmware doit être BIOS ou UEFI.' },
  { pattern: /^name must be/i, message: 'Le nom doit faire de 1 à 64 caractères imprimables.' },
  { pattern: /^description must be/i, message: 'La description fait au plus 2000 caractères.' },
  { pattern: /^max_instances must be/i, message: 'La limite d’instances doit être 0 ou plus (vide : sans limite).' },
  { pattern: /VM with this name already exists/i, message: 'Une VM de ce nom existe déjà sur l’hyperviseur.' },
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
      // « Template limit reached: you may own at most 2 VMs from this template » : la limite d'un template.
      const templateLimit = /at most (\d+) VMs from this template/.exec(body?.content ?? '');
      if (templateLimit) {
        return `Limite atteinte pour ce template : vous pouvez posséder au plus ${templateLimit[1]} VM créée(s) à partir de lui. Un administrateur peut la changer.`;
      }
      // « Lab limit reached: you may own at most 2 instances of this lab » : la limite d'un labo.
      const labLimit = /at most (\d+) instances of this lab/.exec(body?.content ?? '');
      if (labLimit) {
        return `Limite atteinte pour ce labo : vous pouvez posséder au plus ${labLimit[1]} instance(s). Supprimez-en une, ou demandez à un administrateur de changer la limite.`;
      }
      return quotaMessage(body?.content) ?? CATALOG[code].message;
    }
    if ((code === 'CONFLICT' || code === 'INVALID_REQUEST') && origin.endpoint.includes('/templates')) {
      const found = TEMPLATE_MESSAGES.find((entry) => entry.pattern.test(body?.content ?? ''));
      if (found) {
        return found.message;
      }
    }
    // Les labos d'abord : leurs adresses ne contiennent pas « /templates », mais leurs messages parlent de templates.
    if ((code === 'CONFLICT' || code === 'INVALID_REQUEST' || code === 'NOT_FOUND') && origin.endpoint.includes('/labs')) {
      const found = LAB_MESSAGES.find((entry) => entry.pattern.test(body?.content ?? ''));
      if (found) {
        return found.message;
      }
    }
    // Supprimer un hyperviseur où des instances de labos sont déployées.
    if (code === 'CONFLICT' && /lab instance\(s\) are deployed on this hypervisor/i.test(body?.content ?? '')) {
      return 'Des instances de labos sont déployées sur cet hyperviseur : supprimez-les d’abord (page de chaque labo).';
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
        return /quota exceeded|template limit reached|lab limit reached/i.test(body?.content ?? '') ? 'QUOTA_EXCEEDED' : 'FORBIDDEN';
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
