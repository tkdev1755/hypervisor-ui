import { Routes } from '@angular/router';

import { ShellComponent } from './components/shell/shell.component';
import { HomeComponent } from './pages/home/home.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

/**
 * Les pages de l'application : chaque route associe une adresse à un composant.
 *
 * - ShellComponent est la mise en page commune (barre latérale) : ses
 *   « children » s'affichent à l'intérieur.
 * - loadComponent charge une page seulement quand on la visite (lazy loading).
 * - title change le titre de l'onglet du navigateur.
 */
export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', component: HomeComponent, title: 'Accueil · Hypervisor' },
      {
        path: 'learn',
        title: 'Apprendre · Hypervisor',
        loadComponent: () => import('./pages/learn/learn.component').then((m) => m.LearnComponent),
      },
      {
        path: 'hypervisors',
        title: 'Hyperviseurs · Hypervisor',
        loadComponent: () => import('./pages/hypervisor-list/hypervisor-list.component').then((m) => m.HypervisorListComponent),
      },
      {
        // :id devient l'input() `id` de la page.
        path: 'hypervisors/:id',
        title: 'Hyperviseur · Hypervisor',
        loadComponent: () =>
          import('./pages/hypervisor-detail/hypervisor-detail.component').then((m) => m.HypervisorDetailComponent),
      },
      {
        path: 'hypervisors/:id/vms/:vmId',
        title: 'Machine virtuelle · Hypervisor',
        loadComponent: () => import('./pages/vm-detail/vm-detail.component').then((m) => m.VmDetailComponent),
      },
      { path: '**', component: NotFoundComponent, title: 'Page introuvable · Hypervisor' },
    ],
  },
];
