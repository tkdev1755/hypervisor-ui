import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { GroupFormModalComponent } from '@app/components/group-form-modal/group-form-modal.component';
import { GroupMemberModalComponent } from '@app/components/group-member-modal/group-member-modal.component';
import { GroupSubgroupModalComponent } from '@app/components/group-subgroup-modal/group-subgroup-modal.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { Tab, TabsComponent } from '@app/components/ui/tabs/tabs.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { EffectiveMember, Group, GroupDetail, GroupMember, GroupRef } from '@app/models/group.model';
import { GroupService } from '@app/services/group.service';
import { ModalService } from '@app/services/modal.service';

type Onglet = 'members' | 'subgroups' | 'all' | 'parents';

/**
 * La page d'un groupe (admin seulement), à l'adresse /admin/groups/:groupId.
 *
 *  - Membres : les utilisateurs DIRECTEMENT dans le groupe (ajouter, retirer).
 *  - Sous-groupes : les groupes dans ce groupe (ajouter, retirer, ouvrir).
 *  - Tous les membres : les utilisateurs du groupe ET de tous ses sous-groupes, en lecture seule.
 *  - Groupes parents : les groupes qui contiennent celui-ci (ouvrir).
 *
 * Ouvrir un sous-groupe ou un parent change seulement `groupId` : Angular garde la même page.
 * Un effect() recharge donc les données à chaque changement de groupId (voir la leçon 15).
 */
@Component({
  selector: 'app-group-detail',
  imports: [
    PageComponent,
    ColumnComponent,
    RowComponent,
    SpacerComponent,
    GridComponent,
    CardComponent,
    TextComponent,
    ButtonComponent,
    TabsComponent,
    ListComponent,
    ListTileComponent,
    LoadingComponent,
    ErrorPanelComponent,
    EmptyStateComponent,
  ],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.scss',
})
export class GroupDetailComponent {
  private readonly groups = inject(GroupService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  readonly groupId = input.required<string>();

  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly everyone = signal<EffectiveMember[]>([]);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);

  protected readonly onglet = signal<Onglet>('members');
  /** Les onglets, avec le nombre d'éléments de chacun dans le libellé. */
  protected readonly onglets = computed<Tab<Onglet>[]>(() => {
    const group = this.group();
    return [
      { id: 'members', label: `Membres (${group?.members.length ?? 0})`, icon: 'user' },
      { id: 'subgroups', label: `Sous-groupes (${group?.subgroups.length ?? 0})`, icon: 'folder' },
      { id: 'all', label: `Tous les membres (${this.everyone().length})`, icon: 'users' },
      { id: 'parents', label: `Groupes parents (${group?.parents.length ?? 0})`, icon: 'layers' },
    ];
  });

  protected readonly memberIds = computed(() => this.group()?.members.map((member) => member.user_id) ?? []);
  protected readonly subgroupIds = computed(() => this.group()?.subgroups.map((subgroup) => subgroup.id) ?? []);

  constructor() {
    // À chaque nouveau groupId (y compris le premier), on recharge. untracked : load() lit d'autres
    // signals, qui ne doivent pas relancer l'effect.
    effect(() => {
      this.groupId();
      untracked(() => {
        this.group.set(null);
        this.onglet.set('members');
        this.load();
      });
    });
  }

  protected load(): void {
    this.error.set(null);
    this.actionError.set(null);
    forkJoin({
      group: this.groups.get(this.groupId()),
      everyone: this.groups.members(this.groupId()),
    }).subscribe({
      next: ({ group, everyone }) => {
        this.group.set(group);
        this.everyone.set(everyone);
      },
      error: (error: AppError) => this.error.set(error),
    });
  }

  protected date(seconds: number): string {
    return new Date(seconds * 1000).toLocaleDateString('fr-FR');
  }

  protected open(ref: GroupRef): void {
    this.router.navigate(['/admin/groups', ref.id]);
  }

  // ---------- le groupe ----------

  protected edit(group: GroupDetail): void {
    this.modal
      .open<GroupFormModalComponent, Group>(GroupFormModalComponent, { inputs: { group } })
      .afterClosed$.subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  protected remove(group: GroupDetail): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Supprimer « ${group.name} » ?`,
          message: 'Les membres et les sous-groupes ne sont pas supprimés : ils sortent seulement de ce groupe.',
          confirmLabel: 'Supprimer',
          successMessage: 'Groupe supprimé.',
          danger: true,
          action: () => this.groups.delete(group.id),
        },
      })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.router.navigate(['/admin/groups']);
        }
      });
  }

  // ---------- membres et sous-groupes ----------

  protected addMember(group: GroupDetail): void {
    this.modal
      .open<GroupMemberModalComponent, boolean>(GroupMemberModalComponent, {
        inputs: { groupId: group.id, groupName: group.name, alreadyMembers: this.memberIds() },
      })
      .afterClosed$.subscribe((added) => {
        if (added) {
          this.load();
        }
      });
  }

  /** Retirer un membre ou un sous-groupe : réversible, donc sans confirmation (comme les accès). */
  protected removeMember(group: GroupDetail, member: GroupMember): void {
    this.actionError.set(null);
    this.groups.removeMember(group.id, member.user_id).subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }

  protected addSubgroup(group: GroupDetail): void {
    this.modal
      .open<GroupSubgroupModalComponent, boolean>(GroupSubgroupModalComponent, {
        inputs: { groupId: group.id, groupName: group.name, alreadySubgroups: this.subgroupIds() },
      })
      .afterClosed$.subscribe((added) => {
        if (added) {
          this.load();
        }
      });
  }

  protected removeSubgroup(group: GroupDetail, subgroup: GroupRef): void {
    this.actionError.set(null);
    this.groups.removeSubgroup(group.id, subgroup.id).subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }
}
