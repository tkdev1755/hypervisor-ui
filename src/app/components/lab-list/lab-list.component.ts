import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { LabFormModalComponent } from '@app/components/lab-form-modal/lab-form-modal.component';
import { LabInstanceModalComponent } from '@app/components/lab-instance-modal/lab-instance-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { ResourceCardComponent } from '@app/components/ui/resource-card/resource-card.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { Lab, LabDetail, LabInstance, labLimitReached } from '@app/models/lab.model';
import { AuthService } from '@app/services/auth.service';
import { LabService } from '@app/services/lab.service';
import { ModalService } from '@app/services/modal.service';

/**
 * Les labos d'un hyperviseur : des ensembles de VM (issues de templates) et de réseaux, que l'on
 * déploie en instances.
 *
 * L'API ne renvoie que les labos sur lesquels l'utilisateur a un droit, et chacun dit ce qu'il peut
 * en faire (`access.level`). Un clic sur une carte ouvre la page du labo (sa définition, ses instances) ;
 * « Déployer » crée une instance, dans la limite éventuelle `access.max_instances`.
 * Seul un administrateur crée des labos.
 */
@Component({
  selector: 'app-lab-list',
  imports: [ColumnComponent, RowComponent, SpacerComponent, TextComponent, GridComponent, ResourceCardComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent, ButtonComponent],
  templateUrl: './lab-list.component.html',
  styleUrl: './lab-list.component.scss',
})
export class LabListComponent implements OnInit {
  private readonly labs = inject(LabService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  protected readonly list = signal<Lab[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  // Exposée au .html : la limite d'instances de ce labo est-elle atteinte (jamais pour un admin) ?
  protected readonly limitReached = labLimitReached;
  protected readonly empty = computed(() => this.list().length === 0);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.labs.list(this.hypervisorId()).subscribe({
      next: (labs) => {
        this.list.set(labs);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  /** Le sous-titre : le rôle de l'utilisateur (s'il le gère), puis la description. */
  protected subtitle(lab: Lab): string {
    const parts: string[] = [];
    if (lab.access.level === 'manage') {
      parts.push('vous le gérez');
    }
    if (lab.visibility === 'hypervisor') {
      parts.push("ouvert à l'hyperviseur");
    }
    if (lab.description) {
      parts.push(lab.description);
    }
    return parts.join(' · ');
  }

  /** La ligne d'information : mes instances, et la limite s'il y en a une. */
  protected meta(lab: Lab): string {
    const { max_instances, instance_count, level } = lab.access;
    const mine = `${instance_count} instance(s) à vous`;
    return max_instances !== null && level !== 'admin' ? `${mine} sur ${max_instances} au plus` : mine;
  }

  protected open(lab: Lab): void {
    this.router.navigate(['/hypervisors', this.hypervisorId(), 'labs', lab.id]);
  }

  protected create(): void {
    this.modal
      .open<LabFormModalComponent, LabDetail>(LabFormModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), hypervisorName: this.hypervisorName() },
      })
      .afterClosed$.subscribe((lab) => {
        // Un labo tout neuf est vide : on ouvre sa page pour y ajouter réseaux et VM.
        if (lab) {
          this.open(lab);
        }
      });
  }

  /** Déployer : une fois l'instance lancée, on ouvre sa page, qui suit le déploiement. */
  protected deploy(lab: Lab): void {
    this.modal
      .open<LabInstanceModalComponent, LabInstance>(LabInstanceModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), lab },
      })
      .afterClosed$.subscribe((instance) => {
        if (instance) {
          this.router.navigate(['/hypervisors', this.hypervisorId(), 'labs', lab.id, 'instances', instance.id]);
        }
      });
  }
}
