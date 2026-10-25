import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { UserPickerComponent } from '@app/components/user-picker/user-picker.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Group } from '@app/models/group.model';
import { LabPermission, LabRole } from '@app/models/lab.model';
import { GroupService } from '@app/services/group.service';
import { LabService } from '@app/services/lab.service';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Donner un droit sur un labo à un utilisateur ou à un groupe, ou changer un droit existant
 * (admin seulement). Le PUT de l'API remplace le droit s'il existe déjà.
 *
 * - Pour qui : un utilisateur (`app-user-picker`) ou un groupe (la liste des groupes, chargée à l'ouverture).
 * - Rôle : 'use' (déployer des instances, piloter les siennes) ou 'manage' (aussi modifier le labo et
 *   piloter toutes ses instances).
 * - Limite : combien d'instances de ce labo CHAQUE utilisateur concerné peut posséder (vide = sans limite).
 *
 * Avec `permission`, on modifie ce droit : on ne peut plus changer pour qui il est.
 * Se ferme avec `true` si le droit a été enregistré.
 */
@Component({
  selector: 'app-lab-permission-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, CalloutComponent, ChoiceCardsComponent, TextFieldComponent, TextComponent, UserPickerComponent],
  templateUrl: './lab-permission-modal.component.html',
  styleUrl: './lab-permission-modal.component.scss',
})
export class LabPermissionModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly labs = inject(LabService);
  private readonly groupService = inject(GroupService);

  readonly hypervisorId = input.required<string>();
  readonly labId = input.required<string>();
  /** Le droit à modifier ; absent pour en donner un nouveau. */
  readonly permission = input<LabPermission | null>(null);
  /** Les utilisateurs et groupes qui ont déjà un droit (on ne les propose pas pour un nouveau droit). */
  readonly existingUserIds = input<string[]>([]);
  readonly existingGroupIds = input<string[]>([]);

  protected readonly editing = computed(() => this.permission() !== null);

  protected readonly kind = signal<'user' | 'group'>('user');
  protected readonly userId = signal<string | undefined>(undefined);
  protected readonly groupId = signal<string | undefined>(undefined);
  protected readonly role = signal<LabRole>('use');
  /** La limite, en texte : '' = sans limite. */
  protected readonly maxInstances = signal('');

  private readonly groups = signal<Group[]>([]);
  protected readonly groupChoices = computed<Choice<string>[]>(() =>
    this.groups()
      .filter((group) => !this.existingGroupIds().includes(group.id))
      .map((group) => ({ value: group.id, label: group.name, description: `${group.member_count} membre(s) direct(s)` })),
  );

  protected readonly kindChoices: Choice<'user' | 'group'>[] = [
    { value: 'user', label: 'Un utilisateur' },
    { value: 'group', label: 'Un groupe', description: 'Tous ses membres, sous-groupes compris' },
  ];
  protected readonly roleChoices: Choice<LabRole>[] = [
    { value: 'use', label: 'Déployer', description: 'Créer des instances et piloter les siennes' },
    { value: 'manage', label: 'Gérer', description: 'Aussi modifier le labo et piloter toutes ses instances' },
  ];

  protected readonly submitted = signal(false);
  protected readonly targetError = computed(() => {
    if (!this.submitted() || this.editing()) {
      return null;
    }
    if (this.kind() === 'user') {
      return this.userId() ? null : 'Choisissez un utilisateur.';
    }
    return this.groupId() ? null : 'Choisissez un groupe.';
  });
  protected readonly maxInstancesError = computed(() => {
    const text = this.maxInstances().trim();
    return this.submitted() && text !== '' && !/^\d+$/.test(text) ? 'Un nombre entier, 0 ou plus (vide : sans limite).' : null;
  });

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  ngOnInit(): void {
    const permission = this.permission();
    if (permission) {
      this.kind.set(permission.kind);
      this.role.set(permission.role);
      this.maxInstances.set(permission.max_instances === null ? '' : String(permission.max_instances));
    }
    // La liste des groupes sert au choix « Un groupe » ; une erreur ici n'empêche pas de choisir un utilisateur.
    this.groupService.list().subscribe({
      next: (groups) => this.groups.set(groups),
      error: () => this.groups.set([]),
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.targetError() || this.maxInstancesError()) {
      return;
    }
    const permission = this.permission();
    const kind = permission?.kind ?? this.kind();
    const id = permission?.id ?? (kind === 'user' ? this.userId() : this.groupId());
    if (!id) {
      return;
    }
    const text = this.maxInstances().trim();
    this.state.set('loading');
    this.labs
      .setPermission(this.hypervisorId(), this.labId(), kind, id, { role: this.role(), max_instances: text === '' ? null : Number(text) })
      .subscribe({
        next: () => this.state.set('success'),
        error: (error: unknown) => {
          this.error.set(isAppError(error) ? error : null);
          this.state.set('error');
        },
      });
  }
}
