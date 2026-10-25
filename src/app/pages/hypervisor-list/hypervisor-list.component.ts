import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { HypervisorFormModalComponent } from '@app/components/hypervisor-form-modal/hypervisor-form-modal.component';
import { GridComponent } from '@app/components/layout/grid/grid.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { ResourceCardComponent } from '@app/components/ui/resource-card/resource-card.component';
import { AppError } from '@app/models/app-error.model';
import { Hypervisor } from '@app/models/hypervisor.model';
import { AuthService } from '@app/services/auth.service';
import { ResourceCacheService } from '@app/services/resource-cache.service';
import { HypervisorService } from '@app/services/hypervisor.service';
import { InventoryService } from '@app/services/inventory.service';
import { ModalService } from '@app/services/modal.service';

/**
 * La liste des hyperviseurs : l'exemple complet d'une page qui charge des
 * données, avec ses trois états (chargement, erreur, liste ou liste vide).
 */
@Component({
  selector: 'app-hypervisor-list',
  imports: [PageComponent, GridComponent, ResourceCardComponent, ButtonComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent],
  templateUrl: './hypervisor-list.component.html',
  styleUrl: './hypervisor-list.component.scss',
})
export class HypervisorListComponent implements OnInit {
  // Les services dont la page a besoin, obtenus par injection.
  private readonly hypervisorService = inject(HypervisorService);
  private readonly modal = inject(ModalService);
  private readonly resourceCache = inject(ResourceCacheService);
  private readonly router = inject(Router);
  private readonly inventory = inject(InventoryService);
  /** Seul un administrateur ajoute, modifie ou supprime un hyperviseur. */
  protected readonly auth = inject(AuthService);

  // L'état de la page, sous forme de signals.
  protected readonly hypervisors = signal<Hypervisor[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  /** ngOnInit est appelée une fois, quand la page s'affiche : on charge les données. */
  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.hypervisorService.list().subscribe({
      next: (list) => {
        this.hypervisors.set(list);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  /** On range l'hyperviseur dans le ResourceCache, puis on navigue avec son seul id. */
  protected open(hypervisor: Hypervisor): void {
    this.resourceCache.prime('hypervisor', hypervisor.id, hypervisor);
    this.router.navigate(['/hypervisors', hypervisor.id]);
  }

  protected add(): void {
    this.modal
      .open<HypervisorFormModalComponent, Hypervisor>(HypervisorFormModalComponent)
      .afterClosed$.subscribe((created) => {
        if (created) {
          this.load();
          this.inventory.refresh();
        }
      });
  }

  protected edit(hypervisor: Hypervisor): void {
    this.modal
      .open<HypervisorFormModalComponent, Hypervisor>(HypervisorFormModalComponent, { inputs: { hypervisor } })
      .afterClosed$.subscribe((updated) => {
        if (updated) {
          this.resourceCache.invalidate('hypervisor', hypervisor.id);
          this.load();
          this.inventory.refresh();
        }
      });
  }

  protected remove(hypervisor: Hypervisor): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: {
          title: `Supprimer « ${hypervisor.name} » ?`,
          message: "Seul son enregistrement est supprimé de l'API. L'hôte KVM et ses VM ne sont pas touchés.",
          confirmLabel: 'Supprimer',
          successMessage: 'Hyperviseur supprimé.',
          danger: true,
          action: () => this.hypervisorService.delete(hypervisor.id),
        },
      })
      .afterClosed$.subscribe((deleted) => {
        if (deleted) {
          this.resourceCache.invalidate('hypervisor', hypervisor.id);
          this.load();
          this.inventory.refresh();
        }
      });
  }
}
