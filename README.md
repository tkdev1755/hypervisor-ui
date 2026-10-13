# Hypervisor UI

Le front Angular du « simili Proxmox » : il gère des hyperviseurs KVM et leurs
machines virtuelles, disques et réseaux, en appelant hypervisor-api (Rust, Axum).

Angular 21 · Bootstrap 5 · Angular CDK (modales).

> **Jamais fait d'Angular ni de TypeScript ?** Lancez le projet et ouvrez la page
> **Apprendre** : dix leçons courtes, avec le code et son résultat en direct.
> Ensuite, lisez [GUIDE.md](GUIDE.md).

## Démarrer

**Prérequis :** Node 22.12 ou plus récent (`nvm use` lit la version dans `.nvmrc`).

```bash
nvm use
npm install
```

**1. Lancer une API**, au choix :

| Commande | Quand l'utiliser |
|---|---|
| `cargo run` dans hypervisor-api | Sous Linux avec libvirt : la vraie API. |
| `npm run mock` | Sans Linux : une fausse API, avec les mêmes routes. |
| `npm run mock:full` | La fausse API, avec des VM, disques et réseaux d'exemple. |

Les deux écoutent sur le port 3000. Dans la fausse API, une URI contenant
`fail` simule un hôte libvirt injoignable.

**2. Lancer le front :**

```bash
npm start
```

Puis ouvrir <http://localhost:4200>.

> **Pourquoi un proxy ?** Le front (port 4200) et l'API (port 3000) n'ont pas
> la même adresse : le navigateur bloquerait les appels (CORS). Le fichier
> `proxy.conf.json` fait passer `/api` et `/ping` par le serveur Angular. Dans
> le code, on écrit donc simplement `this.http.get('/api/hypervisors')`.

## Organisation du code

Une organisation Angular classique : un dossier par sorte de fichier.

```text
src/app/
├── app.component.*          Le composant racine
├── app.config.ts            Ce qu'Angular fournit à toute l'application
├── app.routes.ts            Les pages et leurs adresses
│
├── pages/                   Une page = un dossier (home, learn, hypervisor-list...)
├── components/              Les composants réutilisables
│   ├── layout/              Mise en page à la Flutter : column, row, padding, card...
│   ├── ui/                  Texte, bouton, champ, icône, liste, badge, erreur...
│   ├── modal/               Le cadre commun des modales, la modale de confirmation
│   ├── lessons/             Les leçons de la page Apprendre
│   ├── shell/               La barre latérale
│   └── vm-list/, ...        Les composants métier (listes, formulaires)
├── services/                Les appels à l'API, les modales, le ContextBridge
├── models/                  Les types des données (Hypervisor, VirtualMachine...)
├── interceptors/            L'intercepteur d'erreurs HTTP
├── errors/                  La traduction des erreurs de l'API
├── config/                  Les réglages du ContextBridge
└── utils/                   Petites fonctions utilitaires
```

**Chaque composant a trois fichiers** : `xxx.component.ts` (la logique),
`xxx.component.html` (l'affichage) et `xxx.component.scss` (l'apparence).

Les imports s'écrivent depuis la racine, avec l'alias `@app/` :
`import { HypervisorService } from '@app/services/hypervisor.service';`

## Pas de HTML ni de CSS à écrire

Les pages s'assemblent uniquement avec des composants, comme en Flutter :

```html
<app-page title="Hyperviseurs">
  <app-button actions icon="plus" (pressed)="ajouter()">Ajouter</app-button>

  <app-card>
    <app-row [gap]="16">
      <app-icon name="server" />
      <app-expanded>
        <app-column [gap]="4">
          <app-text variant="heading">kvm-local</app-text>
          <app-text color="muted">qemu:///system</app-text>
        </app-column>
      </app-expanded>
      <app-status-badge status="connected" />
    </app-row>
  </app-card>
</app-page>
```

| Mise en page (`components/layout`) | Interface (`components/ui`) |
|---|---|
| `app-column`, `app-row` : empiler, aligner | `app-text` : du texte stylé |
| `app-padding`, `app-sized-box` : espacer | `app-button` : bouton ou lien |
| `app-expanded`, `app-spacer` : répartir la place | `app-text-field` : un champ de saisie |
| `app-center` : centrer | `app-icon`, `app-status-badge` |
| `app-grid` : une grille de cartes | `app-list`, `app-list-tile` : une liste |
| `app-card` : un bloc blanc, cliquable ou non | `app-resource-card` : la carte d'une ressource |
| `app-divider` : un trait | `app-choice-cards`, `app-tabs` |
| `app-page` : le squelette d'une page | `app-loading`, `app-empty-state`, `app-error-panel` |
| | `app-callout`, `app-code-block`, `app-inline-code` |

Chaque composant explique ses options en commentaire, en haut de son `.ts`. La
leçon 10 de la page Apprendre en montre un exemple complet.

## Le socle technique

Quatre briques, reprises d'un projet en production :

1. **Les composants d'interface** (ci-dessus) : toute la logique d'interaction
   est dans leur TypeScript, jamais dans les pages.
2. **Le moteur d'erreurs** (`interceptors/`, `errors/`, `models/app-error.model.ts`) :
   chaque requête porte le nom de son API ; quand elle échoue, l'intercepteur la
   transforme en `AppError`, métier (« Hyperviseur injoignable ») ou technique
   (panne, avec des détails dépliables). Une page affiche toute erreur avec
   `<app-error-panel [error]="error" />`.
3. **Le ContextBridge** (`services/context-bridge.service.ts`) : passer une
   donnée d'une page à l'autre sans la recopier dans l'adresse.
   `prime('hypervisor', id, h)` la range, `resolve('hypervisor', id)` la relit,
   depuis l'API si besoin.
4. **Les modales** (`services/modal.service.ts`, `components/modal/`) :
   `this.modal.open(MaModaleComponent, { inputs: { ... } })`. Le cadre
   `<app-modal-shell>` gère les états formulaire → chargement → succès / erreur,
   et empêche de fermer la modale pendant un chargement.

## Le design system

Les couleurs, espacements, rayons et ombres sont des variables définies dans
`src/styles/_tokens.scss`. Bootstrap est configuré avec ces valeurs dans
`_bootstrap.scss`. Les composants s'en servent : dans les pages, on n'a jamais
besoin d'y toucher.

## Commandes

| Commande | Effet |
|---|---|
| `npm start` | Serveur de développement, rechargement automatique |
| `npm run build` | Build de production dans `dist/` |
| `npm run mock` / `npm run mock:full` | Fausse API sur le port 3000 |
| `npx ng generate component components/mon-composant` | Crée un composant (ses trois fichiers) |
| `npx ng generate component pages/ma-page` | Crée une page |
| `npx ng generate service services/mon-service` | Crée un service |

## Limites connues

- Une seule modale ouverte à la fois.
- Le ContextBridge ne gère pas encore les dépendances entre types de données.
