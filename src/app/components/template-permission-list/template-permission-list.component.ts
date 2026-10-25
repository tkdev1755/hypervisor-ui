import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { TemplatePermissionModalComponent } from '@app/components/template-permission-modal/template-permission-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { TemplatePermission, TemplateVisibility } from '@app/models/template.model';
import { ModalService } from '@app/services/modal.service';
import { TemplateService } from '@app/services/template.service';

/**
 * L'onglet « Droits » d'un template (admin seulement) : qui peut l'utiliser ou le gérer.
 * Un droit va à un utilisateur ou à un groupe (donc à tous ses membres, groupes imbriqués compris),
 * avec un rôle ('use' ou 'manage') et une limite de VM facultative. Quand plusieurs droits s'appliquent
 * à quelqu'un (le sien, ceux de ses groupes), le plus généreux l'emporte.
 */
@Component({
  selector: 'app-template-permission-list',
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
  templateUrl: './template-permission-list.component.html',
  styleUrl: './template-permission-list.component.scss',
})
export class TemplatePermissionListComponent implements OnInit {
  private readonly templates = inject(TemplateService);
  private readonly modal = inject(ModalService);

  readonly hypervisorId = input.required<string>();
  readonly templateId = input.required<string>();
  readonly visibility = input.required<TemplateVisibility>();

  protected readonly entries = signal<TemplatePermission[]>([]);
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
    this.templates.listPermissions(this.hypervisorId(), this.templateId()).subscribe({
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

  /** « Gérer · 1 VM sur 3 au plus » ou « Utiliser · sans limite ». */
  protected describe(entry: TemplatePermission): string {
    const role = entry.role === 'manage' ? 'Gérer' : 'Utiliser';
    let limit: string;
    if (entry.max_vms === null) {
      limit = 'sans limite de VM';
    } else if (entry.kind === 'user') {
      limit = `${entry.vm_count ?? 0} VM sur ${entry.max_vms} au plus`;
    } else {
      limit = `${entry.max_vms} VM au plus par membre`;
    }
    return `${entry.kind === 'group' ? 'Groupe' : 'Utilisateur'} · ${role} · ${limit}`;
  }

  /** Sans `entry` : un nouveau droit ; avec : changer le rôle ou la limite de ce droit. */
  protected edit(entry: TemplatePermission | null = null): void {
    this.modal
      .open<TemplatePermissionModalComponent, boolean>(TemplatePermissionModalComponent, {
        inputs: {
          hypervisorId: this.hypervisorId(),
          templateId: this.templateId(),
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

  /** Retirer un droit : réversible et sans effet sur les VM déjà créées, donc sans confirmation. */
  protected remove(entry: TemplatePermission): void {
    this.actionError.set(null);
    this.templates.removePermission(this.hypervisorId(), this.templateId(), entry.kind, entry.id).subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }
}
