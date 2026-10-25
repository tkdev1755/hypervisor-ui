import { Routes } from '@angular/router';

import { ShellComponent } from './components/shell/shell.component';
import { adminGuard, authGuard } from './guards/auth.guard';
import { HomeComponent } from './pages/home/home.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

/**
 * Les pages de l'application : chaque route associe une adresse à un composant.
 *
 * - ShellComponent est la mise en page commune (barre latérale) : ses
 *   « children » s'affichent à l'intérieur. Il demande d'être connecté (authGuard).
 * - /login est en dehors du Shell : pas de barre latérale avant la connexion.
 * - adminGuard réserve une page aux administrateurs.
 * - loadComponent charge une page seulement quand on la visite (lazy loading).
 * - title change le titre de l'onglet du navigateur.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Connexion · Hypervisor',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
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
      {
        // La page d'un template : pour ceux qui le gèrent (droit 'manage') et les admins. Pas de garde ici :
        // le droit dépend du template, c'est la page qui lit `access` (et l'API qui fait respecter).
        path: 'hypervisors/:id/templates/:templateId',
        title: 'Template · Hypervisor',
        loadComponent: () => import('./pages/template-detail/template-detail.component').then((m) => m.TemplateDetailComponent),
      },
      {
        path: 'account',
        title: 'Mon compte · Hypervisor',
        loadComponent: () => import('./pages/account/account.component').then((m) => m.AccountComponent),
      },
      {
        path: 'admin/users',
        title: 'Utilisateurs · Hypervisor',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin-users/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'admin/groups',
        title: 'Groupes · Hypervisor',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin-groups/admin-groups.component').then((m) => m.AdminGroupsComponent),
      },
      {
        // :groupId devient l'input() `groupId` de la page.
        path: 'admin/groups/:groupId',
        title: 'Groupe · Hypervisor',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/group-detail/group-detail.component').then((m) => m.GroupDetailComponent),
      },
      {
        path: 'admin/audit',
        title: "Journal d'audit · Hypervisor",
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin-audit/admin-audit.component').then((m) => m.AdminAuditComponent),
      },
      { path: '**', component: NotFoundComponent, title: 'Page introuvable · Hypervisor' },
    ],
  },
];
