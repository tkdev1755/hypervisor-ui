import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { AuditEntry } from '@app/models/audit.model';
import { AdminService } from '@app/services/admin.service';

/** Le nombre de lignes par page : on en demande une de plus pour savoir s'il y a une page suivante. */
const PAGE_SIZE = 25;

/**
 * Le journal d'audit (admin seulement) : connexions, comptes, VM, prêts, accès console, quotas…
 * Le plus récent d'abord, paginé avec limit / offset, filtrable par type d'action (par exemple « vm.create »).
 */
@Component({
  selector: 'app-admin-audit',
  imports: [
    DatePipe,
    PageComponent,
    ColumnComponent,
    RowComponent,
    SpacerComponent,
    TextComponent,
    TextFieldComponent,
    ButtonComponent,
    LoadingComponent,
    ErrorPanelComponent,
    EmptyStateComponent,
    ListComponent,
    ListTileComponent,
  ],
  templateUrl: './admin-audit.component.html',
  styleUrl: './admin-audit.component.scss',
})
export class AdminAuditComponent implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly action = signal('');
  /** Quelques actions courantes, pour filtrer d'un clic (le filtre de l'API est une correspondance EXACTE). */
  protected readonly commonActions = ['auth.login', 'user.create', 'user.update', 'user.quota', 'vm.create', 'vm.start', 'hypervisor.grant', 'settings.update'];
  protected readonly page = signal(0);
  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly pageNumber = computed(() => this.page() + 1);

  ngOnInit(): void {
    this.load();
  }

  protected filterBy(action: string): void {
    this.action.set(action);
    this.search();
  }

  /** Appliquer le filtre : on repart de la première page. */
  protected search(): void {
    this.page.set(0);
    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin.audit({ limit: PAGE_SIZE + 1, offset: this.page() * PAGE_SIZE, action: this.action().trim() }).subscribe({
      next: (entries) => {
        this.hasNext.set(entries.length > PAGE_SIZE);
        this.entries.set(entries.slice(0, PAGE_SIZE));
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  /** « 23/10/2026 09:41 · alice · vm-123 · détail ». */
  protected describe(entry: AuditEntry, formattedDate: string | null): string {
    return [formattedDate, entry.username ?? 'anonyme', entry.target, entry.detail, entry.success ? null : 'ÉCHEC'].filter(Boolean).join(' · ');
  }
}
