import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Quota, User } from '@app/models/user.model';
import { ModalRef } from '@app/services/modal-ref';
import { UserService } from '@app/services/user.service';

/** Un champ vide = illimité ; sinon un entier positif ou nul. `undefined` = valeur invalide. */
function parseLimit(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

/**
 * Fixer les quotas d'un utilisateur (admin seulement). L'API REMPLACE tout le quota :
 * un champ laissé vide devient « illimité ». Se ferme avec l'utilisateur mis à jour.
 */
@Component({
  selector: 'app-user-quota-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, ButtonComponent],
  templateUrl: './user-quota-modal.component.html',
  styleUrl: './user-quota-modal.component.scss',
})
export class UserQuotaModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<User>);
  private readonly users = inject(UserService);

  readonly user = input.required<User>();

  // Un texte par champ : « » veut dire illimité.
  protected readonly maxVms = signal('');
  protected readonly maxVcpus = signal('');
  protected readonly maxMemoryMb = signal('');
  protected readonly maxDiskGb = signal('');

  protected readonly submitted = signal(false);
  private readonly invalid = 'Un nombre entier, ou rien pour « illimité ».';
  protected readonly vmsError = computed(() => (this.submitted() && parseLimit(this.maxVms()) === undefined ? this.invalid : null));
  protected readonly vcpusError = computed(() => (this.submitted() && parseLimit(this.maxVcpus()) === undefined ? this.invalid : null));
  protected readonly memoryError = computed(() => (this.submitted() && parseLimit(this.maxMemoryMb()) === undefined ? this.invalid : null));
  protected readonly diskError = computed(() => (this.submitted() && parseLimit(this.maxDiskGb()) === undefined ? this.invalid : null));

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<User | null>(null);

  ngOnInit(): void {
    const { quota } = this.user();
    this.maxVms.set(quota.max_vms === null ? '' : String(quota.max_vms));
    this.maxVcpus.set(quota.max_vcpus === null ? '' : String(quota.max_vcpus));
    this.maxMemoryMb.set(quota.max_memory_mb === null ? '' : String(quota.max_memory_mb));
    this.maxDiskGb.set(quota.max_disk_gb === null ? '' : String(quota.max_disk_gb));
  }

  protected submit(): void {
    this.submitted.set(true);
    const quota = {
      max_vms: parseLimit(this.maxVms()),
      max_vcpus: parseLimit(this.maxVcpus()),
      max_memory_mb: parseLimit(this.maxMemoryMb()),
      max_disk_gb: parseLimit(this.maxDiskGb()),
    };
    if (Object.values(quota).includes(undefined)) {
      return;
    }
    this.state.set('loading');
    this.users.setQuota(this.user().id, quota as Quota).subscribe({
      next: (user) => {
        this.result.set(user);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
