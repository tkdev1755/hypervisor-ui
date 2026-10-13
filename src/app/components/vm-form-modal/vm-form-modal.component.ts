import { Component, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { CreateVm, VirtualMachine } from '@app/models/virtual-machine.model';
import { ModalRef } from '@app/services/modal-ref';
import { VmService } from '@app/services/vm.service';

type Preset = 'small' | 'medium' | 'large';

/** Les caractéristiques de chaque gabarit. */
const PRESETS: Record<Preset, { vcpus: number; memory_mb: number }> = {
  small: { vcpus: 1, memory_mb: 1024 },
  medium: { vcpus: 2, memory_mb: 4096 },
  large: { vcpus: 4, memory_mb: 8192 },
};

/** Créer une VM sur un hyperviseur : un nom et un gabarit. */
@Component({
  selector: 'app-vm-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, TextComponent, ButtonComponent, ChoiceCardsComponent],
  templateUrl: './vm-form-modal.component.html',
  styleUrl: './vm-form-modal.component.scss',
})
export class VmFormModalComponent {
  protected readonly modalRef = inject(ModalRef<VirtualMachine>);
  private readonly vms = inject(VmService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  protected readonly name = signal('');
  protected readonly preset = signal<Preset>('medium');
  protected readonly presets: Choice<Preset>[] = [
    { value: 'small', label: 'Petite', description: '1 vCPU · 1 Go' },
    { value: 'medium', label: 'Moyenne', description: '2 vCPU · 4 Go' },
    { value: 'large', label: 'Grande', description: '4 vCPU · 8 Go' },
  ];

  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && !/^[a-zA-Z0-9-]+$/.test(this.name()) ? 'Lettres, chiffres et tirets uniquement.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<VirtualMachine | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError()) {
      return;
    }
    // « ... » (spread) recopie tous les champs du gabarit dans l'objet.
    const body: CreateVm = { name: this.name(), ...PRESETS[this.preset()] };

    this.state.set('loading');
    this.vms.create(this.hypervisorId(), body).subscribe({
      next: (vm) => {
        this.result.set(vm);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
