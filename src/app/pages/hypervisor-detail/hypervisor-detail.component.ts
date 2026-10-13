import { Component, OnInit, inject, input, signal } from '@angular/core';

import { DiskListComponent } from '@app/components/disk-list/disk-list.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { NetworkListComponent } from '@app/components/network-list/network-list.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { Tab, TabsComponent } from '@app/components/ui/tabs/tabs.component';
import { VmListComponent } from '@app/components/vm-list/vm-list.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { ContextBridgeService } from '@app/services/context-bridge.service';

type Onglet = 'vms' | 'disks' | 'networks';

/**
 * Le détail d'un hyperviseur, avec trois onglets.
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
    DiskListComponent,
    NetworkListComponent,
  ],
  templateUrl: './hypervisor-detail.component.html',
  styleUrl: './hypervisor-detail.component.scss',
})
export class HypervisorDetailComponent implements OnInit {
  private readonly bridge = inject(ContextBridgeService);

  readonly id = input.required<string>();

  protected readonly hypervisor = signal<Hypervisor | null>(null);
  protected readonly error = signal<AppError | null>(null);

  protected readonly onglets: Tab<Onglet>[] = [
    { id: 'vms', label: 'Machines virtuelles', icon: 'cpu' },
    { id: 'disks', label: 'Disques', icon: 'disk' },
    { id: 'networks', label: 'Réseaux', icon: 'network' },
  ];
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
