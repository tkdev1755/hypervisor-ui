import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Group } from '@app/models/group.model';
import { GroupService } from '@app/services/group.service';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Mettre un groupe dans un autre (admin seulement) : ses membres deviennent aussi membres du groupe parent.
 * On ne propose ni le groupe lui-même ni ses sous-groupes actuels. Un choix qui créerait un cycle
 * (le groupe est déjà, même indirectement, dans celui qu'on choisit) est refusé par l'API (409) :
 * l'erreur l'explique. Se ferme avec `true` si le sous-groupe a été ajouté.
 */
@Component({
  selector: 'app-group-subgroup-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, TextComponent, ChoiceCardsComponent],
  templateUrl: './group-subgroup-modal.component.html',
  styleUrl: './group-subgroup-modal.component.scss',
})
export class GroupSubgroupModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly groups = inject(GroupService);

  readonly groupId = input.required<string>();
  readonly groupName = input('');
  /** Les ids des sous-groupes actuels (on ne les propose pas). */
  readonly alreadySubgroups = input<string[]>([]);

  private readonly all = signal<Group[]>([]);
  protected readonly choices = computed<Choice<string>[]>(() =>
    this.all()
      .filter((group) => group.id !== this.groupId() && !this.alreadySubgroups().includes(group.id))
      .map((group) => ({ value: group.id, label: group.name, description: `${group.member_count} membre(s)` })),
  );
  protected readonly childId = signal<string | undefined>(undefined);
  protected readonly submitted = signal(false);
  protected readonly childError = computed(() => (this.submitted() && !this.childId() ? 'Choisissez un groupe.' : null));

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);
  protected readonly loadingLabel = signal('Chargement des groupes…');

  ngOnInit(): void {
    this.loadGroups();
  }

  protected loadGroups(): void {
    this.loadingLabel.set('Chargement des groupes…');
    this.state.set('loading');
    this.groups.list().subscribe({
      next: (groups) => {
        this.all.set(groups);
        this.state.set('form');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** « Réessayer » : recharger les groupes s'ils manquent, sinon revenir au formulaire. */
  protected retry(): void {
    if (this.all().length) {
      this.state.set('form');
    } else {
      this.loadGroups();
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    const childId = this.childId();
    if (!childId) {
      return;
    }
    this.loadingLabel.set('Ajout…');
    this.state.set('loading');
    this.groups.addSubgroup(this.groupId(), childId).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.error.set(isAppError(error) ? error : null);
    this.state.set('error');
  }
}
