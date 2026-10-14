import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { NumberFieldComponent } from '@app/components/ui/number-field/number-field.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { VmOptions } from '@app/models/vm-options.model';
import { CreateVm, VirtualMachine, VolumeRef } from '@app/models/virtual-machine.model';
import { ModalRef } from '@app/services/modal-ref';
import { VmService } from '@app/services/vm.service';

type Preset = 'small' | 'medium' | 'large';

/** Les caractéristiques de chaque gabarit. */
const PRESETS: Record<Preset, { vcpus: number; memory_mb: number }> = {
  small: { vcpus: 1, memory_mb: 1024 },
  medium: { vcpus: 2, memory_mb: 4096 },
  large: { vcpus: 4, memory_mb: 8192 },
};

/**
 * Créer une VM : un nom, un gabarit, un disque, un réseau et un firmware.
 * Les choix (pools, réseaux, limites) viennent de l'API (`vm-options`) :
 * la modale les charge à son ouverture.
 */
@Component({
  selector: 'app-vm-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, TextFieldComponent, TextComponent, ButtonComponent, ChoiceCardsComponent, NumberFieldComponent],
  templateUrl: './vm-form-modal.component.html',
  styleUrl: './vm-form-modal.component.scss',
})
export class VmFormModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<VirtualMachine>);
  private readonly vms = inject(VmService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  /** Les choix proposés par l'API ; null tant qu'ils ne sont pas chargés. */
  protected readonly options = signal<VmOptions | null>(null);

  protected readonly name = signal('');
  protected readonly vcpus = signal(PRESETS.medium.vcpus);
  protected readonly memoryMb = signal(PRESETS.medium.memory_mb);
  protected readonly pool = signal<string | undefined>(undefined);
  protected readonly diskGb = signal('20');
  protected readonly network = signal<string | undefined>(undefined);
  protected readonly firmware = signal<string | undefined>(undefined);
  /** L'ISO choisie, sous la forme « pool/volume » ; '' = aucune. */
  protected readonly iso = signal('');
  protected readonly start = signal(false);

  /** Le gabarit qui correspond aux valeurs actuelles ; aucun si on les a modifiées à la main. */
  protected readonly preset = computed<Preset | undefined>(
    () => (Object.keys(PRESETS) as Preset[]).find((key) => PRESETS[key].vcpus === this.vcpus() && PRESETS[key].memory_mb === this.memoryMb()),
  );
  protected readonly presets: Choice<Preset>[] = [
    { value: 'small', label: 'Petite', description: '1 vCPU · 1 Go' },
    { value: 'medium', label: 'Moyenne', description: '2 vCPU · 4 Go' },
    { value: 'large', label: 'Grande', description: '4 vCPU · 8 Go' },
  ];
  protected readonly startChoices: Choice<boolean>[] = [
    { value: false, label: 'Non', description: 'La VM reste arrêtée' },
    { value: true, label: 'Oui', description: 'Démarrer tout de suite' },
  ];

  protected readonly pools = computed<Choice<string>[]>(() =>
    (this.options()?.storage_pools ?? []).map((pool) => ({ value: pool.name, label: pool.name, description: `${pool.available_gb} Go libres` })),
  );
  protected readonly networks = computed<Choice<string>[]>(() =>
    (this.options()?.networks ?? []).map((network) => ({ value: network.name, label: network.name, description: network.bridge })),
  );
  /** « Aucune » puis toutes les ISO de tous les pools. */
  protected readonly isos = computed<Choice<string>[]>(() => [
    { value: '', label: 'Aucune', description: 'Disque vide' },
    ...(this.options()?.storage_pools ?? []).flatMap((pool) =>
      pool.volumes
        .filter((volume) => volume.kind === 'iso')
        .map((volume) => ({ value: `${pool.name}/${volume.name}`, label: volume.name, description: pool.name })),
    ),
  ]);
  protected readonly firmwares = computed<Choice<string>[]>(() =>
    (this.options()?.firmware ?? []).map((firmware) => ({ value: firmware, label: firmware.toUpperCase() })),
  );

  /** Choisir un gabarit remplit simplement les deux champs ci-dessous. */
  protected applyPreset(preset: Preset | undefined): void {
    if (preset) {
      this.vcpus.set(PRESETS[preset].vcpus);
      this.memoryMb.set(PRESETS[preset].memory_mb);
    }
  }

  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && !/^[a-zA-Z0-9-]+$/.test(this.name()) ? 'Lettres, chiffres et tirets uniquement.' : null,
  );
  protected readonly diskError = computed(() => {
    const limits = this.options()?.limits.disk_gb;
    const size = Number(this.diskGb());
    if (!this.submitted() || !limits) {
      return null;
    }
    return Number.isInteger(size) && size >= limits.min && size <= limits.max ? null : `Entre ${limits.min} et ${limits.max} Go.`;
  });
  protected readonly resourcesError = computed(() => {
    const limits = this.options()?.limits;
    const vcpus = this.vcpus();
    const memory = this.memoryMb();
    if (!limits) {
      return null;
    }
    const vcpusOk = Number.isInteger(vcpus) && vcpus >= limits.vcpus.min && vcpus <= limits.vcpus.max;
    const memoryOk = Number.isInteger(memory) && memory >= limits.memory_mb.min && memory <= limits.memory_mb.max;
    return vcpusOk && memoryOk ? null : 'Les vCPU ou la mémoire sont hors des limites.';
  });
  protected readonly poolError = computed(() => (this.submitted() && !this.pool() ? 'Aucun pool de stockage disponible.' : null));

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<VirtualMachine | null>(null);
  protected readonly loadingLabel = signal('Chargement des options…');

  ngOnInit(): void {
    this.loadOptions();
  }

  protected loadOptions(): void {
    this.loadingLabel.set('Chargement des options…');
    this.state.set('loading');
    this.vms.options(this.hypervisorId()).subscribe({
      next: (options) => {
        this.options.set(options);
        // On pré-remplit avec les valeurs par défaut proposées par l'API.
        this.vcpus.set(options.defaults.vcpus);
        this.memoryMb.set(options.defaults.memory_mb);
        this.pool.set(options.storage_pools[0]?.name);
        this.diskGb.set(String(options.defaults.disk_gb));
        this.network.set(options.networks.find((n) => n.name === options.defaults.network)?.name ?? options.networks[0]?.name);
        this.firmware.set(options.defaults.firmware);
        this.state.set('form');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** « Réessayer » : recharger les options si elles manquent, sinon revenir au formulaire. */
  protected retry(): void {
    if (this.options()) {
      this.state.set('form');
    } else {
      this.loadOptions();
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    const options = this.options();
    const pool = this.pool();
    if (!options || !pool || this.nameError() || this.diskError() || this.resourcesError()) {
      return;
    }
    const iso = this.selectedIso();
    const body: CreateVm = {
      name: this.name(),
      memory_mb: this.memoryMb(),
      vcpus: this.vcpus(),
      disks: [{ pool, size_gb: Number(this.diskGb()) }],
      network: this.network(),
      firmware: this.firmware(),
      start: this.start(),
      ...(iso ? { iso } : {}),
    };

    this.loadingLabel.set('Création de la VM…');
    this.state.set('loading');
    this.vms.create(this.hypervisorId(), body).subscribe({
      next: (vm) => {
        this.result.set(vm);
        this.state.set('success');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Retrouve le pool et le volume de l'ISO choisie (le nom du pool peut contenir « / »). */
  private selectedIso(): VolumeRef | null {
    const key = this.iso();
    for (const pool of this.options()?.storage_pools ?? []) {
      const prefix = `${pool.name}/`;
      if (key.startsWith(prefix) && pool.volumes.some((v) => v.kind === 'iso' && v.name === key.slice(prefix.length))) {
        return { pool: pool.name, volume: key.slice(prefix.length) };
      }
    }
    return null;
  }

  private fail(error: unknown): void {
    this.error.set(isAppError(error) ? error : null);
    this.state.set('error');
  }
}
