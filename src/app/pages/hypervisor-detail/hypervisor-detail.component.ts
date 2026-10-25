import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { HypervisorAccessListComponent } from '@app/components/hypervisor-access-list/hypervisor-access-list.component';
import { DiskListComponent } from '@app/components/disk-list/disk-list.component';
import { LabListComponent } from '@app/components/lab-list/lab-list.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { NetworkListComponent } from '@app/components/network-list/network-list.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { Tab, TabsComponent } from '@app/components/ui/tabs/tabs.component';
import { TemplateListComponent } from '@app/components/template-list/template-list.component';
import { VmListComponent } from '@app/components/vm-list/vm-list.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { AuthService } from '@app/services/auth.service';
import { ContextBridgeService } from '@app/services/context-bridge.service';

type Onglet = 'vms' | 'templates' | 'labs' | 'disks' | 'networks' | 'access';

/**
 * Le détail d'un hyperviseur, avec ses onglets.
 *
 * `id` vient de l'adresse (/hypervisors/:id) : le routeur le passe directement
 * en input() (grâce à withComponentInputBinding dans app.config.ts).
 * L'hyperviseur vient du ContextBridgeService : déjà en cache si on arrive
 * depuis la liste, rechargé depuis l'API sinon.
 */
@Component({
  selector: 'app-hypervisor-detail',
  imports: [
    PageComponent,
    StatusBadgeComponent,
    TabsComponent,
    LoadingComponent,
    ErrorPanelComponent,
    VmListComponent,
    TemplateListComponent,
    LabListComponent,
    DiskListComponent,
    NetworkListComponent,
    HypervisorAccessListComponent,
  ],
  templateUrl: './hypervisor-detail.component.html',
  styleUrl: './hypervisor-detail.component.scss',
})
export class HypervisorDetailComponent implements OnInit {
  private readonly bridge = inject(ContextBridgeService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly hypervisor = signal<Hypervisor | null>(null);
  protected readonly error = signal<AppError | null>(null);

  /**
   * Un utilisateur voit ses VM, les templates et les labos sur lesquels il a un droit ;
   * disques, réseaux et accès sont réservés aux administrateurs (403 sinon).
   */
  private readonly tousLesOnglets: (Tab<Onglet> & { adminOnly?: boolean })[] = [
    { id: 'vms', label: 'Machines virtuelles', icon: 'cpu' },
    { id: 'templates', label: 'Templates', icon: 'layers' },
    { id: 'labs', label: 'Labos', icon: 'flask' },
    { id: 'disks', label: 'Disques', icon: 'disk', adminOnly: true },
    { id: 'networks', label: 'Réseaux', icon: 'network', adminOnly: true },
    { id: 'access', label: 'Accès', icon: 'shield', adminOnly: true },
  ];
  protected readonly onglets = computed(() => this.tousLesOnglets.filter((onglet) => !onglet.adminOnly || this.auth.isAdmin()));
  protected readonly onglet = signal<Onglet>('vms');

  ngOnInit(): void {
    this.bridge.resolve('hypervisor', this.id()).subscribe({
      next: (hypervisor) => this.hypervisor.set(hypervisor),
      error: (error: unknown) => {
        if (isAppError(error)) {
          this.error.set(error);
        } else {
          throw error;
        }
      },
    });
  }
}
