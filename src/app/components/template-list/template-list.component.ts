import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { TemplateFormModalComponent } from '@app/components/template-form-modal/template-form-modal.component';
import { TemplateVmModalComponent } from '@app/components/template-vm-modal/template-vm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { ResourceCardComponent } from '@app/components/ui/resource-card/resource-card.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { Template, isBuilding } from '@app/models/template.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { AuthService } from '@app/services/auth.service';
import { InventoryService } from '@app/services/inventory.service';
import { ModalService } from '@app/services/modal.service';
import { TemplateService } from '@app/services/template.service';

/**
 * Les templates d'un hyperviseur : des images disque construites par Packer, à partir desquelles
 * on crée des VM déjà installées.
 *
 *  - Un administrateur voit tous les templates (même en construction ou ratés) et en crée de
 *    nouveaux ; un clic sur une carte ouvre la page du template (versions, journal, accès…).
 *  - Un utilisateur qui a l'accès à l'hyperviseur ne voit que les templates prêts qui lui sont
 *    ouverts, et crée des VM à partir d'eux. Sans cet accès, l'API répond 403 : on l'explique.
 *
 * Chaque carte montre l'état de la DERNIÈRE version. Pendant une reconstruction, on peut toujours
 * créer des VM : elles partent de la dernière version prête (`default_version`).
 * Une construction dure plusieurs minutes : tant qu'il y en a une, la liste est rechargée toutes
 * les 5 secondes, sans afficher de chargement (polling).
 */
@Component({
  selector: 'app-template-list',
  imports: [ColumnComponent, RowComponent, SpacerComponent, TextComponent, GridComponent, ResourceCardComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent, ButtonComponent],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
})
export class TemplateListComponent implements OnInit, OnDestroy {
  private readonly templates = inject(TemplateService);
  private readonly modal = inject(ModalService);
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  protected readonly list = signal<Template[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);
  /** 403 : l'utilisateur n'a pas l'accès à cet hyperviseur (il y voit seulement une VM prêtée). */
  protected readonly noAccess = computed(() => this.error()?.kind === 'business' && this.error()?.status === 403);

  /** Y a-t-il une construction en cours ? Si oui, on recharge la liste régulièrement. */
  private readonly building = computed(() => this.list().some((template) => isBuilding(template.status)));
  private pollSub?: Subscription;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetch();
  }

  /** Recharge la liste sans afficher de chargement (utilisé par le polling). */
  private fetch(): void {
    this.templates.list(this.hypervisorId()).subscribe({
      next: (templates) => {
        this.list.set(templates);
        this.loading.set(false);
        this.updatePolling();
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
        this.updatePolling();
      },
    });
  }

  /** Démarre le polling s'il y a une construction en cours, l'arrête sinon (ou après une erreur). */
  private updatePolling(): void {
    const shouldPoll = this.building() && !this.error();
    if (shouldPoll && !this.pollSub) {
      this.pollSub = interval(5000).subscribe(() => this.fetch());
    } else if (!shouldPoll && this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = undefined;
    }
  }

  /** Peut-on créer une VM ? Il faut au moins une version prête. */
  protected canCreateVm(template: Template): boolean {
    return template.default_version !== null && template.default_version !== undefined;
  }

  /** La ligne d'information de la carte, d'après la dernière version. */
  protected meta(template: Template): string {
    const latest = template.latest_version;
    if (!latest) {
      return 'Aucune version';
    }
    const version = `Version ${latest.version}`;
    switch (latest.status) {
      case 'created':
        return `${version} · ${latest.disk_size_gb ?? '?'} Go`;
      case 'failed':
        return `${version} ratée` + (this.canCreateVm(template) ? ` · VM depuis la version ${template.default_version}` : '');
      case 'cancelled':
        return `${version} annulée` + (this.canCreateVm(template) ? ` · VM depuis la version ${template.default_version}` : '');
      default:
        return `${version} en construction (3 à 10 minutes)…`;
    }
  }

  /** Le sous-titre : le pool, et « restreint » si seuls certains utilisateurs y ont accès. */
  protected subtitle(template: Template): string {
    return template.visibility === 'restricted' ? `pool ${template.pool} · accès restreint` : `pool ${template.pool}`;
  }

  /** Admin : la page du template (versions, journal, configuration, accès). */
  protected open(template: Template): void {
    if (this.auth.isAdmin()) {
      this.router.navigate(['/hypervisors', this.hypervisorId(), 'templates', template.id]);
    }
  }

  protected create(): void {
    this.modal
      .open<TemplateFormModalComponent, Template>(TemplateFormModalComponent, {
        size: 'lg',
        inputs: { hypervisorId: this.hypervisorId(), hypervisorName: this.hypervisorName() },
      })
      .afterClosed$.subscribe((template) => {
        if (template) {
          this.load();
        }
      });
  }

  /** Créer une VM : une fois la copie du disque terminée, on ouvre la page de la nouvelle VM. */
  protected createVm(template: Template): void {
    this.modal
      .open<TemplateVmModalComponent, VirtualMachine>(TemplateVmModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), template },
      })
      .afterClosed$.subscribe((vm) => {
        if (vm) {
          this.inventory.refresh();
          this.router.navigate(['/hypervisors', this.hypervisorId(), 'vms', vm.id]);
        }
      });
  }
}
