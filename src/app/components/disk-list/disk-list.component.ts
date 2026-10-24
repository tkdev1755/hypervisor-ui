import { Component, OnInit, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { DiskDeleteModalComponent } from '@app/components/disk-delete-modal/disk-delete-modal.component';
import { DiskFormModalComponent } from '@app/components/disk-form-modal/disk-form-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { ResourceCardComponent } from '@app/components/ui/resource-card/resource-card.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { Disk } from '@app/models/disk.model';
import { InfrastructureService } from '@app/services/infrastructure.service';
import { ModalService } from '@app/services/modal.service';

/**
 * Les disques d'un hyperviseur, avec la possibilité de les créer et de les supprimer.
 */
@Component({
  selector: 'app-disk-list',
  imports: [ColumnComponent, RowComponent, SpacerComponent, TextComponent, GridComponent, ResourceCardComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent, ButtonComponent],
  templateUrl: './disk-list.component.html',
  styleUrl: './disk-list.component.scss',
})
export class DiskListComponent implements OnInit {
  private readonly infrastructure = inject(InfrastructureService);
  private readonly modal = inject(ModalService);

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

  protected create(): void {
    this.modal
      .open<DiskFormModalComponent, Disk>(DiskFormModalComponent, {
        inputs: { hypervisorId: this.hypervisorId() },
      })
      .afterClosed$.subscribe((disk) => {
        if (disk) {
          this.load();
        }
      });
  }

  protected remove(disk: Disk): void {
    this.modal
      .open<DiskDeleteModalComponent, boolean>(DiskDeleteModalComponent, {
        size: 'sm',
        inputs: { hypervisorId: this.hypervisorId(), disk },
      })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.load();
        }
      });
  }
}
