import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { PageComponent } from '@app/components/layout/page/page.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { UserFormModalComponent } from '@app/components/user-form-modal/user-form-modal.component';
import { UserPasswordModalComponent } from '@app/components/user-password-modal/user-password-modal.component';
import { UserQuotaModalComponent } from '@app/components/user-quota-modal/user-quota-modal.component';
import { AppError } from '@app/models/app-error.model';
import { User } from '@app/models/user.model';
import { AdminService } from '@app/services/admin.service';
import { AuthService } from '@app/services/auth.service';
import { ModalService } from '@app/services/modal.service';
import { UserService } from '@app/services/user.service';
import { formatQuotaRow, quotaRows } from '@app/utils/quota';

/**
 * L'administration des comptes (admin seulement, voir adminGuard dans app.routes.ts) :
 * créer, changer le rôle, désactiver, fixer les quotas, réinitialiser un mot de passe, supprimer,
 * et ouvrir ou fermer les inscriptions libres.
 *
 * L'API refuse (409) de retirer le dernier administrateur actif, ou de supprimer un utilisateur
 * qui possède encore des VM : l'erreur s'affiche telle quelle sous la liste.
 */
@Component({
  selector: 'app-admin-users',
  imports: [
    PageComponent,
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
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly admin = inject(AdminService);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);

  protected readonly list = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  /** Les inscriptions libres sont-elles ouvertes ? null tant qu'on ne le sait pas. */
  protected readonly registrationOpen = signal<boolean | null>(null);
  protected readonly myId = computed(() => this.auth.user()?.id);

  ngOnInit(): void {
    this.load();
    this.admin.settings().subscribe({
      next: (settings) => this.registrationOpen.set(settings.registration_open),
      error: (error: AppError) => this.actionError.set(error),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.users.list().subscribe({
      next: (users) => {
        this.list.set(users);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  /** « Administrateur · 2 VM · quota : VM 2 / 3 ». */
  protected describe(user: User): string {
    const limits = quotaRows(user)
      .filter((row) => row.limit !== null)
      .map((row) => `${row.label} ${formatQuotaRow(row)}`);
    return [user.role === 'admin' ? 'Administrateur' : 'Utilisateur', `${user.usage.vms} VM`, limits.length ? 'quota : ' + limits.join(', ') : 'sans quota'].join(' · ');
  }

  protected create(): void {
    this.modal.open<UserFormModalComponent, User>(UserFormModalComponent).afterClosed$.subscribe((created) => {
      if (created) {
        this.load();
      }
    });
  }

  protected editQuota(user: User): void {
    this.modal
      .open<UserQuotaModalComponent, User>(UserQuotaModalComponent, { inputs: { user } })
      .afterClosed$.subscribe((updated) => {
        if (updated) {
          this.load();
        }
      });
  }

  protected resetPassword(user: User): void {
    this.modal.open<UserPasswordModalComponent, boolean>(UserPasswordModalComponent, { size: 'sm', inputs: { user } });
  }

  protected toggleRole(user: User): void {
    this.run(this.users.update(user.id, { role: user.role === 'admin' ? 'user' : 'admin' }));
  }

  protected toggleDisabled(user: User): void {
    this.run(this.users.update(user.id, { disabled: !user.disabled }));
  }

  protected toggleRegistration(): void {
    const open = this.registrationOpen();
    if (open === null) {
      return;
    }
    this.actionError.set(null);
    this.admin.updateSettings({ registration_open: !open }).subscribe({
      next: (settings) => this.registrationOpen.set(settings.registration_open),
      error: (error: AppError) => this.actionError.set(error),
    });
  }

  protected remove(user: User): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Supprimer « ${user.username} » ?`,
          message: "Le compte est supprimé définitivement. Refusé si l'utilisateur possède encore des VM.",
          confirmLabel: 'Supprimer',
          successMessage: 'Compte supprimé.',
          danger: true,
          action: () => this.users.delete(user.id),
        },
      })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.load();
        }
      });
  }

  private run(request: Observable<unknown>): void {
    this.actionError.set(null);
    request.subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }
}
