import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { LoadingComponent } from '@app/components/ui/loading/loading.component';
import { AppError } from '@app/models/app-error.model';
import { MyLabInstance } from '@app/models/lab.model';
import { LabService } from '@app/services/lab.service';

/**
 * Toutes les instances de labos de l'utilisateur connecté, sur tous les hyperviseurs
 * (GET /api/me/lab-instances). Un clic ouvre la page de l'instance.
 *
 *   <app-my-lab-instance-list />
 */
@Component({
  selector: 'app-my-lab-instance-list',
  imports: [ListComponent, ListTileComponent, LoadingComponent, ErrorPanelComponent, EmptyStateComponent],
  templateUrl: './my-lab-instance-list.component.html',
  styleUrl: './my-lab-instance-list.component.scss',
})
export class MyLabInstanceListComponent implements OnInit {
  private readonly labs = inject(LabService);
  private readonly router = inject(Router);

  protected readonly list = signal<MyLabInstance[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<AppError | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.labs.myInstances().subscribe({
      next: (instances) => {
        this.list.set(instances);
        this.loading.set(false);
      },
      error: (error: AppError) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  protected subtitle(instance: MyLabInstance): string {
    return `Labo ${instance.lab_name} · créée le ${new Date(instance.created_at * 1000).toLocaleString('fr-FR')}`;
  }

  protected open(instance: MyLabInstance): void {
    this.router.navigate(['/hypervisors', instance.hypervisor_id, 'labs', instance.lab_id, 'instances', instance.id]);
  }
}
