import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { HypervisorService } from '@app/services/hypervisor.service';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Ajouter un hyperviseur, ou modifier celui reçu en entrée.
 * Se ferme avec l'hyperviseur créé ou modifié (ou undefined si annulé).
 */
@Component({
  selector: 'app-hypervisor-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, TextComponent, ButtonComponent],
  templateUrl: './hypervisor-form-modal.component.html',
  styleUrl: './hypervisor-form-modal.component.scss',
})
export class HypervisorFormModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<Hypervisor>);
  private readonly hypervisors = inject(HypervisorService);

  /** Si fourni : mode modification. Sinon : mode création. */
  readonly hypervisor = input<Hypervisor>();

  // Les valeurs des champs (liées avec [(value)] dans le .html).
  protected readonly name = signal('');
  protected readonly uri = signal('');
  protected readonly uriExamples = ['qemu:///system', 'qemu+ssh://admin@192.168.1.10/system'];

  // Les erreurs ne s'affichent qu'après un premier essai d'envoi.
  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && this.name().trim() === '' ? 'Le nom est obligatoire.' : null,
  );
  protected readonly uriError = computed(() =>
    this.submitted() && !/^qemu(\+\w+)?:\/\//.test(this.uri()) ? 'L’URI doit commencer par qemu: (par exemple qemu:///system).' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<Hypervisor | null>(null);

  ngOnInit(): void {
    const existing = this.hypervisor();
    if (existing) {
      this.name.set(existing.name);
      this.uri.set(existing.uri);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError() || this.uriError()) {
      return;
    }
    const body = { name: this.name().trim(), uri: this.uri().trim() };
    const existing = this.hypervisor();
    const request = existing ? this.hypervisors.update(existing.id, body) : this.hypervisors.create(body);

    this.state.set('loading');
    request.subscribe({
      next: (hypervisor) => {
        this.result.set(hypervisor);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
