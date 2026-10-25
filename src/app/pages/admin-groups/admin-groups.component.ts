import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { PageComponent } from '@app/components/layout/page/page.component';
import { GroupFormModalComponent } from '@app/components/group-form-modal/group-form-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError } from '@app/models/app-error.model';
import { Group } from '@app/models/group.model';
import { GroupService } from '@app/services/group.service';
import { ModalService } from '@app/services/modal.service';

/**
 * Administration des groupes d'utilisateurs (admin seulement, voir adminGuard dans app.routes.ts).
 * La liste des groupes avec une recherche par nom ; un clic ouvre la page du groupe
 * (membres, sous-groupes, groupes parents). Les groupes ne donnent encore aucun droit.
 */
@Component({
  selector: 'app-admin-groups',
  imports: [PageComponent, ButtonComponent, CalloutComponent, TextFieldComponent, ListComponent, ListTileComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent],
  templateUrl: './admin-groups.component.html',
  styleUrl: './admin-groups.component.scss',
})
export class AdminGroupsComponent implements OnInit {
  private readonly groups = inject(GroupService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly list = signal<Group[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  protected readonly search = signal('');
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.list().filter((group) => group.name.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.groups.list().subscribe({
      next: (groups) => {
        this.list.set(groups);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  /** « 3 membres · 1 sous-groupe · description » */
  protected describe(group: Group): string {
    const parts = [
      `${group.member_count} membre${group.member_count > 1 ? 's' : ''}`,
      `${group.subgroup_count} sous-groupe${group.subgroup_count > 1 ? 's' : ''}`,
    ];
    if (group.description) {
      parts.push(group.description);
    }
    return parts.join(' · ');
  }

  protected open(group: Group): void {
    this.router.navigate(['/admin/groups', group.id]);
  }

  /** Après la création, on ouvre directement le nouveau groupe pour y ajouter des membres. */
  protected create(): void {
    this.modal.open<GroupFormModalComponent, Group>(GroupFormModalComponent).afterClosed$.subscribe((group) => {
      if (group) {
        this.open(group);
      }
    });
  }
}
