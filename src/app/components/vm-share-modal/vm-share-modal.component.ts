import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Share } from '@app/models/share.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { ModalRef } from '@app/services/modal-ref';
import { ShareService } from '@app/services/share.service';

/**
 * Prêter une VM : la liste des emprunteurs actuels (qu'on peut retirer), et un
 * formulaire pour en ajouter un. Il n'existe pas de recherche d'utilisateurs pour un
 * non-admin : il faut saisir le nom EXACT de l'emprunteur (l'API répond 404 s'il n'existe pas).
 */
@Component({
  selector: 'app-vm-share-modal',
  imports: [
    DatePipe,
    ModalShellComponent,
    ColumnComponent,
    RowComponent,
    TextComponent,
    TextFieldComponent,
    ButtonComponent,
    ChoiceCardsComponent,
    ErrorPanelComponent,
    ListComponent,
    ListTileComponent,
    LoadingComponent,
  ],
  templateUrl: './vm-share-modal.component.html',
  styleUrl: './vm-share-modal.component.scss',
})
export class VmShareModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<void>);
  private readonly shares = inject(ShareService);

  readonly hypervisorId = input.required<string>();
  readonly vm = input.required<VirtualMachine>();

  protected readonly list = signal<Share[]>([]);
  protected readonly loadingList = signal(true);
  protected readonly listError = signal<AppError | null>(null);

  protected readonly username = signal('');
  /** La durée du prêt, en secondes ; 0 = jusqu'à ce qu'on le retire. */
  protected readonly duration = signal(0);
  protected readonly durations: Choice<number>[] = [
    { value: 0, label: 'Sans limite' },
    { value: 3600, label: '1 heure' },
    { value: 86400, label: '1 jour' },
    { value: 604800, label: '7 jours' },
  ];

  protected readonly submitted = signal(false);
  protected readonly usernameError = computed(() =>
    this.submitted() && this.username().trim() === '' ? "Saisissez le nom exact de l'utilisateur." : null,
  );
  protected readonly lastShared = signal<string | null>(null);

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loadingList.set(true);
    this.listError.set(null);
    this.shares.list(this.hypervisorId(), this.vm().id).subscribe({
      next: (list) => {
        this.list.set(list);
        this.loadingList.set(false);
      },
      error: (error: AppError) => {
        this.listError.set(error);
        this.loadingList.set(false);
      },
    });
  }

  protected add(): void {
    this.submitted.set(true);
    if (this.usernameError()) {
      return;
    }
    const username = this.username().trim();
    const seconds = this.duration();
    const body = { username, ...(seconds ? { expires_at: Math.floor(Date.now() / 1000) + seconds } : {}) };

    this.state.set('loading');
    this.lastShared.set(null);
    this.shares.create(this.hypervisorId(), this.vm().id, body).subscribe({
      next: () => {
        this.lastShared.set(username);
        this.username.set('');
        this.submitted.set(false);
        this.state.set('form');
        this.load();
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }

  protected revoke(share: Share): void {
    this.actionError.set(null);
    this.shares.revoke(this.hypervisorId(), this.vm().id, share.user_id).subscribe({
      next: () => this.load(),
      error: (error: AppError) => this.actionError.set(error),
    });
  }
}
