import { Component, OnInit, inject, input, signal } from '@angular/core';

import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { AppError } from '@app/models/app-error.model';
import { UserGroup } from '@app/models/group.model';
import { GroupService } from '@app/services/group.service';

/**
 * Les groupes dont un utilisateur fait partie, en lecture seule.
 *
 *   <app-user-group-list />                        les groupes de l'utilisateur connecté (GET /api/me/groups)
 *   <app-user-group-list [userId]="user.id" />     ceux d'un autre utilisateur (admin : GET /api/users/{id}/groups)
 *
 * Chaque ligne dit si l'utilisateur est directement dans le groupe, ou seulement par un groupe imbriqué
 * (il est dans un groupe qui est lui-même dans celui-ci).
 */
@Component({
  selector: 'app-user-group-list',
  imports: [ListComponent, ListTileComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent],
  templateUrl: './user-group-list.component.html',
  styleUrl: './user-group-list.component.scss',
})
export class UserGroupListComponent implements OnInit {
  private readonly groups = inject(GroupService);

  /** L'utilisateur dont on veut les groupes ; absent = l'utilisateur connecté. */
  readonly userId = input<string | null>(null);

  protected readonly list = signal<UserGroup[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const userId = this.userId();
    const request = userId ? this.groups.userGroups(userId) : this.groups.myGroups();
    request.subscribe({
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

  /** Le sous-titre : la description, puis comment l'utilisateur est dans le groupe. */
  protected subtitle(group: UserGroup): string {
    const how = group.direct ? 'Membre direct' : 'Membre par un groupe imbriqué';
    return group.description ? `${how} · ${group.description}` : how;
  }
}
