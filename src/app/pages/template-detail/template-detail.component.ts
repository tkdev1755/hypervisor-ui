import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, forkJoin, timer } from 'rxjs';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { TemplatePermissionListComponent } from '@app/components/template-permission-list/template-permission-list.component';
import { TemplateDeleteModalComponent } from '@app/components/template-delete-modal/template-delete-modal.component';
import { TemplateFormModalComponent } from '@app/components/template-form-modal/template-form-modal.component';
import { TemplateLogModalComponent } from '@app/components/template-log-modal/template-log-modal.component';
import { TemplateVmModalComponent } from '@app/components/template-vm-modal/template-vm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { CodeBlockComponent } from '@app/components/ui/code-block/code-block.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { StatusBadgeComponent } from '@app/components/ui/status-badge/status-badge.component';
import { Tab, TabsComponent } from '@app/components/ui/tabs/tabs.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { Template, TemplateVersion, canManageTemplate, isBuilding, templateLimitReached } from '@app/models/template.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { AuthService } from '@app/services/auth.service';
import { ResourceCacheService } from '@app/services/resource-cache.service';
import { InventoryService } from '@app/services/inventory.service';
import { ModalService } from '@app/services/modal.service';
import { TemplateService } from '@app/services/template.service';

type Onglet = 'versions' | 'config' | 'permissions';

/**
 * La page d'un template, à l'adresse /hypervisors/:id/templates/:templateId, pour ceux qui le gèrent
 * (droit 'manage') et les admins. Ce qu'on affiche dépend de `template.access.level` :
 *
 *  - Versions : chaque construction, avec son état, son journal, « Créer une VM » (version prête)
 *    et sa suppression. Pendant une construction, la page se recharge toutes les 3 secondes.
 *  - Configuration : la définition actuelle (configuration Packer, disque, pool, visibilité).
 *  - Droits (admin seulement) : les utilisateurs et groupes qui peuvent l'utiliser ou le gérer.
 *
 * Un simple utilisateur ('use') qui arrive ici par l'adresse ne voit qu'un message : il crée ses VM
 * depuis l'onglet Templates de l'hyperviseur.
 *
 * En haut : Activer / Désactiver (désactivé : plus aucune VM à partir de lui, et les utilisateurs ne le
 * voient plus), Reconstruire (nouvelle version à partir de la définition actuelle), Arrêter la
 * construction (puis Forcer l'arrêt si Packer tarde à faire le ménage), Modifier, et Supprimer (admin).
 */
@Component({
  selector: 'app-template-detail',
  imports: [
    PageComponent,
    ColumnComponent,
    GridComponent,
    CardComponent,
    TextComponent,
    ButtonComponent,
    CalloutComponent,
    CodeBlockComponent,
    StatusBadgeComponent,
    TabsComponent,
    ListComponent,
    ListTileComponent,
    LoadingComponent,
    ErrorPanelComponent,
    EmptyStateComponent,
    TemplatePermissionListComponent,
  ],
  templateUrl: './template-detail.component.html',
  styleUrl: './template-detail.component.scss',
})
export class TemplateDetailComponent implements OnInit, OnDestroy {
  private readonly templates = inject(TemplateService);
  private readonly resourceCache = inject(ResourceCacheService);
  private readonly inventory = inject(InventoryService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly templateId = input.required<string>();

  protected readonly hypervisor = signal<Hypervisor | null>(null);
  protected readonly template = signal<Template | null>(null);
  protected readonly versions = signal<TemplateVersion[]>([]);
  protected readonly error = signal<AppError | null>(null);
  protected readonly actionError = signal<AppError | null>(null);
  /** Une activation / désactivation est en cours (chargement du bouton). */
  protected readonly toggling = signal(false);

  /** L'onglet « Droits » est réservé aux administrateurs (l'API répond 403 sinon). */
  protected readonly onglets = computed(() => {
    const onglets: Tab<Onglet>[] = [
      { id: 'versions', label: 'Versions', icon: 'layers' },
      { id: 'config', label: 'Configuration', icon: 'code' },
    ];
    if (this.auth.isAdmin()) {
      onglets.push({ id: 'permissions', label: 'Droits', icon: 'shield' });
    }
    return onglets;
  });

  // Exposée au .html : la limite de VM de ce template est-elle atteinte (jamais pour un admin) ?
  protected readonly limitReached = templateLimitReached;

  /** L'utilisateur connecté gère-t-il ce template ? Sinon la page ne montre qu'un message. */
  protected readonly manages = computed(() => {
    const template = this.template();
    return template !== null && canManageTemplate(template);
  });
  protected readonly onglet = signal<Onglet>('versions');

  protected readonly building = computed(() => isBuilding(this.template()?.status));
  protected readonly stopping = computed(() => this.template()?.status === 'stopping');

  /**
   * La définition a-t-elle changé depuis la dernière version ? Si oui, on invite à reconstruire.
   * (La configuration de chaque version est une copie de la définition au moment de sa construction.)
   */
  protected readonly outdated = computed(() => {
    const template = this.template();
    const latest = template?.latest_version;
    if (!template || !latest) {
      return false;
    }
    return latest.packer_config !== template.packer_config || latest.disk_name !== template.disk_name || latest.pool !== template.pool;
  });

  /** La dernière version, si elle a raté : on affiche la raison sous la liste. */
  protected readonly latestFailure = computed(() => {
    const latest = this.versions()[0];
    return latest?.status === 'failed' && latest.error ? latest : null;
  });

  private pollSub?: Subscription;

  ngOnInit(): void {
    this.resourceCache.resolve('hypervisor', this.id()).subscribe({
      next: (hypervisor) => this.hypervisor.set(hypervisor),
      error: () => undefined, // Le nom n'est qu'un détail d'affichage.
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  /** Recharge le template et ses versions ; relance un rechargement dans 3 s si une construction tourne. */
  protected load(): void {
    this.pollSub?.unsubscribe();
    forkJoin({
      template: this.templates.get(this.id(), this.templateId()),
      versions: this.templates.listVersions(this.id(), this.templateId()),
    }).subscribe({
      next: ({ template, versions }) => {
        this.error.set(null);
        this.template.set(template);
        this.versions.set(versions);
        if (isBuilding(template.status)) {
          this.pollSub = timer(3000).subscribe(() => this.load());
        }
      },
      error: (error: AppError) => this.error.set(error),
    });
  }

  /** « Administrateur », « Gestionnaire · 1/3 VM »… : le droit de l'utilisateur connecté. */
  protected accessLabel(template: Template): string {
    const { level, max_vms, vm_count } = template.access;
    if (level === 'admin') {
      return 'Administrateur';
    }
    const role = level === 'manage' ? 'Gestionnaire' : 'Utilisateur';
    return max_vms === null ? role : `${role} · ${vm_count}/${max_vms} VM`;
  }

  protected date(seconds: number | null | undefined): string {
    return seconds ? new Date(seconds * 1000).toLocaleString('fr-FR') : '—';
  }

  /** Le sous-titre d'une ligne de version : sa taille et ses dates. */
  protected versionSubtitle(version: TemplateVersion): string {
    const parts = [`Lancée le ${this.date(version.created_at)}`];
    if (version.finished_at) {
      parts.push(`terminée le ${this.date(version.finished_at)}`);
    }
    if (version.disk_size_gb) {
      parts.push(`${version.disk_size_gb} Go`);
    }
    return parts.join(' · ');
  }

  protected isBuilding(version: TemplateVersion): boolean {
    return isBuilding(version.status);
  }

  // ---------- actions sur le template ----------

  /** Activer ou désactiver (PATCH allow_vm_creation), sans confirmation : c'est réversible. */
  protected toggle(template: Template): void {
    this.toggling.set(true);
    this.actionError.set(null);
    this.templates.update(this.id(), template.id, { allow_vm_creation: !template.allow_vm_creation }).subscribe({
      next: (updated) => {
        this.template.set(updated);
        this.toggling.set(false);
      },
      error: (error: AppError) => {
        this.actionError.set(error);
        this.toggling.set(false);
      },
    });
  }

  protected rebuild(template: Template): void {
    const next = (template.latest_version?.version ?? 0) + 1;
    this.confirm(
      `Reconstruire « ${template.name} » ?`,
      `La version ${next} sera construite à partir de la définition actuelle (3 à 10 minutes). En attendant, les VM continuent d'être créées à partir de la dernière version prête.`,
      'Reconstruire',
      () => this.templates.rebuild(this.id(), template.id),
    );
  }

  /** Arrêt propre (Packer fait le ménage), ou forcé si un arrêt est déjà en cours. */
  protected stop(template: Template): void {
    const force = this.stopping();
    this.confirm(
      force ? 'Forcer l’arrêt de la construction ?' : 'Arrêter la construction ?',
      force
        ? 'La construction sera tuée tout de suite : Packer ne pourra pas faire le ménage (une VM temporaire ou des fichiers peuvent rester sur la machine qui construit).'
        : 'Packer interrompt la construction et fait le ménage (deux minutes au plus). La version finira « Annulée ».',
      force ? 'Forcer l’arrêt' : 'Arrêter',
      () => this.templates.stop(this.id(), template.id, force),
      true,
    );
  }

  protected edit(template: Template): void {
    this.modal
      .open<TemplateFormModalComponent, Template>(TemplateFormModalComponent, {
        size: 'lg',
        inputs: { hypervisorId: this.id(), hypervisorName: this.hypervisor()?.name ?? '', template },
      })
      .afterClosed$.subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  protected remove(template: Template): void {
    this.modal
      .open<TemplateDeleteModalComponent, boolean>(TemplateDeleteModalComponent, {
        size: 'sm',
        inputs: { hypervisorId: this.id(), template },
      })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.router.navigate(['/hypervisors', this.id()]);
        }
      });
  }

  // ---------- actions sur une version ----------

  protected logs(template: Template, version: TemplateVersion): void {
    this.modal
      .open<TemplateLogModalComponent, void>(TemplateLogModalComponent, {
        size: 'lg',
        inputs: { hypervisorId: this.id(), templateId: template.id, templateName: template.name, version: version.version },
      })
      .afterClosed$.subscribe(() => this.load());
  }

  /** Créer une VM : sans version précise, la modale propose la dernière version prête. */
  protected createVm(template: Template, version?: TemplateVersion): void {
    this.modal
      .open<TemplateVmModalComponent, VirtualMachine>(TemplateVmModalComponent, {
        inputs: { hypervisorId: this.id(), template, version: version?.version ?? null },
      })
      .afterClosed$.subscribe((vm) => {
        if (vm) {
          this.inventory.refresh();
          this.router.navigate(['/hypervisors', this.id(), 'vms', vm.id]);
        }
      });
  }

  protected removeVersion(template: Template, version: TemplateVersion): void {
    this.confirm(
      `Supprimer la version ${version.version} ?`,
      `Son disque (${version.volume}) sera supprimé. Les VM déjà créées à partir d'elle gardent leur propre copie.`,
      'Supprimer',
      () => this.templates.deleteVersion(this.id(), template.id, version.version),
      true,
    );
  }

  /** Une confirmation qui exécute l'action elle-même, puis recharge la page si elle a réussi. */
  private confirm(title: string, message: string, confirmLabel: string, action: () => Observable<unknown>, danger = false): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: { title, message, confirmLabel, danger, action },
      })
      .afterClosed$.subscribe((done) => {
        if (done) {
          this.load();
        }
      });
  }
}
