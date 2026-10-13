import { Component, OnInit, inject, input, signal } from '@angular/core';

import { GridComponent } from '@app/components/layout/grid/grid.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { ResourceCardComponent } from '@app/components/ui/resource-card/resource-card.component';
import { AppError } from '@app/models/app-error.model';
import { Disk } from '@app/models/disk.model';
import { InfrastructureService } from '@app/services/infrastructure.service';

/**
 * Les disques d'un hyperviseur (lecture seule pour l'instant).
 *
 * À VOUS DE JOUER : ajouter la création d'un disque, sur le modèle de
 * vm-form-modal (champ de nom + <app-choice-cards> pour le format qcow2 / raw),
 * avec InfrastructureService.createDisk.
 */
@Component({
  selector: 'app-disk-list',
  imports: [GridComponent, ResourceCardComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent],
  templateUrl: './disk-list.component.html',
  styleUrl: './disk-list.component.scss',
})
export class DiskListComponent implements OnInit {
  private readonly infrastructure = inject(InfrastructureService);

  readonly hypervisorId = input.required<string>();

  protected readonly disks = signal<Disk[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.infrastructure.listDisks(this.hypervisorId()).subscribe({
      next: (disks) => {
        this.disks.set(disks);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }
}
