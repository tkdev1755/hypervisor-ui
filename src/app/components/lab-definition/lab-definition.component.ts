import { Component, computed, inject, input, output } from '@angular/core';
import { Observable } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { LabNetworkModalComponent } from '@app/components/lab-network-modal/lab-network-modal.component';
import { LabVmModalComponent } from '@app/components/lab-vm-modal/lab-vm-modal.component';
import { ConfirmModalComponent } from '@app/components/modal/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state/empty-state.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { LabDetail, LabNetwork, LabVm, canManageLab } from '@app/models/lab.model';
import { LabService } from '@app/services/lab.service';
import { ModalService } from '@app/services/modal.service';

/**
 * L'onglet « Définition » d'un labo : ses réseaux et ses VM (routeurs d'abord, comme l'API les renvoie).
 *
 * Tout le monde le voit en lecture ; ceux qui gèrent le labo (droit 'manage', ou admin) peuvent ajouter
 * et retirer des réseaux, ajouter, modifier et retirer des VM. Les instances déjà déployées ne changent pas :
 * la définition ne sert qu'aux prochains déploiements. L'API refuse (409) de retirer un réseau branché
 * sur une VM du labo, ou un élément qu'une instance utilise encore.
 *
 * Émet `changed` après chaque modification réussie : la page recharge alors le labo.
 */
@Component({
  selector: 'app-lab-definition',
  imports: [ColumnComponent, RowComponent, SpacerComponent, TextComponent, ButtonComponent, ListComponent, ListTileComponent, EmptyStateComponent],
  templateUrl: './lab-definition.component.html',
  styleUrl: './lab-definition.component.scss',
})
export class LabDefinitionComponent {
  private readonly labs = inject(LabService);
  private readonly modal = inject(ModalService);

  readonly hypervisorId = input.required<string>();
  readonly lab = input.required<LabDetail>();
  readonly changed = output<void>();

  protected readonly manages = computed(() => canManageLab(this.lab()));

  /** « Externe · default » ou « Interne · isolé ». */
  protected networkSubtitle(network: LabNetwork): string {
    return network.kind === 'external'
      ? `Externe · réseau ${network.libvirt_network} de l'hyperviseur, partagé par les instances`
      : 'Interne · isolé, créé pour chaque instance';
  }

  /** « Routeur · debian-12 (dernière version) · 2 vCPU · 2048 Mo · BIOS ». */
  protected vmSubtitle(vm: LabVm): string {
    const role = vm.role === 'router' ? 'Routeur' : 'VM';
    const version = vm.version === null ? 'dernière version' : `v${vm.version}`;
    return `${role} · ${vm.template_name} (${version}) · ${vm.vcpus} vCPU · ${vm.memory_mb} Mo · ${vm.firmware.toUpperCase()}`;
  }

  /** « Cartes : wan → lan1 » : les réseaux de ses cartes, dans l'ordre. */
  protected vmNics(vm: LabVm): string {
    if (vm.networks.length === 0) {
      return 'Aucune carte réseau';
    }
    const names = vm.networks.map((id) => this.lab().networks.find((n) => n.id === id)?.name ?? '?');
    return `Cartes : ${names.join(' → ')}`;
  }

  protected addNetwork(): void {
    this.modal
      .open<LabNetworkModalComponent, LabNetwork>(LabNetworkModalComponent, {
        inputs: { hypervisorId: this.hypervisorId(), labId: this.lab().id },
      })
      .afterClosed$.subscribe((network) => {
        if (network) {
          this.changed.emit();
        }
      });
  }

  protected removeNetwork(network: LabNetwork): void {
    this.confirm(
      `Retirer le réseau « ${network.name} » ?`,
      'Il ne sera plus créé dans les prochaines instances. Retirez-le d’abord des cartes réseau des VM qui l’utilisent.',
      () => this.labs.removeNetwork(this.hypervisorId(), this.lab().id, network.id),
    );
  }

  /** Sans `vm` : ajouter une VM ; avec : la modifier. */
  protected editVm(vm: LabVm | null = null): void {
    this.modal
      .open<LabVmModalComponent, LabVm>(LabVmModalComponent, {
        size: 'lg',
        inputs: { hypervisorId: this.hypervisorId(), lab: this.lab(), vm },
      })
      .afterClosed$.subscribe((saved) => {
        if (saved) {
          this.changed.emit();
        }
      });
  }

  protected removeVm(vm: LabVm): void {
    this.confirm(
      `Retirer la VM « ${vm.name} » du labo ?`,
      'Elle ne sera plus créée dans les prochaines instances. L’API refuse tant qu’une instance l’a encore.',
      () => this.labs.removeVm(this.hypervisorId(), this.lab().id, vm.id),
    );
  }

  private confirm(title: string, message: string, action: () => Observable<unknown>): void {
    this.modal
      .open<ConfirmModalComponent, boolean>(ConfirmModalComponent, {
        size: 'sm',
        inputs: { title, message, confirmLabel: 'Retirer', danger: true, action },
      })
      .afterClosed$.subscribe((done) => {
        if (done) {
          this.changed.emit();
        }
      });
  }
}
