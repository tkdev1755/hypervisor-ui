import { Component, inject, input } from '@angular/core';

import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent } from '@app/components/modal/modal-shell/modal-shell.component';
import { UserGroupListComponent } from '@app/components/user-group-list/user-group-list.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Les groupes d'un utilisateur, pour un administrateur (depuis la page Utilisateurs). Lecture seule :
 * on ajoute ou retire un membre depuis la page du groupe.
 */
@Component({
  selector: 'app-user-groups-modal',
  imports: [ModalShellComponent, RowComponent, ButtonComponent, UserGroupListComponent],
  templateUrl: './user-groups-modal.component.html',
  styleUrl: './user-groups-modal.component.scss',
})
export class UserGroupsModalComponent {
  protected readonly modalRef = inject(ModalRef<void>);

  readonly userId = input.required<string>();
  readonly username = input('');
}
