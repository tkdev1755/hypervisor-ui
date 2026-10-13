import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { IconComponent } from '@app/components/ui/icon/icon.component';
import { IconName } from '@app/components/ui/icon/icons';
import { HypervisorService } from '@app/services/hypervisor.service';

interface NavItem {
  label: string;
  icon: IconName;
  link: string;
  exact: boolean;
}

/**
 * SHELL — la mise en page de toute l'application : la barre latérale à gauche,
 * et à droite la page courante (<router-outlet />, remplacé par le routeur).
 * Pour ajouter un lien dans la barre latérale : une ligne dans `nav`.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly hypervisors = inject(HypervisorService);

  protected readonly nav: NavItem[] = [
    { label: 'Accueil', icon: 'home', link: '/', exact: true },
    { label: 'Apprendre', icon: 'learn', link: '/learn', exact: false },
    { label: 'Hyperviseurs', icon: 'server', link: '/hypervisors', exact: false },
  ];

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
