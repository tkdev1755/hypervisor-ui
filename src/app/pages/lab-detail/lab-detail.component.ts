import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { CardComponent } from '@app/components/layout/card/card.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { LabDefinitionComponent } from '@app/components/lab-definition/lab-definition.component';
import { LabFormModalComponent } from '@app/components/lab-form-modal/lab-form-modal.component';
import { LabInstanceListComponent } from '@app/components/lab-instance-list/lab-instance-list.component';
import { LabInstanceModalComponent } from '@app/components/lab-instance-modal/lab-instance-modal.component';
import { LabPermissionListComponent } from '@app/components/lab-permission-list/lab-permission-list.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { Tab, TabsComponent } from '@app/components/ui/tabs/tabs.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { LabDetail, LabInstance, canManageLab, labLimitReached } from '@app/models/lab.model';
import { AuthService } from '@app/services/auth.service';
import { ContextBridgeService } from '@app/services/context-bridge.service';
import { LabService } from '@app/services/lab.service';
import { ModalService } from '@app/services/modal.service';

type Onglet = 'instances' | 'definition' | 'permissions';

/**
 * La page d'un labo, à l'adresse /hypervisors/:id/labs/:labId, pour tous ceux qui ont un droit dessus.
 * Ce qu'on peut y faire dépend de `lab.access.level` :
 *
 *  - Instances : les miennes (toutes pour un gestionnaire), avec Démarrer, Arrêter, Supprimer.
 *  - Définition : les réseaux et les VM du labo ; modifiables par ceux qui le gèrent.
 *  - Droits (admin seulement) : les utilisateurs et groupes qui peuvent le déployer ou le gérer.
 *
 * En haut : Déployer (dans la limite d'instances), Modifier (gestionnaire), Supprimer (admin, une fois
 * toutes les instances supprimées). Pas de garde sur la route : le droit dépend du labo, l'API fait respecter.
 */
@Component({
  selector: 'app-lab-detail',
  imports: [
    PageComponent,
    ColumnComponent,
    GridComponent,
    CardComponent,
    TextComponent,
    ButtonComponent,
    CalloutComponent,
    TabsComponent,
    LoadingComponent,
    ErrorPanelComponent,
    LabInstanceListComponent,
    LabDefinitionComponent,
    LabPermissionListComponent,
  ],
  templateUrl: './lab-detail.component.html',
  styleUrl: './lab-detail.component.scss',
})
export class LabDetailComponent implements OnInit {
  private readonly labs = inject(LabService);
  private readonly bridge = inject(ContextBridgeService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly labId = input.required<string>();

  protected readonly hypervisor = signal<Hypervisor | null>(null);
  protected readonly lab = signal<LabDetail | null>(null);
  protected readonly error = signal<AppError | null>(null);

  /** L'onglet « Droits » est réservé aux administrateurs (l'API répond 403 sinon). */
  protected readonly onglets = computed(() => {
    const onglets: Tab<Onglet>[] = [
      { id: 'instances', label: 'Instances', icon: 'flask' },
      { id: 'definition', label: 'Définition', icon: 'network' },
    ];
    if (this.auth.isAdmin()) {
      onglets.push({ id: 'permissions', label: 'Droits', icon: 'shield' });
    }
    return onglets;
  });
  protected readonly onglet = signal<Onglet>('instances');

  protected readonly manages = computed(() => {
    const lab = this.lab();
    return lab !== null && canManageLab(lab);
  });
  // Exposée au .html : la limite d'instances est-elle atteinte (jamais pour un admin) ?
  protected readonly limitReached = labLimitReached;
  protected readonly routers = computed(() => this.lab()?.vms.filter((vm) => vm.role === 'router').length ?? 0);

  ngOnInit(): void {
    this.bridge.resolve('hypervisor', this.id()).subscribe({
      next: (hypervisor) => this.hypervisor.set(hypervisor),
      error: () => undefined, // Le nom n'est qu'un détail d'affichage.
    });
    this.load();
  }

  protected load(): void {
    this.labs.get(this.id(), this.labId()).subscribe({
      next: (lab) => {
        this.error.set(null);
        this.lab.set(lab);
      },
      error: (error: AppError) => this.error.set(error),
    });
  }

  /** « Administrateur », « Gestionnaire · 1/3 instances »… : le droit de l'utilisateur connecté. */
  protected accessLabel(lab: LabDetail): string {
    const { level, max_instances, instance_count } = lab.access;
    if (level === 'admin') {
      return 'Administrateur';
    }
    const role = level === 'manage' ? 'Gestionnaire' : 'Utilisateur';
    return max_instances === null ? role : `${role} · ${instance_count}/${max_instances} instances`;
  }

  protected deploy(lab: LabDetail): void {
    this.modal
      .open<LabInstanceModalComponent, LabInstance>(LabInstanceModalComponent, {
        inputs: { hypervisorId: this.id(), lab },
      })
      .afterClosed$.subscribe((instance) => {
        if (instance) {
          this.router.navigate(['/hypervisors', this.id(), 'labs', lab.id, 'instances', instance.id]);
        }
      });
  }

  protected edit(lab: LabDetail): void {
    this.modal
      .open<LabFormModalComponent, LabDetail>(LabFormModalComponent, {
        inputs: { hypervisorId: this.id(), hypervisorName: this.hypervisor()?.name ?? '', lab },
      })
      .afterClosed$.subscribe((saved) => {
        if (saved) {
          this.lab.set(saved);
        }
      });
  }

  protected remove(lab: LabDetail): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Supprimer le labo « ${lab.name} » ?`,
          message: 'Sa définition (réseaux, VM, droits) sera supprimée. L’API refuse tant qu’il a des instances : supprimez-les d’abord.',
          confirmLabel: 'Supprimer',
          danger: true,
          action: () => this.labs.delete(this.id(), lab.id),
        },
      })
      .afterClosed$.subscribe((done) => {
        if (done) {
          this.router.navigate(['/hypervisors', this.id()]);
        }
      });
  }
}
