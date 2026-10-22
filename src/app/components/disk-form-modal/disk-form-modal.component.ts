import { Component, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { NumberFieldComponent } from '@app/components/ui/number-field/number-field.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Disk, DiskRequest } from '@app/models/disk.model';
import { InfrastructureService } from '@app/services/infrastructure.service';
import { ModalRef } from '@app/services/modal-ref';

/** Créer un disque avec son nom, sa taille et son format. */
@Component({
  selector: 'app-disk-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, ChoiceCardsComponent, NumberFieldComponent, TextFieldComponent, TextComponent],
  templateUrl: './disk-form-modal.component.html',
  styleUrl: './disk-form-modal.component.scss',
})
export class DiskFormModalComponent {
  protected readonly modalRef = inject(ModalRef<Disk>);
  private readonly infrastructure = inject(InfrastructureService);

  readonly hypervisorId = input.required<string>();

  protected readonly name = signal('');
  protected readonly sizeGb = signal(20);
  protected readonly format = signal('qcow2');
  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() => (this.submitted() && !this.name().trim() ? 'Le nom est obligatoire.' : null));
  protected readonly sizeError = computed(() => {
    const size = this.sizeGb();
    return this.submitted() && (!Number.isInteger(size) || size < 1 || size > 10000) ? 'La taille doit être comprise entre 1 et 10 000 Go.' : null;
  });
  protected readonly formats: Choice<string>[] = [
    { value: 'qcow2', label: 'qcow2', description: 'Format flexible avec snapshots' },
    { value: 'raw', label: 'raw', description: 'Format brut' },
  ];

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<Disk | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    const name = this.name().trim();
    const sizeGb = this.sizeGb();
    if (!name || this.sizeError()) {
      return;
    }

    const body: DiskRequest = { name, size_gb: sizeGb, format: this.format() };
    this.error.set(null);
    this.state.set('loading');
    this.infrastructure.createDisk(this.hypervisorId(), body).subscribe({
      next: (disk) => {
        this.result.set(disk);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}