import { Component, OnInit, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { NetworkDeleteModalComponent } from '@app/components/network-delete-modal/network-delete-modal.component';
import { NetworkFormModalComponent } from '@app/components/network-form-modal/network-form-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { ResourceCardComponent } from '@app/components/ui/resource-card/resource-card.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { Network } from '@app/models/network.model';
import { InfrastructureService } from '@app/services/infrastructure.service';
import { ModalService } from '@app/services/modal.service';

/**
 * Les réseaux d'un hyperviseur, avec la possibilité de les créer et de les supprimer.
 */
@Component({
  selector: 'app-network-list',
  imports: [ColumnComponent, RowComponent, SpacerComponent, TextComponent, GridComponent, ResourceCardComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent, ButtonComponent],
  templateUrl: './network-list.component.html',
  styleUrl: './network-list.component.scss',
})
export class NetworkListComponent implements OnInit {
  private readonly infrastructure = inject(InfrastructureService);
  private readonly modal = inject(ModalService);

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

  /** Non branchée dans le .html : l'API n'a pas encore de route pour supprimer un réseau (voir le commentaire du .html). */
  protected remove(network: Network): void {
    this.modal
      .open<NetworkDeleteModalComponent, boolean>(NetworkDeleteModalComponent, {
        size: 'sm',
        inputs: { hypervisorId: this.hypervisorId(), network },
      })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.load();
        }
      });
  }

  protected create(): void {
    this.modal
      .open<NetworkFormModalComponent, Network>(NetworkFormModalComponent, {
        inputs: { hypervisorId: this.hypervisorId() },
      })
      .afterClosed$.subscribe((network) => {
        if (network) {
          this.load();
        }
      });
  }
}
