import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { LabPermissionModalComponent } from '@app/components/lab-permission-modal/lab-permission-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { LabPermission, LabVisibility } from '@app/models/lab.model';
import { LabService } from '@app/services/lab.service';
import { ModalService } from '@app/services/modal.service';

/**
 * L'onglet « Droits » d'un labo (admin seulement) : qui peut le déployer ou le gérer.
 * Un droit va à un utilisateur ou à un groupe (donc à tous ses membres, groupes imbriqués compris),
 * avec un rôle ('use' : déployer ; 'manage' : aussi modifier le labo et piloter toutes ses instances)
 * et une limite d'instances facultative (par personne). Quand plusieurs droits s'appliquent
 * à quelqu'un (le sien, ceux de ses groupes), le plus généreux l'emporte.
 */
@Component({
  selector: 'app-lab-permission-list',
  imports: [
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
  templateUrl: './lab-permission-list.component.html',
  styleUrl: './lab-permission-list.component.scss',
})
export class LabPermissionListComponent implements OnInit {
  private readonly labs = inject(LabService);
  private readonly modal = inject(ModalService);

  readonly hypervisorId = input.required<string>();
  readonly labId = input.required<string>();
  readonly visibility = input.required<LabVisibility>();

  protected readonly entries = signal<LabPermission[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);

  private readonly userIds = computed(() => this.entries().filter((e) => e.kind === 'user').map((e) => e.id));
  private readonly groupIds = computed(() => this.entries().filter((e) => e.kind === 'group').map((e) => e.id));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.labs.listPermissions(this.hypervisorId(), this.labId()).subscribe({
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

  /** « Gérer · 1 instance sur 3 au plus » ou « Déployer · sans limite ». */
  protected describe(entry: LabPermission): string {
    const role = entry.role === 'manage' ? 'Gérer' : 'Déployer';
    let limit: string;
    if (entry.max_instances === null) {
      limit = "sans limite d'instances";
    } else if (entry.kind === 'user') {
      limit = `${entry.instance_count ?? 0} instance(s) sur ${entry.max_instances} au plus`;
    } else {
      limit = `${entry.max_instances} instance(s) au plus par membre`;
    }
    return `${entry.kind === 'group' ? 'Groupe' : 'Utilisateur'} · ${role} · ${limit}`;
  }

  /** Sans `entry` : un nouveau droit ; avec : changer le rôle ou la limite de ce droit. */
  protected edit(entry: LabPermission | null = null): void {
    this.modal
      .open<LabPermissionModalComponent, boolean>(LabPermissionModalComponent, {
        inputs: {
          hypervisorId: this.hypervisorId(),
          labId: this.labId(),
          permission: entry,
          existingUserIds: this.userIds(),
          existingGroupIds: this.groupIds(),
        },
      })
      .afterClosed$.subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  /** Retirer un droit : réversible et sans effet sur les instances déjà déployées, donc sans confirmation. */
  protected remove(entry: LabPermission): void {
    this.actionError.set(null);
    this.labs.removePermission(this.hypervisorId(), this.labId(), entry.kind, entry.id).subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }
}
