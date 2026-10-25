import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SidebarInventoryComponent } from './sidebar-inventory/sidebar-inventory.component';
import { IconComponent } from '@app/components/ui/icon/icon.component';
import { IconName } from '@app/components/ui/icon/icons';
import { AuthService } from '@app/services/auth.service';
import { HypervisorService } from '@app/services/hypervisor.service';

interface NavItem {
  label: string;
  icon: IconName;
  link: string;
  exact: boolean;
  /** Réservé aux administrateurs. */
  adminOnly?: boolean;
}

/**
 * SHELL — la mise en page de toute l'application : la barre latérale à gauche,
 * et à droite la page courante (<router-outlet />, remplacé par le routeur).
 * Pour ajouter un lien dans la barre latérale : une ligne dans `nav`
 * (`adminOnly: true` le cache aux non-administrateurs).
 * En bas : l'utilisateur connecté (lien vers « Mon compte ») et le bouton de déconnexion.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, SidebarInventoryComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly hypervisors = inject(HypervisorService);
  protected readonly auth = inject(AuthService);

  protected readonly nav: NavItem[] = [
    { label: 'Accueil', icon: 'home', link: '/', exact: true },
    { label: 'Apprendre', icon: 'learn', link: '/learn', exact: false },
    { label: 'Hyperviseurs', icon: 'server', link: '/hypervisors', exact: false },
    { label: 'Utilisateurs', icon: 'users', link: '/admin/users', exact: false, adminOnly: true },
    { label: 'Groupes', icon: 'folder', link: '/admin/groups', exact: false, adminOnly: true },
    { label: "Journal d'audit", icon: 'list', link: '/admin/audit', exact: false, adminOnly: true },
  ];
  /** Les liens visibles pour l'utilisateur connecté. */
  protected readonly visibleNav = computed(() => this.nav.filter((item) => !item.adminOnly || this.auth.isAdmin()));

  protected readonly health = signal<'checking' | 'up' | 'down'>('checking');

  ngOnInit(): void {
    this.checkHealth();
  }

  protected checkHealth(): void {
    this.health.set('checking');
    this.hypervisors.ping().subscribe({
      next: () => this.health.set('up'),
      error: () => this.health.set('down'),
    });
  }
}
