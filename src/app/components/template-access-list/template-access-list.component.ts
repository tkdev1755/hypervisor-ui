import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { TemplateAccessModalComponent } from '@app/components/template-access-modal/template-access-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { TemplateAccessEntry, TemplateVisibility } from '@app/models/template.model';
import { ModalService } from '@app/services/modal.service';
import { TemplateService } from '@app/services/template.service';

/**
 * L'onglet « Accès » d'un template (admin seulement) : les utilisateurs autorisés à l'utiliser
 * quand il est RESTREINT. Ils doivent aussi avoir l'accès à l'hyperviseur.
 * Quand le template est ouvert à tout l'hyperviseur, la liste est gardée mais ne sert pas :
 * un encadré le rappelle.
 */
@Component({
  selector: 'app-template-access-list',
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
  templateUrl: './template-access-list.component.html',
  styleUrl: './template-access-list.component.scss',
})
export class TemplateAccessListComponent implements OnInit {
  private readonly templates = inject(TemplateService);
  private readonly modal = inject(ModalService);

  readonly hypervisorId = input.required<string>();
  readonly templateId = input.required<string>();
  readonly visibility = input.required<TemplateVisibility>();

  protected readonly entries = signal<TemplateAccessEntry[]>([]);
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
    this.templates.listAccess(this.hypervisorId(), this.templateId()).subscribe({
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
      .open<TemplateAccessModalComponent, boolean>(TemplateAccessModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), templateId: this.templateId(), alreadyGranted: this.grantedIds() },
      })
      .afterClosed$.subscribe((granted) => {
        if (granted) {
          this.load();
        }
      });
  }

  protected revoke(entry: TemplateAccessEntry): void {
    this.actionError.set(null);
    this.templates.revokeAccess(this.hypervisorId(), this.templateId(), entry.user_id).subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }
}
