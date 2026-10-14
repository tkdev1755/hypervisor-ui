# Plan d'implémentation — Hypervisor UI

> État au 14 octobre 2026. À tenir à jour à chaque étape terminée (cocher,
> dater, noter les écarts). Contexte et règles : [../CLAUDE.md](../CLAUDE.md).

## 1. Ce qui est fait

### Socle

- [x] Projet Angular 21 sans zone.js, Bootstrap 5.3 en Sass configuré par des
      tokens, CDK pour les modales, proxy de développement vers l'API.
- [x] Structure classique (`pages/`, `components/`, `services/`, `models/`…),
      composants en trois fichiers, suffixes classiques, alias `@app/`.
- [x] 11 composants de mise en page à la Flutter et 16 composants
      d'interface, documentés en tête de leur `.ts`.
- [x] Moteur d'erreurs : étiquette par API, intercepteur, mapper avec
      catalogue français, `AppError` métier / technique, `<app-error-panel>`.
- [x] ContextBridgeService (cache `type::id`, rechargement, déduplication).
- [x] Modales : service CDK Overlay, `ModalRef`, cadre `<app-modal-shell>`
      (form / loading / success / error), modale de confirmation.
- [x] Fausse API Node (`npm run mock`, `npm run mock:full`).

### Écrans

- [x] Accueil, page Apprendre (17 leçons : TypeScript, Angular, mise en page, et une partie « Avancé »).
- [x] Hyperviseurs : liste, ajout, modification, suppression.
- [x] Détail d'un hyperviseur : onglets VM (liste, démarrage, arrêt,
      suppression, création), disques et réseaux (lecture).
- [x] Barre latérale avec l'état de l'API, page 404.

### MVP du 14 octobre 2026 (réalignement sur l'API)

- [x] Modèles : `CreateVm` complet, `CloneVm`, `Job`, `VmOptions`, `VncResponse`.
- [x] Services : `VmService` (options, start/stop typés VM, clone → Job,
      delete avec `delete_disks`, vnc) et `JobService` (get, watch).
- [x] Erreurs 409 (`CONFLICT`) et 504 (`TIMEOUT`) dans le catalogue.
- [x] Création de VM via `vm-options` (pool, taille de disque, réseau,
      firmware, ISO facultative, démarrage). Pas encore : disques existants, plusieurs disques.
- [x] vCPU et mémoire réglables (`ui/number-field`, boutons − / +, bornes de `vm-options`) ; les gabarits ne font que pré-remplir.
- [x] Modales : corps défilant si trop long, taille `screen` (80 % × 95 %) pour la console VNC.
- [x] Arrêt forcé (`stop?force=true`) avec confirmation, dans la liste et la page VM.
- [x] Clonage avec suivi de la tâche (`vm-clone-modal`).
- [x] Suppression avec choix de garder ou supprimer les disques (`vm-delete-modal`).
- [x] Console VNC dans une modale (iframe noVNC, `ui/frame`) ou un onglet.
- [x] Fausse API : `vm-options`, clonage + tâches, VNC, 409. `PORT=3001` possible.
- [x] Barre latérale « Inventaire » (hyperviseurs → VM, état en marche / éteinte) et page `vm-detail`
      (`/hypervisors/:id/vms/:vmId`). Les pages appellent `InventoryService.refresh()` après chaque changement.
- [ ] Non testé contre la vraie API (le mainteneur l'utilise sur de vrais hyperviseurs).

### Formation avancée (14 octobre 2026)

- [x] Onglet « 4. Avancé » de la page Apprendre, 7 leçons avec démo en direct :
      11 routage (paramètres, `withComponentInputBinding`, lazy loading, `toSignal`),
      12 ouvrir une modale (`ModalService`, `afterClosed$`, valeurs de résultat),
      13 écrire sa modale (`modal-shell`, états, `closeGuard`, projection de contenu ;
      modale d'exemple `lessons/demo-rename-modal`),
      14 ContextBridge (`prime` / `peek` / `resolve` / `invalidate`, descripteurs),
      15 signals avancés (`computed`, `linkedSignal`, `effect` + `untracked`),
      16 RxJS (`timer`, `switchMap`, `filter`, `take`, `takeUntilDestroyed`, suivi d'une tâche),
      17 injection et génériques (`InjectionToken`, `multi: true`, `provideXxx`, `keyof`).
- [x] Vérifié avec `ng build` (0 avertissement) et les démos essayées dans le navigateur.
- [ ] Reste à couvrir si l'équipe bloque : formulaires et validation (partiellement
      couverts par la leçon 13), `@defer`, tests unitaires.

### Documentation

- [x] README.md, GUIDE.md (recettes et exercices), CLAUDE.md, ce plan.

## 2. Écarts constatés avec l'API (relevés le 14 octobre 2026)

L'API a avancé (derniers commits : création de VM, clonage, tâches,
options de VM, VNC). Le front a été écrit pour une version plus ancienne.

| Sujet | API actuelle | Front actuel | Impact |
|---|---|---|---|
| Création de VM | `CreateVm` a aussi `disks: DiskSpec[]`, `iso`, `network`, `firmware`, `start` ; au moins un disque sauf si une ISO est fournie | Envoie seulement `name`, `memory_mb`, `vcpus` | **La création échoue probablement (400)** |
| Options de création | `GET /api/hypervisors/{id}/vm-options` : pools de stockage et volumes, réseaux, firmwares, limites, valeurs par défaut | Absent | Gabarits codés en dur |
| Clonage | `POST .../clone` avec `CloneVm { name }`, répond **202** + une tâche (`Job`) et un en-tête `Location` | `VmService.clone` envoie un `CreateVm` et attend une VM | Le clonage ne marchera pas |
| Tâches | `GET /api/jobs/{job_id}` → `Job { id, kind, status: running/succeeded/failed, result?, error? }` | Absent | Pas de suivi des opérations longues |
| Démarrer / arrêter | Renvoient la `VirtualMachine` mise à jour | Typés `ApiMessage` (le front recharge la liste) | Sans gravité, à corriger pour la justesse des types |
| VNC | `GET .../vnc` → `VncResponse { host, port, token, novnc_url, status… }` | Absent | Pas de console |
| Erreurs | Nouveaux codes **409 Conflict**, **400 Bad Request**, **504 Gateway Timeout**, avec le corps `{ status, content }` | Le mapper traite 400, 404, 422, 501, 502 ; 409 et 504 deviennent « Erreur inattendue » | Messages peu clairs |
| Disques, réseaux | Toujours `501` | Lecture seule | Rien à faire avant l'API |
| Fausse API | — | Ne connaît ni les tâches, ni `vm-options`, ni VNC | À mettre à jour en même temps que le front |

## 3. Étapes à venir

Chaque étape : fichiers concernés, critère de fin. Respecter les règles de
CLAUDE.md (trois fichiers par composant, pas de HTML / CSS dans les pages,
commentaires pour débutants), finir par un `ng build` sans avertissement.

### Étape 1 — Réaligner le front sur l'API (FAIT le 14 octobre, voir MVP)

1. **Modèles** (`models/virtual-machine.model.ts`, nouveaux
   `models/job.model.ts`, `models/vm-options.model.ts`, `models/vnc.model.ts`) :
   recopier `CreateVm`, `DiskSpec`, `VolumeRef`, `CloneVm`, `Job`,
   `JobStatus`, `VmOptions` et `VncResponse` depuis `src/models.rs`,
   `src/jobs.rs` et `src/vm_options.rs` de l'API.
2. **Services** : `VmService.start/stop` → `Observable<VirtualMachine>` ;
   `VmService.clone(…, body: CloneVm)` → `Observable<Job>` ;
   `VmService.options(hypervisorId)` ; nouveau `JobService.get(id)`.
3. **Erreurs** : ajouter `CONFLICT` (409) et `TIMEOUT` (504, quand le corps
   est un `{ status, content }`) au catalogue et à `businessCode()`.
   Attention : aujourd'hui, un 5xx avec corps n'est pas traité comme
   « API injoignable », seul un 5xx sans corps l'est. Garder cette distinction.
4. **Fausse API** : mêmes changements dans `mock-api/server.mjs`.

*Fin* : la création, le démarrage et l'arrêt fonctionnent avec la vraie API
(testés sur un hyperviseur de test, pas sur ceux du mainteneur sans accord) ;
un 409 affiche un message métier clair.

### Étape 2 — Création de VM complète (MVP fait ; reste : ISO, `app-number-field`, disques existants)

- Refaire `components/vm-form-modal` en s'appuyant sur `vm-options` : nom,
  vCPU et mémoire bornés par `limits` (un composant `app-number-field` à
  créer dans `ui/`, avec boutons − / +), disque (nouveau volume dans un pool,
  ou volume existant), ISO facultative, réseau, firmware (`<app-choice-cards>`),
  case « démarrer après création » (un `app-checkbox` à créer).
- Pré-remplir avec `defaults`. Afficher l'espace disponible des pools.
- Une modale longue peut passer en `size: 'lg'`.

*Fin* : une VM créée depuis l'interface démarre sur un hyperviseur de test.

### Étape 3 — Opérations longues : tâches et clonage (FAIT en version simple)

- `JobService.watch(id)` : interroge `GET /api/jobs/{id}` toutes les secondes
  (RxJS `timer` + `switchMap` + `takeWhile`) jusqu'à `succeeded` ou `failed`.
- Bouton « Cloner » dans `vm-list` → modale (nouveau nom) → état `loading`
  pendant la tâche → `success` avec la VM créée, ou `error` avec
  `job.error`.
- Prévoir l'expiration : les tâches sont perdues si l'API redémarre (404).

*Fin* : un clonage suivi de bout en bout dans la modale.

### Étape 4 — Console VNC (FAIT en modale ; reste : page dédiée)

- Bouton « Console » sur les VM en marche → `GET .../vnc` → ouvrir
  `novnc_url` dans un nouvel onglet (première version), ou l'intégrer dans
  une page dédiée (`pages/vm-console`) plus tard.
- Afficher clairement les erreurs (VM éteinte, proxy indisponible).

### Étape 5 — Disques et réseaux (quand l'API les fournit)

- Exercices 3 et 4 du GUIDE : création d'un disque, création d'un réseau.
  Ce sont de bons premiers sujets pour l'équipe : à leur laisser.

### Étape 6 — Qualité (priorité basse)

- Tests unitaires des services et du mapper d'erreurs (Vitest, déjà prévu
  par Angular 21 ; aucun test n'existe aujourd'hui).
- Un lint (ESLint Angular) et Prettier en vérification dans une CI GitHub.
- Accessibilité : vérifier le contraste des badges, le focus visible, la
  navigation clavier dans les listes cliquables.
- Gestion des listes longues (recherche, tri) dans `vm-list`.

### Étape 7 — Pédagogie (au fil de l'eau)

- FAIT le 14 octobre : routage, RxJS, modales, ContextBridge, signals avancés, injection
  (partie « Avancé », leçons 11 à 17). Reste, si l'équipe bloque : formulaires et validation
  plus détaillés, `@defer`.
- Garder les exemples très simples et les noms en français dans les leçons.

## 4. Décisions prises (et pourquoi)

| Décision | Raison |
|---|---|
| Structure classique par type de fichier | Demande du mainteneur : la structure par fonctionnalité était illisible pour l'équipe. |
| Trois fichiers par composant | Demande du mainteneur : la même forme partout, plus facile à apprendre. |
| Composants de mise en page à la Flutter | L'équipe ne doit pas avoir à apprendre HTML et CSS en même temps qu'Angular. |
| Signals + `[(value)]` au lieu des formulaires réactifs | Moins de concepts à apprendre. |
| Pas de librairie de modales ni d'icônes | Peu de dépendances (moins de CVE, moins de mises à jour) ; socle repris d'un projet en production. |
| Catalogue d'erreurs en français, messages de l'API ignorés à l'écran | Les messages de l'API sont en anglais et destinés aux développeurs. |
| Fausse API sans dépendance | Les coéquipiers sur Mac ne peuvent pas lancer libvirt. |

## 5. Journal

| Date | Étape |
|---|---|
| 12 octobre 2026 | Première version (structure par fonctionnalité). |
| 13 octobre 2026 | Réécriture : structure classique, trois fichiers par composant, mise en page à la Flutter, page Apprendre. |
| 14 octobre 2026 | CLAUDE.md et ce plan ; écarts avec l'API relevés (section 2). |
| 14 octobre 2026 | MVP : création complète, clonage, suppression, console VNC, fausse API à jour. |
| 14 octobre 2026 | Formation avancée : 7 leçons (routage, modales, ContextBridge, signals, RxJS, injection). |
