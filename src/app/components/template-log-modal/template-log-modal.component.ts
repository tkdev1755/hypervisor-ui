import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { CodeBlockComponent } from '@app/components/ui/code-block/code-block.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { TemplateStatus } from '@app/models/template.model';
import { ModalRef } from '@app/services/modal-ref';
import { TemplateService } from '@app/services/template.service';

/**
 * Le journal de construction d'une version de template (admin seulement : il contient la sortie
 * de Packer, souvent avec des mots de passe).
 *
 * Pendant la construction, le journal est relu toutes les 2 secondes. Pour ne pas tout retélécharger,
 * on passe à l'API la position déjà lue (`offset` = `next_offset` de la réponse précédente) :
 * elle ne renvoie que la suite, qu'on ajoute au texte déjà affiché. On s'arrête quand `finished` est vrai.
 */
@Component({
  selector: 'app-template-log-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, CalloutComponent, CodeBlockComponent, StatusBadgeComponent, TextComponent],
  templateUrl: './template-log-modal.component.html',
  styleUrl: './template-log-modal.component.scss',
})
export class TemplateLogModalComponent implements OnInit, OnDestroy {
  protected readonly modalRef = inject(ModalRef<void>);
  private readonly templates = inject(TemplateService);

  readonly hypervisorId = input.required<string>();
  readonly templateId = input.required<string>();
  readonly templateName = input('');
  readonly version = input.required<number>();

  protected readonly content = signal('');
  protected readonly status = signal<TemplateStatus | null>(null);
  protected readonly finished = signal(false);
  protected readonly truncated = signal(false);

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);

  private offset = 0;
  private pollSub?: Subscription;

  ngOnInit(): void {
    this.start();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  /** (Re)lit le journal depuis le début, puis suit la construction si elle tourne encore. */
  protected start(): void {
    this.pollSub?.unsubscribe();
    this.offset = 0;
    this.content.set('');
    this.state.set('loading');
    this.read();
  }

  private read(): void {
    this.templates.logs(this.hypervisorId(), this.templateId(), this.version(), this.offset).subscribe({
      next: (log) => {
        this.content.update((text) => text + log.content);
        this.offset = log.next_offset;
        this.status.set(log.status);
        this.finished.set(log.finished);
        this.truncated.set(log.truncated);
        this.state.set('form');
        if (!log.finished) {
          // Pas d'interval() : on attend la réponse avant de programmer la lecture suivante.
          this.pollSub = timer(2000).subscribe(() => this.read());
        }
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }
}
