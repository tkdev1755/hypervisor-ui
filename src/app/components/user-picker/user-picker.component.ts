import { Component, OnInit, computed, inject, input, model, signal } from '@angular/core';

import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { User } from '@app/models/user.model';
import { UserService } from '@app/services/user.service';

/**
 * USER PICKER — choisir un utilisateur parmi les comptes actifs (réservé aux admins : il appelle GET /api/users).
 *
 *   readonly ownerId = signal<string | undefined>(undefined);
 *   <app-user-picker label="Propriétaire" [(value)]="ownerId" />
 *   <app-user-picker label="Autoriser" [(value)]="userId" [exclude]="dejaAutorises" />
 *
 * - value   : l'id de l'utilisateur choisi (undefined tant qu'on n'a rien choisi)
 * - exclude : des ids à ne pas proposer
 * - label   : le titre du groupe de choix
 */
@Component({
  selector: 'app-user-picker',
  imports: [ChoiceCardsComponent, LoadingComponent, ErrorPanelComponent, TextComponent],
  templateUrl: './user-picker.component.html',
  styleUrl: './user-picker.component.scss',
})
export class UserPickerComponent implements OnInit {
  private readonly users = inject(UserService);

  readonly value = model<string | undefined>(undefined);
  readonly exclude = input<string[]>([]);
  readonly label = input('Utilisateur');

  protected readonly all = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  protected readonly choices = computed<Choice<string>[]>(() =>
    this.all()
      .filter((user) => !user.disabled && !this.exclude().includes(user.id))
      .map((user) => ({ value: user.id, label: user.username, description: user.role === 'admin' ? 'Administrateur' : 'Utilisateur' })),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.users.list().subscribe({
      next: (users) => {
        this.all.set(users);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }
}
