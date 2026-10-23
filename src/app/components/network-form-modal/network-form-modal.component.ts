import { Component, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Network } from '@app/models/network.model';
import { InfrastructureService } from '@app/services/infrastructure.service';
import { ModalRef } from '@app/services/modal-ref';

/** Créer un réseau avec un nom et, facultativement, un bridge. */
@Component({
  selector: 'app-network-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, TextFieldComponent],
  templateUrl: './network-form-modal.component.html',
  styleUrl: './network-form-modal.component.scss',
})
export class NetworkFormModalComponent {
  protected readonly modalRef = inject(ModalRef<Network>);
  private readonly infrastructure = inject(InfrastructureService);

  readonly hypervisorId = input.required<string>();

  protected readonly name = signal('');
  protected readonly bridge = signal('');
  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() => (this.submitted() && !this.name().trim() ? 'Le nom est obligatoire.' : null));

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<Network | null>(null);

  protected submit(): void {
    this.submitted.set(true);
    const name = this.name().trim();
    if (!name) {
      return;
    }

    this.error.set(null);
    this.state.set('loading');
    this.infrastructure.createNetwork(this.hypervisorId(), { name, bridge: this.bridge().trim() || null }).subscribe({
      next: (network) => {
        this.result.set(network);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}