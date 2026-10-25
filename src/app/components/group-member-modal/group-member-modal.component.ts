import { Component, computed, inject, input, signal } from '@angular/core';

import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { UserPickerComponent } from '@app/components/user-picker/user-picker.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { GroupService } from '@app/services/group.service';
import { ModalRef } from '@app/services/modal-ref';

/** Ajouter un utilisateur dans un groupe (admin seulement). Se ferme avec `true` s'il a été ajouté. */
@Component({
  selector: 'app-group-member-modal',
  imports: [ModalShellComponent, RowComponent, ButtonComponent, TextComponent, UserPickerComponent],
  templateUrl: './group-member-modal.component.html',
  styleUrl: './group-member-modal.component.scss',
})
export class GroupMemberModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly groups = inject(GroupService);

  readonly groupId = input.required<string>();
  readonly groupName = input('');
  /** Les ids déjà membres directs (on ne les propose pas). */
  readonly alreadyMembers = input<string[]>([]);

  protected readonly userId = signal<string | undefined>(undefined);
  protected readonly submitted = signal(false);
  protected readonly userError = computed(() => (this.submitted() && !this.userId() ? 'Choisissez un utilisateur.' : null));

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.state.set('loading');
    this.groups.addMember(this.groupId(), userId).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
