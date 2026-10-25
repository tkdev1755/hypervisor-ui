import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { LabNetwork, LabNetworkKind } from '@app/models/lab.model';
import { LabService } from '@app/services/lab.service';
import { ModalRef } from '@app/services/modal-ref';
import { VmService } from '@app/services/vm.service';

/** Même règle que l'API pour le nom d'un réseau de labo (il entre dans le nom du réseau libvirt). */
const NETWORK_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;

/**
 * Ajouter un réseau à un labo (droit 'manage') :
 *
 * - 'internal' : un réseau isolé, créé pour chaque instance (lab-<instance>-<nom>). C'est le cas le
 *   plus courant : le LAN derrière un routeur.
 * - 'external' : un réseau libvirt qui existe déjà sur l'hyperviseur (NAT ou bridge vers Internet,
 *   par exemple `default`), partagé par toutes les instances. La liste vient de `vm-options` ; sans
 *   accès à l'hyperviseur (403), on tape son nom à la main.
 *
 * Un réseau ne se modifie pas : on le retire puis on l'ajoute de nouveau. Se ferme avec le réseau créé.
 */
@Component({
  selector: 'app-lab-network-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, TextComponent, ButtonComponent, ChoiceCardsComponent],
  templateUrl: './lab-network-modal.component.html',
  styleUrl: './lab-network-modal.component.scss',
})
export class LabNetworkModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<LabNetwork>);
  private readonly labs = inject(LabService);
  private readonly vms = inject(VmService);

  readonly hypervisorId = input.required<string>();
  readonly labId = input.required<string>();

  protected readonly name = signal('');
  protected readonly kind = signal<LabNetworkKind>('internal');
  /** Le réseau libvirt choisi dans la liste (réseau externe). */
  protected readonly libvirtChoice = signal<string | undefined>(undefined);
  /** Le réseau libvirt tapé à la main, quand la liste n'a pas pu être chargée. */
  protected readonly libvirtTyped = signal('default');

  protected readonly kindChoices: Choice<LabNetworkKind>[] = [
    { value: 'internal', label: 'Interne', description: 'Isolé, créé pour chaque instance' },
    { value: 'external', label: 'Externe', description: "Un réseau existant de l'hyperviseur (Internet)" },
  ];

  /** Les réseaux libvirt de l'hyperviseur ; null si `vm-options` a refusé (on tape alors le nom). */
  protected readonly libvirtNetworks = signal<Choice<string>[] | null>(null);

  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && !NETWORK_NAME_PATTERN.test(this.name().trim())
      ? 'De 1 à 32 caractères : lettres, chiffres, « - » ou « _ ».'
      : null,
  );
  /** Le réseau libvirt envoyé pour un réseau externe. */
  private readonly libvirtNetwork = computed(() => (this.libvirtNetworks() ? this.libvirtChoice() : this.libvirtTyped().trim()) ?? '');
  protected readonly libvirtError = computed(() =>
    this.submitted() && this.kind() === 'external' && !this.libvirtNetwork() ? "Choisissez le réseau de l'hyperviseur." : null,
  );

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<LabNetwork | null>(null);

  ngOnInit(): void {
    this.vms.options(this.hypervisorId()).subscribe({
      next: (options) => {
        this.libvirtNetworks.set(options.networks.map((n) => ({ value: n.name, label: n.name, description: n.bridge ?? undefined })));
        this.libvirtChoice.set(options.networks.find((n) => n.name === options.defaults.network)?.name ?? options.networks[0]?.name);
        this.state.set('form');
      },
      // Sans accès à l'hyperviseur : pas de liste, le nom se tape à la main.
      error: () => this.state.set('form'),
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError() || this.libvirtError()) {
      return;
    }
    const kind = this.kind();
    this.state.set('loading');
    this.labs
      .addNetwork(this.hypervisorId(), this.labId(), {
        name: this.name().trim(),
        kind,
        ...(kind === 'external' ? { libvirt_network: this.libvirtNetwork() } : {}),
      })
      .subscribe({
        next: (network) => {
          this.result.set(network);
          this.state.set('success');
        },
        error: (error: unknown) => {
          this.error.set(isAppError(error) ? error : null);
          this.state.set('error');
        },
      });
  }
}
