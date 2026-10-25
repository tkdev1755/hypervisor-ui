import { Component, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Template } from '@app/models/template.model';
import { ModalRef } from '@app/services/modal-ref';
import { TemplateService } from '@app/services/template.service';

/**
 * Supprimer un template, toutes ses versions et leurs disques (admin seulement). Les VM déjà
 * créées à partir de lui gardent leur propre copie. Impossible pendant une construction (409 :
 * il faut d'abord l'arrêter). Se ferme avec `true`.
 */
@Component({
  selector: 'app-template-delete-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, TextComponent],
  templateUrl: './template-delete-modal.component.html',
  styleUrl: './template-delete-modal.component.scss',
})
export class TemplateDeleteModalComponent {
  protected readonly modalRef = inject(ModalRef<boolean>);
  private readonly templates = inject(TemplateService);

  readonly hypervisorId = input.required<string>();
  readonly template = input.required<Template>();

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected confirm(): void {
    this.state.set('loading');
    this.templates.delete(this.hypervisorId(), this.template().id).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
