# Architecture de l'application

Ce document explique comment le front est construit et pourquoi on a fait ces choix. Il est écrit pour quelqu'un qui découvre le projet. Pour apprendre Angular, il y a la page Apprendre de l'application et le [GUIDE.md](../GUIDE.md). Pour démarrer, le [README.md](../README.md).

## 1. Ce que fait l'application

C'est le front d'un « simili Proxmox ». Il permet de gérer des hyperviseurs KVM, leurs machines virtuelles, leurs disques et leurs réseaux. Il gère aussi des utilisateurs avec des rôles, des quotas, des prêts de VM, des templates (des VM construites avec Packer), des labos (plusieurs VM sur plusieurs réseaux, qu'on déploie en instances) et des groupes.

Le front ne fait aucun calcul métier. Tout passe par une API, `hypervisor-api` (Rust, Axum, libvirt), développée par la même équipe. Le front affiche ce que l'API répond et lui envoie ce que l'utilisateur demande.

```text
navigateur  →  haproxy (HTTPS)  →  nginx (le site + /api)  →  hypervisor-api  →  libvirt
```

En développement, on n'a ni haproxy ni nginx : `ng serve` joue les deux rôles (voir `proxy.conf.json`).

## 2. La pile technique

- Angular 21, avec des composants autonomes, des signals, et sans zone.js.
- Bootstrap 5.3, utilisé en Sass et réglé par nos propres variables (`src/styles/_tokens.scss`).
- Angular CDK, seulement pour les modales.
- RxJS pour les appels HTTP.

C'est tout. On n'ajoute pas de dépendance sans accord. Moins de dépendances, c'est moins de mises à jour et moins de failles à suivre. Il n'y a donc ni librairie de modales, ni librairie d'icônes, ni librairie de formulaires.

## 3. Organisation des dossiers

On a un dossier par sorte de fichier. On n'a pas de dossiers par fonctionnalité (`core/`, `features/`, `shared/`). On l'a essayé, c'était illisible pour des gens qui n'ont jamais fait d'Angular.

```text
src/app/
├── pages/          une page = un dossier (c'est ce que le routeur affiche)
├── components/     les morceaux d'écran réutilisables
│   ├── layout/     la mise en page : column, row, card, grid, page...
│   ├── ui/         l'interface : text, button, text-field, tabs, list...
│   ├── modal/      le cadre des modales et la modale de confirmation
│   ├── shell/      la barre latérale
│   ├── lessons/    les leçons de la page Apprendre
│   └── (le reste)  les composants métier : vm-list, template-form-modal...
├── services/       les appels à l'API, les modales, la session
├── models/         les types des données de l'API
├── interceptors/   ce qui se passe sur toutes les requêtes HTTP
├── guards/         qui a le droit d'ouvrir quelle page
├── errors/         la traduction des erreurs de l'API
├── config/         le réglage du ResourceCache
└── utils/          des petites fonctions
```

L'import `@app/...` pointe toujours vers `src/app/`. C'est le seul alias.

## 4. Les composants

Chaque composant a trois fichiers : `xxx.component.ts` (la logique), `xxx.component.html` (l'affichage) et `xxx.component.scss` (l'apparence). Jamais de `template:` ni de `styles:` dans le TypeScript, même pour un petit composant. Comme ça, tous les composants se ressemblent et on sait toujours où chercher.

Il y a trois sortes de composants.

- `layout/` : la mise en page, à la Flutter. `app-column`, `app-row`, `app-card`, `app-grid`, `app-page`...
- `ui/` : les éléments d'interface. `app-text`, `app-button`, `app-text-field`, `app-tabs`, `app-list-tile`, `app-error-panel`...
- Les composants métier : ceux qui connaissent l'API (`vm-list`, `template-form-modal`...).

Seuls `layout/`, `ui/`, `modal/` et `shell/` contiennent du vrai HTML et du SCSS. Les pages et les composants métier n'assemblent que des composants `layout/` et `ui/`. Leur `.scss` est vide. On a fait ça pour que l'équipe n'ait pas à apprendre HTML et CSS en même temps qu'Angular.

Les options d'un composant sont toujours des `input()`, `model()` et `output()`. L'événement de clic d'un bouton s'appelle `(pressed)`, pas `(click)`. Chaque composant réutilisable explique ses options en commentaire, avec un exemple, au début de son `.ts`.

## 5. Les pages et le routage

Les routes sont dans `app.routes.ts`. Chaque page est chargée seulement quand on la visite (`loadComponent`), ce qui garde le premier chargement léger.

- `/login` est en dehors du shell. Pas de barre latérale avant la connexion.
- Tout le reste est dans le `ShellComponent` (la barre latérale et la page courante), protégé par `authGuard`.
- Les pages d'administration (`/admin/...`) ont aussi `adminGuard`.
- Les paramètres d'adresse (`:id`, `:vmId`...) arrivent directement dans un `input()` de la page, grâce à `withComponentInputBinding()`. On n'a jamais à lire la route à la main.

Les pages d'un template, d'un labo et d'une instance n'ont pas de garde. Le droit ne dépend pas du rôle mais de l'objet : on peut gérer un template sans être admin. C'est la page qui lit ce que l'API dit (`access`), et c'est l'API qui fait respecter.

## 6. Les services et les appels à l'API

Un composant ne fait jamais d'appel HTTP lui-même. Il demande à un service, qu'il obtient avec `inject()`. Il y a un service par groupe de routes : `HypervisorService`, `VmService`, `TemplateService`, `LabService`, `GroupService`, `UserService`...

Chaque méthode renvoie un `Observable`. La requête ne part que quand on fait `.subscribe()`.

Chaque appel porte une étiquette : `{ context: this.context }` (`apiContext('hypervisor-api')`). Elle dit à l'intercepteur d'erreurs de quelle API vient la réponse. Aujourd'hui il n'y en a qu'une, mais le jour où le front en appelle une autre, on ajoute un nom et un mapper, sans toucher aux services existants.

Les types des données (`models/`) sont recopiés de l'API. Si l'API change un champ, on le change dans le modèle et TypeScript montre tous les endroits à corriger.

## 7. Les erreurs

Les composants ne voient jamais une erreur HTTP brute. L'intercepteur d'erreurs la transforme en `AppError`. Il en existe deux sortes.

- `business` : une erreur que l'utilisateur peut comprendre (introuvable, quota dépassé, session expirée...). Elle a un code et un texte.
- `technical` : une panne (API arrêtée, erreur 500). On affiche un message simple et les détails sont dans un encadré déplié à la demande.

Les textes sont dans un catalogue en français (`errors/hypervisor-api-error-mapper.ts`). On n'affiche jamais le message de l'API : il est en anglais et écrit pour des développeurs. Pour les erreurs plus précises (quota, template, labo, groupe), le mapper reconnaît le message de l'API et le remplace par une phrase en français. Pour un quota, il y reprend aussi le nom de la limite et les chiffres.

L'affichage est toujours le même : `<app-error-panel [error]="error" />`.

## 8. L'authentification

L'API demande un jeton sur toutes les routes sauf `/ping` et `/api/auth/*`.

- À la connexion, l'API donne deux jetons. L'access token dure 15 minutes et part avec chaque requête. Le refresh token dure 7 jours et sert à en obtenir un nouveau.
- L'access token est gardé en mémoire (un signal). Le refresh token est dans `sessionStorage` pour qu'un rechargement de la page ne déconnecte pas.
- Le refresh token ne sert qu'une fois. Si deux requêtes essaient de rafraîchir en même temps, la deuxième échoue et l'utilisateur est déconnecté. Il y a donc un seul refresh à la fois, partagé avec `shareReplay`.

`AuthService` tient la session. `authInterceptor` ajoute le jeton, et quand l'API répond « session expirée », il fait un refresh puis rejoue la requête une seule fois. Si ça échoue, retour à `/login`.

L'ordre des intercepteurs compte. `authInterceptor` est placé avant `errorInterceptor`, donc il reçoit des `AppError` et pas des erreurs HTTP. Il se fie au code (`SESSION_EXPIRED`) et pas au statut 401. Un 401 sur « changer mon mot de passe » veut dire que l'ancien mot de passe est faux, pas que le jeton a expiré, et il ne doit pas déconnecter.

À la déconnexion, on vide tout ce qui dépend de l'utilisateur : les jetons, le ResourceCache et l'inventaire. Sinon l'utilisateur suivant verrait des données qui ne sont pas à lui.

## 9. Les droits : le front cache, l'API fait respecter

Le front masque les boutons interdits : pas de « Utilisateurs » dans le menu pour un simple utilisateur, pas de « Supprimer » sur une VM prêtée, pas de « Créer une VM » si l'API refuse. C'est du confort. La vraie sécurité est dans l'API.

Un 403 ou un 404 peut donc toujours arriver (un rôle a changé, un compte a été désactivé). Chaque écran sait afficher l'erreur.

Quelques règles :

- 403 veut dire « tu n'as pas le droit de faire ça ». 404 veut dire « tu n'as aucun droit sur cette ressource », et elle peut exister. L'utilisateur ne voit pas la différence.
- Chaque VM dit ce que l'utilisateur peut en faire : `access` vaut `admin`, `owner` ou `shared`. Une VM prêtée n'offre que la console, démarrer, arrêter et « Rendre ».
- Chaque template et chaque labo dit aussi ce qu'on peut en faire (`access.level`). L'interface se base là-dessus, jamais seulement sur « est-ce un admin ».
- Un droit peut être donné à un utilisateur ou à un groupe.

## 10. Le ResourceCache

Quand on clique sur un hyperviseur dans la liste, la page de détail a besoin de cet hyperviseur. La liste l'a déjà chargé. On pourrait mettre tous ses champs dans l'adresse, mais c'est fragile et l'utilisateur peut les modifier. On pourrait aussi le recharger, mais c'est une requête inutile.

Le `ResourceCacheService` est un cache en mémoire. La liste range l'hyperviseur (`prime`), l'adresse ne garde que son identifiant, et la page de détail le relit (`resolve`). Si le cache est vide (page rafraîchie, lien partagé), `resolve` le recharge depuis l'API. Deux appels en même temps ne font qu'une seule requête.

Après une modification ou une suppression, il faut appeler `invalidate`, sinon la page de détail affiche l'ancienne version.

Pour l'instant il ne gère que les hyperviseurs. Pour ajouter un type, on met une ligne dans `ResourceTypes` et un descripteur dans `config/resource-descriptors.ts`. On n'a volontairement pas repris la gestion des dépendances entre types de la version d'origine. On l'ajoutera si un vrai besoin apparaît.

## 11. Les modales

On n'écrit jamais une modale dans un `.html`. On l'ouvre depuis le code :

```ts
this.modal
  .open<MaModaleComponent, Resultat>(MaModaleComponent, { inputs: { ... }, size: 'sm' })
  .afterClosed$.subscribe((resultat) => { ... });
```

Les `inputs` sont vérifiés par TypeScript. Une seule modale est ouverte à la fois. La modale se ferme avec `modalRef.close(résultat)`, et `afterClosed$` donne ce résultat à celui qui l'a ouverte. Il vaut `undefined` si on a annulé.

Toutes les modales utilisent `<app-modal-shell>`. Il affiche le titre, la croix, et les quatre états : `form`, `loading`, `success`, `error`. Pendant `loading`, la modale ne peut pas être fermée.

On a choisi CDK Overlay plutôt qu'une librairie de modales. C'est moins de dépendances, et le socle vient d'un projet en production du mainteneur.

## 12. Les formulaires

On n'utilise pas les formulaires réactifs d'Angular. Ils sont trop complexes pour l'équipe. Un champ est un `signal()` relié par `[(value)]` à un `<app-text-field>`. Les erreurs sont des `computed()` qu'on n'affiche qu'après un premier essai d'envoi (un signal `submitted`). Sinon le formulaire serait rouge dès l'ouverture.

## 13. Les données qui changent

Certaines opérations sont longues. Le front interroge alors l'API à intervalles réguliers, avec un `timer` ou un `interval`, et s'arrête dès que c'est fini.

- Un clonage de VM : l'API répond tout de suite avec une tâche, qu'on interroge toutes les secondes (`JobService.watch`).
- Un arrêt propre d'une VM : la liste est rechargée toutes les 2 secondes, pendant une minute au plus.
- Une construction de template : la liste toutes les 5 secondes, la page toutes les 3 secondes.

Les pages qui créent, modifient ou suppriment quelque chose appellent `InventoryService.refresh()`. C'est ce qui met à jour l'arbre « hyperviseurs → VM » de la barre latérale.

Sans zone.js, une valeur modifiée plus tard (une requête, un minuteur) doit être un signal. Sinon l'écran ne se met pas à jour.

## 14. La fausse API

`mock-api/server.mjs` est une fausse API en Node, sans dépendance. Elle a les mêmes routes, le même port et le même format d'erreur que la vraie, avec l'authentification, les rôles, les prêts, les quotas et les templates. On l'a faite parce que les coéquipiers sur Mac ne peuvent pas lancer libvirt.

- `npm run mock` : elle se comporte comme la vraie API sans hyperviseur (VM, disques et réseaux en 501).
- `npm run mock:full` : elle ajoute des VM, des disques et des réseaux d'exemple.
- Comptes : `admin` / `admin-password`, `alice` / `alice`, `bob` / `bob`.

Quand l'API change, la fausse API doit suivre. Sinon on teste contre quelque chose qui n'existe plus.

Attention : si le port 3000 est déjà pris par la vraie API du mainteneur, elle est branchée sur de vrais hyperviseurs. On ne crée, supprime, démarre ou arrête rien dessus sans son accord.

## 15. Le conteneur et le déploiement

L'application est un site statique. Le `Dockerfile` a trois étapes :

- `build` compile l'application avec Node 22.
- `mock` contient la fausse API.
- `web` est nginx (sans droits root), qui sert les fichiers compilés et relaie `/api` et `/ping` vers l'API. Le front appelle `/api` en chemin relatif, donc c'est nginx qui prend le rôle de `ng serve`.

Devant nginx, haproxy gère le HTTPS (`haproxy/haproxy.cfg`). Il redirige le HTTP, limite les essais de mot de passe et chiffre les échanges. nginx parle à l'API par le réseau Docker de l'API, en vérifiant son certificat.

`docker-compose.yml` lance haproxy et nginx. `docker-compose.mock.yml` remplace la vraie API par la fausse. Les réglages sont dans `.env.example`, à copier en `.env` (ignoré par git).

Le workflow `.github/workflows/cd.yml` construit l'image à chaque push sur `main` et la publie sur Docker Hub (`remialban/hypervisor-ui`). Sur une pull request, il construit seulement, pour vérifier que l'image se construit.

La console VNC ne passe pas par nginx. Elle s'ouvre sur l'adresse que l'API donne (`novnc_url`), qui doit donc être joignable depuis le navigateur.

## 16. Les choix, en résumé

| Choix | Pourquoi |
|---|---|
| Un dossier par sorte de fichier | La structure par fonctionnalité était illisible pour l'équipe. |
| Trois fichiers par composant | Tous les composants ont la même forme, c'est plus simple à apprendre. |
| Composants de mise en page à la Flutter | On n'a pas à apprendre HTML et CSS en même temps qu'Angular. |
| Signals et `[(value)]`, pas de formulaires réactifs | Moins de concepts à apprendre. |
| Peu de dépendances, pas de librairie de modales ni d'icônes | Moins de mises à jour et de failles. |
| Catalogue d'erreurs en français | Les messages de l'API sont en anglais et pour les développeurs. |
| Le front cache, l'API fait respecter | On ne peut pas faire confiance à un navigateur. |
| Access token en mémoire, refresh token dans `sessionStorage` | Un script ne lit pas l'access token, et un rechargement ne déconnecte pas. |
| ResourceCache | On évite de recopier des données dans l'adresse ou de les recharger pour rien. |
| Une fausse API sans dépendance | Les coéquipiers sur Mac ne peuvent pas lancer libvirt. |
| nginx et haproxy dans le conteneur | Le site est statique et il faut un proxy vers l'API, en HTTPS. |

## 17. Ce qui manque

- Il n'y a aucun test. Le plus utile à tester en premier serait l'intercepteur d'authentification (un seul refresh, une seule relance) et le mapper d'erreurs.
- La suppression d'un réseau est masquée : l'API n'a pas de route pour ça. Le bouton et la modale existent, il faut les rebrancher quand la route existera.
- Un simple utilisateur ne peut pas chercher d'autres utilisateurs. Pour prêter une VM, il doit taper le nom exact de l'emprunteur.
- Un utilisateur qui n'a qu'un droit sur un template, sans accès à l'hyperviseur, ne voit pas l'hyperviseur. Il n'a donc pas l'onglet Templates. C'est une limite de l'API.
- La console VNC n'a pas été testée avec un vrai QEMU.
- Pas de tri, et la recherche n'existe que pour les VM et les groupes. Les autres listes longues n'en ont pas.
