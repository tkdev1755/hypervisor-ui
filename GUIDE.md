# Guide pour débuter

Ce guide complète la page **Apprendre** de l'application (dix-sept leçons avec le
résultat en direct). Commencez par les leçons, puis revenez ici pour les
recettes et les exercices.

## 1. Le vocabulaire en une page

| Mot | En une phrase |
|---|---|
| **TypeScript** | Du JavaScript avec des types : l'éditeur signale les erreurs avant même de lancer le code. |
| **Composant** | Un morceau d'écran : un dossier avec un `.ts` (la logique), un `.html` (l'affichage) et un `.scss` (l'apparence). |
| **Template** | Le `.html` d'un composant. |
| **Signal** | Une valeur qui peut changer ; quand elle change, l'écran se met à jour tout seul. |
| **input() / output()** | Ce qu'un composant reçoit de son parent / ce qu'il lui signale. |
| **Service** | Une classe partagée par toute l'application ; chez nous, ce sont eux qui appellent l'API. |
| **inject()** | La façon d'obtenir un service dans un composant. |
| **Observable** | Une réponse qui arrivera plus tard (un appel HTTP) ; `.subscribe()` dit quoi faire à son arrivée. |
| **Route** | L'association d'une adresse (`/hypervisors`) et d'une page. |
| **Paramètre d'adresse** | Une partie variable de l'adresse (`:id`), reçue par la page dans un `input()` du même nom (leçon 11). |
| **ModalRef** | La « télécommande » d'une modale ouverte : `close(résultat)` pour la fermer, `afterClosed$` pour récupérer le résultat (leçons 12 et 13). |
| **ContextBridge** | Un cache en mémoire pour passer une donnée d'une page à l'autre : `prime`, `peek`, `resolve`, `invalidate` (leçon 14). |
| **linkedSignal / effect** | Une valeur calculée mais modifiable / une action déclenchée par un changement de signal (leçon 15). |
| **Opérateur RxJS** | Une étape de `.pipe(...)` qui transforme un Observable : `switchMap`, `filter`, `take`… (leçon 16). |
| **InjectionToken** | Un « nom » pour injecter autre chose qu'une classe, par exemple une liste de mappers d'erreurs (leçon 17). |
| **Générique** | Un type paramétré (`<K extends ContextType>`) qui s'adapte à ce qu'on lui donne (leçon 17). |

## 2. Lire un écran

Prenez `src/app/pages/hypervisor-list/`. Le `.html` se lit comme un plan :

```html
<app-page title="Hyperviseurs">                    une page avec un titre
  <app-button actions (pressed)="add()">           un bouton en haut à droite, qui appelle add()
  @if (loading()) {                                 si ça charge...
    <app-loading />                                 ...un indicateur de chargement
  } @else if (error(); as error) {                  sinon, s'il y a une erreur...
    <app-error-panel [error]="error" />             ...on l'affiche
  } @else {                                         sinon...
    <app-grid>                                      ...une grille
      @for (hypervisor of hypervisors(); ...) {     avec une carte par hyperviseur
        <app-resource-card [title]="hypervisor.name" />
```

Et le `.ts` contient les données (`hypervisors`, `loading`, `error`) et les
actions (`load()`, `add()`, `remove()`).

## 3. Recettes

### Ajouter une page

1. `npx ng generate component pages/ma-page` crée les trois fichiers.
2. Dans `app.routes.ts`, ajoutez une ligne dans `children` :
   ```ts
   { path: 'ma-page', title: 'Ma page · Hypervisor', loadComponent: () => import('./pages/ma-page/ma-page.component').then((m) => m.MaPageComponent) },
   ```
3. Pour un lien dans la barre latérale : une ligne dans `nav`
   (`components/shell/shell.component.ts`).
4. Dans le `.html`, commencez par `<app-page title="Ma page">...</app-page>`, et
   n'oubliez pas d'ajouter `PageComponent` dans la liste `imports` du `.ts`.

### Mettre en page un écran

Dessinez d'abord l'écran en boîtes, puis traduisez :

| Je veux... | J'écris... |
|---|---|
| des éléments l'un sous l'autre | `<app-column [gap]="12">` |
| des éléments côte à côte | `<app-row [gap]="8">` |
| un élément qui prend la place restante | `<app-expanded>` |
| pousser un bouton tout à droite | `<app-spacer />` avant le bouton |
| de l'espace autour | `<app-padding [all]="16">` |
| un espace vide entre deux blocs | `<app-sized-box [height]="24" />` |
| des cartes en grille | `<app-grid [minItemWidth]="260">` |
| un bloc blanc encadré | `<app-card>` |
| du texte | `<app-text variant="heading" color="muted">` |

### Appeler un nouvel endpoint de l'API

1. Ajoutez le type dans `models/` (recopié depuis `models.rs` de l'API).
2. Ajoutez la méthode dans le service concerné (`services/`) :
   ```ts
   getVnc(hypervisorId: string, vmId: string): Observable<VncInfo> {
     return this.http.get<VncInfo>(`/api/hypervisors/${hypervisorId}/vms/${vmId}/vnc`, { context: this.context });
   }
   ```
3. Appelez-la depuis le composant, avec `.subscribe()`.

### Afficher une liste qui se charge

Toujours les trois mêmes signals et les trois mêmes états (modèle :
`components/disk-list/`) :

```ts
readonly items = signal<Disk[]>([]);
readonly loading = signal(true);
readonly error = signal<AppError | null>(null);
```

```html
@if (loading()) {
  <app-loading />
} @else if (error(); as error) {
  <app-error-panel [error]="error" [retryable]="true" (retry)="load()" />
} @else {
  @for (item of items(); track item.id) { ... } @empty { <app-empty-state title="Rien ici" /> }
}
```

### Un formulaire

Un signal par champ, relié avec `[(value)]` (modèle :
`components/vm-form-modal/`) :

```ts
readonly nom = signal('');
readonly erreurNom = computed(() => (this.nom() === '' ? 'Le nom est obligatoire.' : null));
```

```html
<app-text-field label="Nom" [(value)]="nom" [error]="erreurNom()" (enter)="valider()" />
```

### Ouvrir une modale

> Le principe complet, avec une modale d'exemple à essayer : leçons 12 et 13
> de la page Apprendre (partie « Avancé »).

1. Créez le composant de la modale, avec `<app-modal-shell>` et un signal
   `state` (`'form' | 'loading' | 'success' | 'error'`). Modèle :
   `components/vm-form-modal/`.
2. Dans la modale, `inject(ModalRef)` permet de la fermer :
   `this.modalRef.close(resultat)`.
3. Depuis la page :
   ```ts
   this.modal.open<MaModaleComponent, Resultat>(MaModaleComponent, { inputs: { ... } })
     .afterClosed$.subscribe((resultat) => { if (resultat) this.load(); });
   ```

Pour une simple confirmation (suppression), utilisez `ConfirmModalComponent` :
voir `remove()` dans `pages/hypervisor-list/hypervisor-list.component.ts`.

### Ajouter une erreur métier

1. Ajoutez le code dans `BusinessErrorCode` (`models/app-error.model.ts`).
2. Ajoutez son titre et son message dans `CATALOG`
   (`errors/hypervisor-api-error-mapper.ts`).
3. Associez-lui un code HTTP dans `businessCode()`.

Aucune page à modifier : `<app-error-panel>` affiche déjà tout.

## 4. Exercices

Du plus simple au plus complet. Travaillez avec `npm run mock:full`.

1. **Changer un texte** : modifiez le sous-titre de la page Hyperviseurs.
2. **Afficher un total** : sous la liste des disques, la taille totale avec un
   `computed()` et un `<app-text>`.
3. **Créer un disque** : une modale sur le modèle de `vm-form-modal`, le format
   choisi par `<app-choice-cards>` (qcow2 / raw), et
   `InfrastructureService.createDisk`.
4. **Créer un réseau** : nom et bridge facultatif, avec `createNetwork`.
5. **Filtrer les VM** : un `<app-text-field>` au-dessus de la liste, un
   `signal()` pour le texte et un `computed()` pour la liste filtrée.
6. **Cloner une VM** : un bouton dans chaque ligne, une modale qui demande le
   nouveau nom, et `VmService.clone`.

## 5. Pièges fréquents

| Symptôme | Cause probable |
|---|---|
| « 'app-xxx' is not a known element » | Le composant manque dans la liste `imports` du `.ts`. |
| L'écran ne se met pas à jour | Un tableau modifié en place (`push`) au lieu d'un nouveau tableau (`update`). |
| La requête n'apparaît pas dans l'onglet Réseau | Il manque `.subscribe()`. |
| Une valeur s'affiche bizarrement | Il manque les parenthèses : `nom()` et non `nom`. |
| Erreur CORS dans la console | Le front n'a pas été lancé avec `npm start`. |
| « API injoignable » partout | L'API n'est pas lancée (`cargo run` ou `npm run mock`). |
