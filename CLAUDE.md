# CLAUDE.md — guide de contexte pour les agents IA

> À lire en entier avant de modifier ce projet. Rédigé le 14 octobre 2026.
> Le plan de travail est dans [docs/implementation_plan.md](docs/implementation_plan.md).
> Les documents pour les humains : [README.md](README.md) (démarrer, organisation) et
> [GUIDE.md](GUIDE.md) (apprendre, recettes, exercices).

## 1. Le projet en bref

- **Quoi** : le front Angular d'un « simili Proxmox » (projet d'école à l'INSA
  Centre Val de Loire). Il gère des hyperviseurs KVM, leurs VM, disques et
  réseaux, en appelant **hypervisor-api**, une API Rust / Axum / libvirt
  développée par la même équipe : `~/devSTI/virt/hypervisor-api/hypervisor-api`
  (Swagger sur `http://127.0.0.1:3000/swagger-ui/`).
- **Pour qui** : une équipe d'étudiants qui **n'ont jamais fait d'Angular ni de
  TypeScript**. Le mainteneur (Taha) connaît bien Angular ; ses coéquipiers non.
  **La lisibilité pour un débutant passe avant l'élégance technique.**
- **Pile** : Angular 21 (composants autonomes, signals, sans zone.js),
  Bootstrap 5.3 (Sass, configuré par nos tokens), Angular CDK (modales).
  Aucune autre dépendance : n'en ajoutez pas sans accord explicite.
- **Langue** : interface, commentaires et documentation **en français** ;
  noms de code (classes, variables des services) en anglais. Les leçons
  utilisent volontairement des noms français (`compteur`, `nom`) pour être plus
  accessibles.

## 2. Les règles imposées par le mainteneur (non négociables)

1. **Structure Angular classique** : un dossier par sorte de fichier
   (`pages/`, `components/`, `services/`, `models/`, `interceptors/`,
   `errors/`, `guards/`, `config/`, `utils/`). Pas d'organisation « par fonctionnalité »
   (`core/`, `features/`, `shared/`) : elle a été essayée puis refusée, jugée
   illisible pour des débutants.
2. **Chaque composant a ses trois fichiers** : `xxx.component.ts`,
   `xxx.component.html`, `xxx.component.scss`. Jamais de `template:` ni de
   `styles:` dans le TypeScript, même pour un petit composant. Les noms
   gardent le suffixe classique (`.component.ts`, `.service.ts`) ;
   `angular.json` est configuré pour que `ng generate` le respecte.
3. **Pas de HTML ni de CSS dans les pages et les composants métier** : on
   assemble les composants de mise en page à la Flutter
   (`components/layout/`) et d'interface (`components/ui/`). Les `.scss` des
   pages et composants métier restent vides (`:host { display: block; }`).
   Seuls les composants de `layout/`, `ui/`, `modal/` et `shell/` contiennent
   du vrai HTML et du SCSS.
4. **Des exemples et des commentaires pour débutants** : chaque composant
   réutilisable explique ses options en commentaire en tête de son `.ts`,
   avec un exemple d'utilisation. Gardez ce niveau d'explication.

## 3. Commandes

```bash
nvm use                 # Node 22 (voir .nvmrc) — le Node de Homebrew de la machine est cassé
npm install
npm run mock            # fausse API sur :3000 (ou mock:full pour des données d'exemple)
npm start               # front sur :4200, avec le proxy /api et /ping vers :3000
npx ng build            # DOIT finir sans erreur NI avertissement
```

- **Toute l'API demande un jeton** (sauf `/ping` et `/api/auth/*`) : le front s'ouvre sur `/login`.
  Fausse API : `admin` / `admin-password`, `alice` / `alice`, `bob` / `bob`. Vraie API : l'admin
  créé au premier démarrage (`ADMIN_PASSWORD='…' JWT_SECRET='…' cargo run`, voir `docs/AUTH.md` dans
  son dépôt ; ajouter `DATABASE_URL=sqlite:///chemin/dev.db?mode=rwc` pour isoler une base de test, et
  `POST /api/hypervisors {"name":"test","uri":"test:///default"}` pour un hyperviseur factice en mémoire).
- La vraie API se lance avec `cargo run` dans son dépôt (Linux + libvirt). Si
  le port 3000 est déjà pris par `target/debug/api`, c'est la vraie API du
  mainteneur, branchée sur de **vrais hyperviseurs** : ne déclenchez aucune
  création, suppression, démarrage ou arrêt de VM dessus sans son accord.
  Utilisez `npm run mock:full` pour tester les actions.
- Après de gros changements de fichiers (suppression puis recréation de
  dossiers), le serveur `ng serve` peut rester bloqué sur une erreur de
  résolution : redémarrez-le.

## 4. Organisation

```text
src/app/
├── app.component.*, app.config.ts, app.routes.ts
├── pages/                home, login, account, learn, hypervisor-list, hypervisor-detail, vm-detail,
│                         admin-users, admin-audit, not-found
├── components/
│   ├── layout/           column, row, padding, sized-box, center, expanded, spacer, grid, card, divider, page
│   ├── ui/               text, inline-code, button, icon (+ icons.ts), status-badge, text-field, choice-cards,
│   │                     tabs, code-block, error-panel, loading, empty-state, list, list-tile, resource-card, callout, frame, number-field
│   ├── modal/            modal-shell (cadre + états), confirm-modal
│   ├── lessons/          lesson (cadre), hello-card, demo-vm-card, demo-rename-modal, lesson-xxx (18 leçons, noms explicites)
│   ├── shell/            barre latérale (+ sidebar-inventory : arbre hyperviseurs → VM) + <router-outlet>
│   └── hypervisor-form-modal, vm-form-modal, vm-clone-modal, vm-delete-modal, vm-console-modal,
│       vm-share-modal, vm-owner-modal, vm-list, disk-list, network-list,
│       hypervisor-access-list + hypervisor-access-modal, user-picker,
│       user-form-modal, user-quota-modal, user-password-modal, password-form-modal   (composants métier)
├── services/             auth (session, jetons), hypervisor, vm, share (prêts), user, admin (réglages, audit, accès),
│                         job, inventory (arbre de la barre latérale), infrastructure (API), modal (+ modal-ref), context-bridge
├── models/               types recopiés de src/models.rs de l'API, et app-error.model.ts
├── interceptors/         auth.interceptor.ts (jeton + refresh), error.interceptor.ts
├── guards/               auth.guard.ts (authGuard, adminGuard)
├── errors/               error-mapper.ts (contrat + token), hypervisor-api-error-mapper.ts (catalogue FR)
├── config/               context-descriptors.ts
└── utils/                api-context.ts (étiquette HTTP par API), layout.ts (alignements),
                          vm-access.ts (droits sur une VM), quota.ts (lignes de quota)
src/styles/               _tokens.scss (variables), _bootstrap.scss (Bootstrap configuré), _base.scss
mock-api/server.mjs       fausse API Node sans dépendance
```

Alias d'import unique : `@app/*` → `src/app/*` (dans `tsconfig.json`).

## 5. Le socle : comment il fonctionne et comment l'étendre

Ces quatre briques reprennent, en version allégée, une librairie que le
mainteneur a conçue en entreprise. Respectez leur contrat.

### Composants de mise en page et d'interface

- Options en `input()` / `model()` / `output()` uniquement (signals).
- Événement de clic des boutons : `(pressed)`, pas `(click)`. `ButtonComponent`
  appelle `stopPropagation()` pour qu'un bouton dans une carte cliquable ne
  déclenche pas aussi la carte.
- Placement par attribut (projection de contenu) : `actions` dans `app-page`,
  `footer` dans `app-modal-shell`, `demo` dans `app-lesson`. Le contenu
  par défaut d'`app-list-tile` et d'`app-resource-card` va dans leur zone
  d'actions.
- **Piège** : un attribut de projection ne doit jamais porter le nom d'un
  `input()` du même composant (sinon Angular l'interprète comme une valeur).
- Nouvelle icône : une entrée dans `components/ui/icon/icons.ts` (tracés SVG
  sur une grille de 24 px).

### Moteur d'erreurs

- Chaque appel HTTP d'un service passe `{ context: this.context }`
  (`apiContext('hypervisor-api')`). L'intercepteur choisit le mapper de l'API
  et transforme l'erreur en `AppError` (`models/app-error.model.ts`) :
  `kind: 'business'` (code + texte du catalogue) ou `kind: 'technical'`
  (détails dépliables).
- Les composants typent l'erreur en `AppError` dans `error:` et l'affichent
  avec `<app-error-panel>`.
- Nouvelle erreur métier : `BusinessErrorCode` + `CATALOG` + `businessCode()`
  dans `errors/hypervisor-api-error-mapper.ts`. Le message affiché vient du
  catalogue français, jamais du message anglais de l'API.
- Nouvelle API appelée : un nom dans `ApiName` (`utils/api-context.ts`), un
  nouveau mapper, `provideErrorMapper(...)` dans `app.config.ts`.

### ContextBridgeService

- Cache mémoire `type::id`. `prime()` range, `peek()` lit, `resolve()` lit ou
  recharge via le descripteur (`config/context-descriptors.ts`), avec
  déduplication des appels simultanés (`shareReplay`).
- Nouveau type : une ligne dans `ContextTypes`
  (`services/context-bridge.service.ts`) + un descripteur.
- Penser à `invalidate()` après une modification ou une suppression.
- Volontairement absent : la résolution de dépendances entre types et la
  détection de cycles (présentes dans la version d'origine). À n'ajouter que
  si un vrai besoin apparaît.

### Modales

- `ModalService.open<Composant, Résultat>(Composant, { inputs, size })` ; les
  `inputs` sont typés automatiquement (`InputsOf<C>`). Une seule modale à la
  fois.
- Le composant ouvert injecte `ModalRef` et se ferme avec `close(résultat)`.
- `<app-modal-shell>` affiche les états `form` → `loading` → `success` /
  `error` et bloque la fermeture pendant `loading` (`closeGuard`).
- Formulaires : un `signal()` par champ relié par `[(value)]` à
  `<app-text-field>`, erreurs en `computed()` affichées après un premier
  essai (`submitted`). **Pas de formulaires réactifs** : jugés trop complexes
  pour l'équipe.

### Authentification et droits

- `AuthService` (`services/auth.service.ts`) tient la session : `user()` (signal), `isAdmin()`,
  `login()`, `logout()`, `refresh()`, `loadMe()`. Access token **en mémoire**, refresh token dans
  `sessionStorage` (rechargement = session rouverte par `provideAppInitializer` dans `app.config.ts`).
- `authInterceptor` ajoute le Bearer aux appels `/api/*` (pas `/api/auth/*`), et sur un 401
  « session expirée » fait **un seul** refresh partagé (`shareReplay`) puis rejoue la requête une fois.
  Il est placé **avant** `errorInterceptor` : il reçoit donc des `AppError`, et lit leur **code métier**
  (`SESSION_EXPIRED`), pas le seul statut 401 : un 401 sur `PUT /api/me/password` veut dire
  « mauvais mot de passe actuel » (`INVALID_CREDENTIALS`), il ne doit pas déconnecter.
- Le refresh token est **à usage unique** : jamais deux refresh en parallèle.
- Gardes : `authGuard` (connecté, sinon `/login?returnUrl=…`), `adminGuard`. Les routes `/admin/*`
  les utilisent ; `/login` est hors du `ShellComponent`.
- **Le front cache, l'API fait respecter.** Les boutons interdits sont masqués (`auth.isAdmin()`,
  `vm.access === 'shared'`, `vm-options` en 403 → pas de « Créer une VM »), mais un 403 ou un 404
  peut toujours arriver (rôle changé, compte désactivé) : tout écran doit savoir afficher l'erreur.
- `403` = « pas le droit » ; `404` = « aucun droit sur cette ressource » (elle peut exister) : ne pas
  les distinguer pour l'utilisateur. Un quota dépassé est un 403 dont le message contient
  `Quota exceeded` : le mapper en tire un texte français (`QUOTA_EXCEEDED`).
- À la déconnexion, `AuthService` vide tout ce qui dépend des droits : jetons, `ContextBridge`
  (un hyperviseur en cache montre son `uri` à un admin), `InventoryService`. Tout nouveau cache
  dépendant de l'utilisateur doit y être vidé aussi.
- `VirtualMachine.owner` / `access` (`'admin' | 'owner' | 'shared'`) pilotent l'affichage
  (`utils/vm-access.ts`) : une VM prêtée n'offre que console, démarrer, arrêter, « Rendre ».
- La suppression de réseau est **masquée** (la vraie API n'a pas de `DELETE …/networks/{id}`) :
  `NetworkDeleteModalComponent` et `deleteNetwork` existent, à rebrancher quand la route existera.

## 6. Pièges rencontrés pendant le développement

- **Accolades dans un template** : `&#123;&#123; x &#125;&#125;` est quand
  même interprété comme une interpolation. Pour afficher `{{ }}`, passez par
  une propriété de la classe (voir `accolades` dans la leçon 6). Pour `@`,
  l'entité `&#64;` fonctionne.
- **Sans zone.js** : une propriété ordinaire modifiée dans un gestionnaire
  d'événement du template se met bien à jour à l'écran (leçons 1 à 4), mais
  une valeur modifiée de façon asynchrone (requête, minuteur) doit être un
  signal.
- **Sass** : Bootstrap utilise encore `@import` ; les avertissements sont
  réduits au silence dans `angular.json` (`silenceDeprecations`). N'y ajoutez
  pas `mixed-decls` (obsolète, provoque un avertissement).
- **Leçons avancées (11 à 18)** : leurs démos utilisent les vrais services
  (`ModalService`, `ContextBridgeService`, `Router`, les jetons d'injection)
  mais **ne doivent jamais modifier quoi que ce soit côté API** : modales
  simulées avec `timer` / `throwError`, ContextBridge avec un identifiant
  fictif (`demo-lecon`) dont seul le `GET` part (404 attendu). Gardez cette
  règle pour toute nouvelle leçon : le port 3000 peut être la vraie API.
- **Leçons : code d'exemple** : l'exemple est une chaîne TypeScript
  (backticks) ; n'y mettez ni backtick ni `${`. Dans le `.html`, les
  commentaires `<!-- -->` ne vont pas à l'intérieur d'une balise.
- **Budget** : le bundle initial fait ~545 ko bruts (~110 ko transférés),
  surtout les utilitaires Bootstrap ; le budget est réglé à 700 ko.

## 7. Comment vérifier son travail

1. `npx ng build` : zéro erreur, **zéro avertissement** (les imports inutilisés
   de composants déclenchent NG8113 : retirez-les).
2. Chaque nouveau composant a ses trois fichiers :
   ```bash
   cd src/app && for f in $(find . -name "*.component.ts"); do b=${f%.ts}; [ -f "$b.html" ] && [ -f "$b.scss" ] || echo "INCOMPLET: $f"; done
   ```
3. Vérification visuelle avec `npm run mock:full` + `npm start` (se connecter avec les trois comptes
   d'exemple : l'administrateur et un utilisateur n'ont pas les mêmes écrans) : la page
   concernée, ses trois états (chargement, erreur, données), et une modale
   jusqu'à son succès.
4. Mettez à jour la documentation touchée (README, GUIDE, ce fichier, le plan).
