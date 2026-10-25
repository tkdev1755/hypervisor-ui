import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { PasswordFormModalComponent } from '@app/components/password-form-modal/password-form-modal.component';
import { MyLabInstanceListComponent } from '@app/components/my-lab-instance-list/my-lab-instance-list.component';
import { UserGroupListComponent } from '@app/components/user-group-list/user-group-list.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AuthService } from '@app/services/auth.service';
import { ModalService } from '@app/services/modal.service';
import { formatQuotaRow, quotaRows } from '@app/utils/quota';

/** « Mon compte » : qui je suis, mon quota et ma consommation, le changement de mot de passe. */
@Component({
  selector: 'app-account',
  imports: [DatePipe, PageComponent, ColumnComponent, GridComponent, CardComponent, TextComponent, ButtonComponent, StatusBadgeComponent, UserGroupListComponent, MyLabInstanceListComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);

  /** Les quatre lignes « consommé / limite » ; vide tant que l'utilisateur n'est pas chargé. */
  protected readonly rows = computed(() => {
    const user = this.auth.user();
    return user ? quotaRows(user).map((row) => ({ label: row.label, text: formatQuotaRow(row), limited: row.limit !== null })) : [];
  });

  ngOnInit(): void {
    this.auth.refreshUsage();
  }

  protected changePassword(): void {
    this.modal.open<PasswordFormModalComponent, boolean>(PasswordFormModalComponent, { size: 'sm' });
  }
}
