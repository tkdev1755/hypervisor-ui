import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Group } from '@app/models/group.model';
import { GroupService } from '@app/services/group.service';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Créer un groupe (sans `group`) ou le renommer et changer sa description (avec `group`).
 * Admin seulement. Se ferme avec le groupe créé ou modifié.
 */
@Component({
  selector: 'app-group-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, ButtonComponent],
  templateUrl: './group-form-modal.component.html',
  styleUrl: './group-form-modal.component.scss',
})
export class GroupFormModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<Group>);
  private readonly groups = inject(GroupService);

  /** Le groupe à modifier ; absent pour une création. Seuls son id, son nom et sa description servent. */
  readonly group = input<Pick<Group, 'id' | 'name' | 'description'> | null>(null);
  protected readonly editing = computed(() => this.group() !== null);

  protected readonly name = signal('');
  protected readonly description = signal('');

  protected readonly submitted = signal(false);
  /** Mêmes limites que l'API : un nom de 1 à 64 caractères, une description de 500 au plus. */
  protected readonly nameError = computed(() => {
    const length = this.name().trim().length;
    return this.submitted() && (length === 0 || length > 64) ? 'De 1 à 64 caractères.' : null;
  });
  protected readonly descriptionError = computed(() =>
    this.submitted() && this.description().trim().length > 500 ? '500 caractères au plus.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<Group | null>(null);

  ngOnInit(): void {
    const group = this.group();
    if (group) {
      this.name.set(group.name);
      this.description.set(group.description);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError() || this.descriptionError()) {
      return;
    }
    const body = { name: this.name().trim(), description: this.description().trim() };
    const group = this.group();
    this.state.set('loading');
    const request = group ? this.groups.update(group.id, body) : this.groups.create(body);
    request.subscribe({
      next: (saved) => {
        this.result.set(saved);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
