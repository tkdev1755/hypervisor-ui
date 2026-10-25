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
import { Template, canManageTemplate, isBuilding, templateLimitReached } from '@app/models/template.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { AuthService } from '@app/services/auth.service';
import { InventoryService } from '@app/services/inventory.service';
import { ModalService } from '@app/services/modal.service';
import { TemplateService } from '@app/services/template.service';

/**
 * Les templates d'un hyperviseur : des images disque construites par Packer, à partir desquelles
 * on crée des VM déjà installées.
 *
 * L'API ne renvoie que les templates sur lesquels l'utilisateur a un droit, et chacun dit ce qu'il
 * peut en faire (`access.level`) :
 *  - 'admin' ou 'manage' : un clic sur la carte ouvre la page du template (versions, journal…), et on
 *    peut l'activer ou le désactiver. Seul un admin crée des templates.
 *  - 'use' : seulement « Créer une VM », dans la limite éventuelle de VM de ce template (`access.max_vms`).
 *
 * Un template DÉSACTIVÉ (`allow_vm_creation: false`) ne permet plus de créer de VM, même à un admin.
 * L'API le liste quand même : on le cache ici à ceux qui ne font que l'utiliser ; ceux qui le gèrent
 * le voient marqué « désactivé » et peuvent le réactiver depuis la carte.
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
  /** L'erreur d'une activation / désactivation (affichée sous la grille). */
  protected readonly actionError = signal<AppError | null>(null);
  /** L'id du template en cours d'activation / désactivation (pour afficher son chargement). */
  protected readonly busyId = signal<string | null>(null);

  /** Ce qu'on affiche : les templates activés, et aussi les désactivés pour ceux qui les gèrent. */
  protected readonly visible = computed(() => this.list().filter((template) => template.allow_vm_creation || canManageTemplate(template)));

  // Exposés au .html : des fonctions simples, définies dans models/template.model.ts.
  protected readonly canManage = canManageTemplate;
  protected readonly limitReached = templateLimitReached;
  /** 403 : l'API refuse la liste (ancien comportement ; elle renvoie aujourd'hui une liste vide sans droit). */
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

  /** Peut-on créer une VM ? Template activé, au moins une version prête, et limite de VM pas atteinte. */
  protected canCreateVm(template: Template): boolean {
    const ready = template.default_version !== null && template.default_version !== undefined;
    return template.allow_vm_creation && ready && !templateLimitReached(template);
  }

  /** La ligne d'information de la carte : la dernière version, et la limite de VM s'il y en a une. */
  protected meta(template: Template): string {
    const { max_vms, vm_count, level } = template.access;
    const info = this.versionInfo(template);
    return max_vms !== null && level !== 'admin' ? `${info} · ${vm_count}/${max_vms} VM` : info;
  }

  private versionInfo(template: Template): string {
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

  /** Le sous-titre : le rôle de l'utilisateur (s'il le gère), le pool, puis « restreint » et « désactivé ». */
  protected subtitle(template: Template): string {
    const parts = template.access.level === 'manage' ? ['vous le gérez', `pool ${template.pool}`] : [`pool ${template.pool}`];
    if (template.visibility === 'restricted') {
      parts.push('accès restreint');
    }
    if (!template.allow_vm_creation) {
      parts.push('désactivé');
    }
    return parts.join(' · ');
  }

  /** La pastille : l'état de la dernière version, ou « Désactivé » (une construction en cours reste affichée). */
  protected badge(template: Template): string | undefined {
    if (!template.allow_vm_creation && !isBuilding(template.status)) {
      return 'disabled';
    }
    return template.status ?? undefined;
  }

  /** Admin ou gestionnaire : activer ou désactiver le template (PATCH allow_vm_creation), sans confirmation : c'est réversible. */
  protected toggle(template: Template): void {
    this.busyId.set(template.id);
    this.actionError.set(null);
    this.templates.update(this.hypervisorId(), template.id, { allow_vm_creation: !template.allow_vm_creation }).subscribe({
      next: (updated) => {
        this.list.update((templates) => templates.map((t) => (t.id === updated.id ? updated : t)));
        this.busyId.set(null);
      },
      error: (error: AppError) => {
        this.actionError.set(error);
        this.busyId.set(null);
      },
    });
  }

  /** Admin ou gestionnaire : la page du template (versions, journal, configuration, droits). */
  protected open(template: Template): void {
    if (canManageTemplate(template)) {
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
