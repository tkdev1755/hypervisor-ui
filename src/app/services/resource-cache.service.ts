import { Injectable, InjectionToken, Provider, inject, isDevMode } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap, throwError } from 'rxjs';

import { Hypervisor } from '../models/hypervisor.model';

// =============================================================================
// ResourceCacheService : faire passer des données d'une page à l'autre.
//
// La page « liste des hyperviseurs » a déjà chargé l'hyperviseur sur lequel on
// clique. Plutôt que de recopier ses champs dans l'URL (fragile, et modifiable
// par l'utilisateur), on le range dans un cache en mémoire ; l'URL ne garde que
// l'identifiant.
//
//   page liste  : resourceCache.prime('hypervisor', h.id, h)      // on range
//   page détail : resourceCache.resolve('hypervisor', id)         // on relit
//
// Si la donnée n'est pas en cache (page rafraîchie, lien partagé), resolve()
// la recharge depuis l'API grâce au « descripteur » du type (config/).
// =============================================================================

/** Le catalogue des types transportables. Ajouter un type : une ligne ici + un descripteur. */
export interface ResourceTypes {
  hypervisor: Hypervisor;
}

/** keyof = l'union des noms de champs : ici 'hypervisor'. */
export type ResourceType = keyof ResourceTypes;

export interface ResourceDescriptor<K extends ResourceType = ResourceType> {
  type: K;
  /** Comment recharger la donnée depuis l'API. Absent = donnée saisie par l'utilisateur. */
  fetch?: (id: string) => Observable<ResourceTypes[K]>;
}

/** Levée quand une donnée est absente du cache et ne peut pas être rechargée. */
export class ResourceUnavailableError extends Error {
  constructor(
    readonly type: ResourceType,
    readonly id: string,
  ) {
    super(`Donnée « ${type} » (${id}) absente du contexte et impossible à recharger.`);
    this.name = 'ResourceUnavailableError';
  }
}

export const RESOURCE_DESCRIPTORS = new InjectionToken<ResourceDescriptor[]>('RESOURCE_DESCRIPTORS');

/** Enregistre un descripteur (on peut y appeler inject() pour obtenir un service). */
export function provideResourceDescriptor<K extends ResourceType>(factory: () => ResourceDescriptor<K>): Provider {
  return { provide: RESOURCE_DESCRIPTORS, useFactory: factory, multi: true };
}

@Injectable({ providedIn: 'root' })
export class ResourceCacheService {
  private readonly descriptors = new Map<ResourceType, ResourceDescriptor>();
  private readonly cache = new Map<string, unknown>();
  private readonly inFlight = new Map<string, Observable<unknown>>();
  private readonly debug = isDevMode();

  constructor() {
    for (const descriptor of inject(RESOURCE_DESCRIPTORS, { optional: true }) ?? []) {
      if (this.descriptors.has(descriptor.type)) {
        throw new Error(`ResourceCache : le type « ${descriptor.type} » est déclaré deux fois.`);
      }
      this.descriptors.set(descriptor.type, descriptor);
    }
  }

  /** Range une donnée dans le cache. */
  prime<K extends ResourceType>(type: K, id: string, value: ResourceTypes[K]): void {
    this.assertId(type, id);
    this.cache.set(this.key(type, id), value);
    this.log('prime', type, id);
  }

  /** Lit le cache, sans jamais appeler l'API. */
  peek<K extends ResourceType>(type: K, id: string): ResourceTypes[K] | undefined {
    return this.cache.get(this.key(type, id)) as ResourceTypes[K] | undefined;
  }

  /** La donnée : depuis le cache si elle y est, sinon depuis l'API. Deux appels simultanés = une seule requête. */
  resolve<K extends ResourceType>(type: K, id: string): Observable<ResourceTypes[K]> {
    this.assertId(type, id);
    const key = this.key(type, id);

    if (this.cache.has(key)) {
      this.log('resolve (cache)', type, id);
      return of(this.cache.get(key) as ResourceTypes[K]);
    }
    const pending = this.inFlight.get(key);
    if (pending) {
      return pending as Observable<ResourceTypes[K]>;
    }
    const descriptor = this.descriptors.get(type) as ResourceDescriptor<K> | undefined;
    if (!descriptor?.fetch) {
      return throwError(() => new ResourceUnavailableError(type, id));
    }

    this.log('resolve (API)', type, id);
    const request = descriptor.fetch(id).pipe(
      tap((value) => this.cache.set(key, value)),
      finalize(() => this.inFlight.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inFlight.set(key, request);
    return request;
  }

  /** Oublie une donnée (après une modification ou une suppression). */
  invalidate(type: ResourceType, id?: string): void {
    if (id) {
      this.cache.delete(this.key(type, id));
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${type}::`)) {
        this.cache.delete(key);
      }
    }
  }

  private key(type: ResourceType, id: string): string {
    return `${type}::${id}`;
  }

  /** Garde-fou : un id manquant donnerait une clé « hypervisor::undefined ». */
  private assertId(type: ResourceType, id: string): void {
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error(`ResourceCache : identifiant invalide pour « ${type} » (${id}).`);
    }
  }

  private log(action: string, type: ResourceType, id: string): void {
    if (this.debug) {
      console.debug(`[resource-cache] ${action} ${type}::${id}`);
    }
  }
}
