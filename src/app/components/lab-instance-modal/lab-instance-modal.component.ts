import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Lab, LabInstance } from '@app/models/lab.model';
import { AuthService } from '@app/services/auth.service';
import { LabService } from '@app/services/lab.service';
import { ModalRef } from '@app/services/modal-ref';
import { formatQuotaRow, quotaRows } from '@app/utils/quota';

/**
 * Déployer un labo : créer une instance, c'est-à-dire ses réseaux internes puis toutes ses VM, qui
 * appartiendront à l'utilisateur connecté (elles comptent dans son quota).
 *
 * Deux choix : le nom de l'instance (par défaut : celui du labo) et démarrer les VM tout de suite ou non.
 * L'API répond aussitôt (202) avec l'instance en 'deploying' : la modale se ferme avec elle, et la page
 * de l'instance suit le déploiement jusqu'à 'ready' ou 'failed'.
 */
@Component({
  selector: 'app-lab-instance-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, TextComponent, ButtonComponent, ChoiceCardsComponent, CalloutComponent],
  templateUrl: './lab-instance-modal.component.html',
  styleUrl: './lab-instance-modal.component.scss',
})
export class LabInstanceModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<LabInstance>);
  private readonly labs = inject(LabService);
  private readonly auth = inject(AuthService);

  readonly hypervisorId = input.required<string>();
  readonly lab = input.required<Lab>();

  protected readonly name = signal('');
  protected readonly start = signal(true);

  protected readonly startChoices: Choice<boolean>[] = [
    { value: true, label: 'Oui', description: 'Démarrer les VM, routeurs d’abord' },
    { value: false, label: 'Non', description: 'Les VM restent arrêtées' },
  ];

  /** La limite d'instances de ce labo, en une phrase (vide s'il n'y en a pas, ou pour un admin). */
  protected readonly labLimit = computed(() => {
    const { level, max_instances, instance_count } = this.lab().access;
    if (level === 'admin' || max_instances === null) {
      return '';
    }
    return `Vous possédez ${instance_count} instance(s) de ce labo, sur ${max_instances} au plus.`;
  });

  /** Le quota de l'utilisateur, en une phrase (vide s'il n'a aucune limite). */
  protected readonly quotaSummary = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return quotaRows(user)
      .filter((row) => row.limit !== null)
      .map((row) => `${row.label} : ${formatQuotaRow(row)}`)
      .join(' · ');
  });

  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && this.name().trim().length > 64 ? 'Au plus 64 caractères (vide : le nom du labo).' : null,
  );

  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<LabInstance | null>(null);

  ngOnInit(): void {
    this.auth.refreshUsage(); // La consommation affichée doit être à jour.
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError()) {
      return;
    }
    const name = this.name().trim();
    this.state.set('loading');
    this.labs.createInstance(this.hypervisorId(), this.lab().id, { start: this.start(), ...(name ? { name } : {}) }).subscribe({
      next: (instance) => {
        this.result.set(instance);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
