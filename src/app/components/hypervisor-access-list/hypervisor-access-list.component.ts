import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { HypervisorAccessModalComponent } from '@app/components/hypervisor-access-modal/hypervisor-access-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { AccessEntry } from '@app/models/share.model';
import { AdminService } from '@app/services/admin.service';
import { ModalService } from '@app/services/modal.service';

/**
 * L'onglet « Accès » d'un hyperviseur (admin seulement) : qui a le droit d'y créer des VM.
 * Un administrateur a toujours accès à tout, il n'apparaît donc pas ici.
 */
@Component({
  selector: 'app-hypervisor-access-list',
  imports: [
    DatePipe,
    ColumnComponent,
    RowComponent,
    SpacerComponent,
    TextComponent,
    ButtonComponent,
    CalloutComponent,
    LoadingComponent,
    ErrorPanelComponent,
    EmptyStateComponent,
    ListComponent,
    ListTileComponent,
  ],
  templateUrl: './hypervisor-access-list.component.html',
  styleUrl: './hypervisor-access-list.component.scss',
})
export class HypervisorAccessListComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly modal = inject(ModalService);

  readonly hypervisorId = input.required<string>();

  protected readonly entries = signal<AccessEntry[]>([]);
  protected readonly grantedIds = computed(() => this.entries().map((entry) => entry.user_id));
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin.listAccess(this.hypervisorId()).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  protected grant(): void {
    this.modal
      .open<HypervisorAccessModalComponent, boolean>(HypervisorAccessModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), alreadyGranted: this.grantedIds() },
      })
      .afterClosed$.subscribe((granted) => {
        if (granted) {
          this.load();
        }
      });
  }

  protected revoke(entry: AccessEntry): void {
    this.actionError.set(null);
    this.admin.revokeAccess(this.hypervisorId(), entry.user_id).subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }
}
