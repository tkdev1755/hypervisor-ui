import { Component, OnInit, inject, input, signal } from '@angular/core';

import { GridComponent } from '@app/components/layout/grid/grid.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { ResourceCardComponent } from '@app/components/ui/resource-card/resource-card.component';
import { AppError } from '@app/models/app-error.model';
import { Network } from '@app/models/network.model';
import { InfrastructureService } from '@app/services/infrastructure.service';

/**
 * Les réseaux d'un hyperviseur (lecture seule pour l'instant).
 *
 * À VOUS DE JOUER : ajouter la création d'un réseau (nom + bridge facultatif)
 * avec InfrastructureService.createNetwork.
 */
@Component({
  selector: 'app-network-list',
  imports: [GridComponent, ResourceCardComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent],
  templateUrl: './network-list.component.html',
  styleUrl: './network-list.component.scss',
})
export class NetworkListComponent implements OnInit {
  private readonly infrastructure = inject(InfrastructureService);

  readonly hypervisorId = input.required<string>();

  protected readonly networks = signal<Network[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.infrastructure.listNetworks(this.hypervisorId()).subscribe({
      next: (networks) => {
        this.networks.set(networks);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }
}
