import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Lab, LabDetail, LabVisibility, UpdateLab } from '@app/models/lab.model';
import { AuthService } from '@app/services/auth.service';
import { LabService } from '@app/services/lab.service';
import { ModalRef } from '@app/services/modal-ref';

/**
 * Créer un labo (admin) ou modifier son nom, sa description et sa visibilité.
 *
 * - Sans `lab` : création (admin seulement). Le labo est vide : réseaux et VM s'ajoutent ensuite
 *   depuis sa page (onglet « Définition »).
 * - Avec `lab` : modification (droit 'manage'). La visibilité est réservée aux admins : le choix est
 *   caché aux gestionnaires et le champ n'est pas envoyé (l'API répondrait 403).
 * Se ferme avec le labo créé ou modifié.
 */
@Component({
  selector: 'app-lab-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, TextComponent, ButtonComponent, ChoiceCardsComponent],
  templateUrl: './lab-form-modal.component.html',
  styleUrl: './lab-form-modal.component.scss',
})
export class LabFormModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<LabDetail>);
  private readonly labs = inject(LabService);
  protected readonly auth = inject(AuthService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');
  /** Le labo à modifier ; absent pour une création. */
  readonly lab = input<Lab | null>(null);

  protected readonly editing = computed(() => this.lab() !== null);

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly visibility = signal<LabVisibility>('restricted');

  protected readonly visibilityChoices: Choice<LabVisibility>[] = [
    { value: 'restricted', label: 'Restreint', description: 'Seulement ceux qui ont un droit' },
    { value: 'hypervisor', label: "Tous ceux qui ont l'accès", description: "à l'hyperviseur, sans limite" },
  ];

  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() => {
    const name = this.name().trim();
    return this.submitted() && (name.length === 0 || name.length > 64) ? 'De 1 à 64 caractères.' : null;
  });
  protected readonly descriptionError = computed(() =>
    this.submitted() && this.description().length > 2000 ? 'Au plus 2000 caractères.' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<LabDetail | null>(null);

  ngOnInit(): void {
    const lab = this.lab();
    if (lab) {
      this.name.set(lab.name);
      this.description.set(lab.description);
      this.visibility.set(lab.visibility);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError() || this.descriptionError()) {
      return;
    }
    const body: UpdateLab = {
      name: this.name().trim(),
      description: this.description().trim(),
      // La visibilité est réservée aux admins : un gestionnaire ne l'envoie pas.
      ...(this.auth.isAdmin() ? { visibility: this.visibility() } : {}),
    };
    const lab = this.lab();
    this.state.set('loading');
    const request = lab
      ? this.labs.update(this.hypervisorId(), lab.id, body)
      : this.labs.create(this.hypervisorId(), { ...body, name: body.name ?? '' });
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
