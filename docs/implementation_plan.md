# Plan d'implémentation — Hypervisor UI

> État au 23 octobre 2026. À tenir à jour à chaque étape terminée (cocher,
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

- [x] Accueil, page Apprendre (18 leçons : TypeScript, Angular, mise en page, et une partie « Avancé »).
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

### Authentification, rôles, prêt de VM et quotas (23 octobre 2026, branche `auth`)

Alignement sur l'API (branche `auth` de hypervisor-api : JWT + refresh token, rôles, prêt, quotas, audit ;
référence : `docs/AUTH.md` et `docs/HANDOFF_FRONT.md` dans son dépôt).

- [x] `AuthService` (connexion, déconnexion, refresh partagé, session rouverte au rechargement),
      `authInterceptor` placé avant `errorInterceptor`, `authGuard` / `adminGuard`, page `/login`
      (avec inscription si `GET /api/auth/config` l'autorise), `/account` (rôle, quota, mot de passe).
- [x] Erreurs : `SESSION_EXPIRED` (401), `INVALID_CREDENTIALS`, `FORBIDDEN` (403), `QUOTA_EXCEEDED`
      (403 + message en français tiré de « Quota exceeded: max_vms is limited to 3 (4 requested) »),
      `TOO_MANY_ATTEMPTS` (429).
- [x] Modèles : `VirtualMachine` (+ `owner`, `access`), `CreateVm` (+ `owner_id`), `VncResponse` (+ `uuid`,
      `expires_at`), `User`, `Quota`, `Usage`, `Share`, `AccessEntry`, `AuditEntry`, `Settings`.
- [x] Droits dans l'interface : actions d'hyperviseur, disques, réseaux et accès réservés aux admins ;
      « Créer une VM » masqué si `vm-options` répond 403 ; VM prêtée = console, démarrer, arrêter, « Rendre ».
- [x] Prêt de VM (`vm-share-modal`), changement de propriétaire (`vm-owner-modal`, admin), quota affiché
      à la création, `owner_id` pour un admin, accès par hyperviseur (onglet « Accès », admin).
- [x] Administration : utilisateurs (création, rôle, désactivation, quotas, mot de passe, suppression,
      inscriptions libres) et journal d'audit paginé.
- [x] Console VNC : jeton de 2 minutes (« Reconnecter », nouvel onglet avec jeton frais), message clair sur 409.
- [x] Fausse API réécrite sur ce contrat (comptes `admin` / `alice` / `bob`, `ACCESS_TTL`), vérifiée par un
      script d'assertions tiré de `auth_tests.rs`.
- [x] Leçon 18 (authentification) dans la partie « Avancé ».
- [x] Testé contre la vraie API (binaire de la branche `auth`, base de test isolée, hyperviseur
      `test:///default`) : connexion, F5, refresh sur 401 avec requêtes simultanées (un seul refresh),
      droits admin / utilisateur / emprunteur, quota, changement de mot de passe, administration.
- [ ] **Non testé** : la console VNC avec un vrai QEMU (comme côté API), et sur de vrais hyperviseurs.
- [ ] Suppression de réseau **masquée** : l'API n'a pas de `DELETE …/networks/{id}`
      (le bouton, `NetworkDeleteModalComponent` et `deleteNetwork` sont prêts à rebrancher).
- [ ] Pas de recherche d'utilisateurs pour un non-admin : pour prêter, il faut le nom exact
      (l'API répond 404 sinon) ; le formulaire le dit.
- [ ] Idées : tests unitaires de `authInterceptor` (refresh partagé, rejeu unique), `SESSION_EXPIRED`
      détecté aussi sur un compte désactivé en cours de session.

### Templates Packer (25 octobre 2026)

Alignement sur `src/templates.rs` de l'API (commit « add templates ») : un template est une image disque
construite par Packer en arrière-plan, puis copiée pour chaque VM créée à partir de lui.

- [x] Modèles `Template`, `TemplateStatus`, `CreateTemplate`, `CreateVmFromTemplate` ; `TemplateService`
      (list, get, create → 202, delete, createVm → `Job`).
- [x] Onglet « Templates » du détail d'un hyperviseur (`template-list`), visible par tous : l'admin voit
      tout (en attente, en construction, raté), un utilisateur seulement les templates prêts ; sans accès à
      l'hyperviseur (403), un message l'explique. Rechargement toutes les 5 s pendant une construction.
- [x] Modales : `template-form-modal` (admin : nom, configuration Packer avec exemple Debian 12, nom du
      disque lu dans `vm_name`, pool), `template-detail-modal` (admin : configuration et fin de la sortie
      de Packer), `template-delete-modal`, `template-vm-modal` (nom, vCPU, mémoire, réseau, firmware,
      démarrage, propriétaire pour un admin ; suivi de la tâche, puis ouverture de la VM).
- [x] « Créer une VM » (`vm-form-modal`) propose aussi la source « Template » quand l'hyperviseur a un
      template prêt : disque et ISO disparaissent, la création suit la tâche comme le clonage.
- [x] `app-text-field` : option `rows` (zone de texte sur plusieurs lignes) ; icône `layers` ; statuts
      `pending` / `in_progress` / `created` / `failed` dans `app-status-badge`.
- [x] Erreurs : les 409 / 400 des templates reçoivent un texte français précis (`TEMPLATE_MESSAGES` dans
      le mapper : nom pris, encore en construction, pas prêt, disque utilisé, réseau inactif…).
- [x] Fausse API (mode full) : templates d'exemple (un prêt, un raté), construction simulée en ~10 s
      (« fail » dans la configuration = échec), création de VM en tâche de 3 s.
- [x] Versions (contrat de l'API du 25 octobre, migration `0003_template_versions`) : `TemplateVersion`,
      `BuildLog`, `TemplateAccessEntry`, `TemplateVisibility`, statuts `stopping` / `cancelled`. Page
      `template-detail` (admin) : versions (journal, VM depuis une version, suppression), configuration,
      accès (`template-access-list` + modale) ; Reconstruire, Arrêter / Forcer l'arrêt, Modifier (le
      formulaire sert aussi à la modification), Supprimer ; rappel quand la définition a changé depuis la
      dernière version. `template-log-modal` suit le journal en direct ; `app-code-block` gagne `maxHeight`
      et `followEnd`. L'ancienne `template-detail-modal` est supprimée.
- [ ] **Non testé** contre une vraie construction Packer (la vraie API du port 3000 n'a reçu que des `GET`).

### Documentation

- [x] README.md, GUIDE.md (recettes et exercices), CLAUDE.md, ce plan.

## 2. Écarts constatés avec l'API (relevés le 14 octobre 2026)

> Historique : tous ces écarts ont été résolus (voir la section 1). Les disques et réseaux, alors en 501, sont
> maintenant fournis par l'API ; l'authentification est traitée dans la section « Authentification… ».

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

### Étape 5 — Disques et réseaux (FAIT sur la branche `infra`, fusionnée dans `auth` ; reste la suppression de réseau)

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
| 22 octobre 2026 | Branche `infra` (Martageix) : création et suppression de disques et réseaux, clic sur une VM. |
| 23 octobre 2026 | Branche `auth` : authentification, rôles, prêt de VM, quotas, administration, fausse API, leçon 18. |
| 24 octobre 2026 | `main` (abdellatif212) fusionné dans `auth` : récapitulatif et filtres des VM, suivi de l'arrêt, modes de disque (nouveau / existant / aucun). Corrigés au passage : polling borné à 1 minute, statut `shutting_down`, nom de VM sans point initial, commentaires pédagogiques restaurés, fausse API en `stopped`. |
| 25 octobre 2026 | Templates Packer : onglet « Templates », construction (admin), création de VM depuis un template, fausse API. |
| 25 octobre 2026 | Templates : versions, reconstruction, arrêt, journal en direct, accès restreint (nouveau contrat de l'API). |
