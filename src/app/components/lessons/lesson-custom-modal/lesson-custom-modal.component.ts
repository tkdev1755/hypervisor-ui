import { Component, inject, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { InlineCodeComponent } from '@app/components/ui/inline-code/inline-code.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { ModalService } from '@app/services/modal.service';
import { DemoRenameModalComponent } from '../demo-rename-modal/demo-rename-modal.component';
import { LessonComponent } from '../lesson/lesson.component';

/** Leçon 13 (Avancé) : écrire sa propre modale (formulaire, états, résultat). */
@Component({
  selector: 'app-lesson-custom-modal',
  imports: [LessonComponent, ColumnComponent, RowComponent, TextComponent, InlineCodeComponent, CalloutComponent, ButtonComponent],
  templateUrl: './lesson-custom-modal.component.html',
  styleUrl: './lesson-custom-modal.component.scss',
})
export class LessonCustomModalComponent {
  private readonly modal = inject(ModalService);

  readonly code = `// --- demo-rename-modal.component.ts ---
export class DemoRenameModalComponent {
  protected readonly modalRef = inject(ModalRef<string>);   // la télécommande
  readonly currentName = input.required<string>();          // reçu de celui qui ouvre

  // Formulaire : un signal par champ, l'erreur est un computed
  protected readonly name = signal('');
  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && !/^[a-z0-9-]+$/.test(this.name())
      ? 'Minuscules, chiffres et tirets uniquement.'
      : null,
  );

  // Les états du cadre : 'form' → 'loading' → 'success' | 'error'
  protected readonly state = signal<ModalState>('form');
  protected readonly error = signal<AppError | null>(null);

  protected submit(): void {
    this.submitted.set(true);              // à partir de maintenant, on affiche les erreurs
    if (this.nameError()) {
      return;
    }
    this.state.set('loading');             // le cadre affiche le spinner et bloque la fermeture
    this.vms.rename(this.name()).subscribe({
      next: () => this.state.set('success'),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}

<!-- --- demo-rename-modal.component.html --- -->
<!-- (retry) : clic sur « Réessayer » → retour au formulaire -->
<!-- (done)  : clic sur « Terminer »  → on ferme avec le résultat -->
<app-modal-shell
  title="Renommer la machine virtuelle"
  [state]="state()"
  [error]="error()"
  (retry)="state.set('form')"
  (done)="modalRef.close(name())"
>
  <app-text-field label="Nouveau nom" [(value)]="name" [error]="nameError()" (enter)="submit()" />

  <!-- « footer » place les boutons en bas de la modale -->
  <app-row footer [gap]="8">
    <app-button variant="ghost" (pressed)="modalRef.close()">Annuler</app-button>
    <app-button (pressed)="submit()">Renommer</app-button>
  </app-row>
</app-modal-shell>

// --- Celui qui ouvre ---
this.modal
  .open<DemoRenameModalComponent, string>(DemoRenameModalComponent, {
    size: 'sm',
    inputs: { currentName: 'web-01' },
  })
  .afterClosed$.subscribe((nouveauNom) => {
    if (nouveauNom) { this.nom.set(nouveauNom); }
  });`;

  readonly nom = signal('web-01');
  readonly dernierRenommage = signal<string | null>(null);

  renommer(): void {
    this.modal
      .open<DemoRenameModalComponent, string>(DemoRenameModalComponent, {
        size: 'sm',
        inputs: { currentName: this.nom() },
      })
      .afterClosed$.subscribe((nouveauNom) => {
        if (nouveauNom) {
          this.dernierRenommage.set(this.nom() + ' → ' + nouveauNom);
          this.nom.set(nouveauNom);
        }
      });
  }
}
