import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { UserPickerComponent } from '@app/components/user-picker/user-picker.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { NumberFieldComponent } from '@app/components/ui/number-field/number-field.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { CreateVmFromTemplate, Template } from '@app/models/template.model';
import { VmOptions } from '@app/models/vm-options.model';
import { CreateVm, DiskSpec, VirtualMachine, VolumeRef } from '@app/models/virtual-machine.model';
import { AuthService } from '@app/services/auth.service';
import { JobService } from '@app/services/job.service';
import { ModalRef } from '@app/services/modal-ref';
import { TemplateService } from '@app/services/template.service';
import { VmService } from '@app/services/vm.service';
import { formatQuotaRow, quotaRows } from '@app/utils/quota';

type Preset = 'small' | 'medium' | 'large';
/**
 * D'où vient la VM :
 *   'blank'    → une VM vierge : on choisit son disque et, en général, une ISO d'installation
 *   'template' → une copie du disque d'un template prêt (système déjà installé)
 */
type Source = 'blank' | 'template';
/**
 * Comment le disque de la VM est fourni :
 *   'new'      → un nouveau volume, créé dans un pool
 *   'existing' → un volume libre déjà présent dans le pool
 *   'none'     → aucun disque : une ISO est alors obligatoire (Live CD)
 */
type DiskMode = 'new' | 'existing' | 'none';

/** Les caractéristiques de chaque gabarit. */
const PRESETS: Record<Preset, { vcpus: number; memory_mb: number }> = {
  small: { vcpus: 1, memory_mb: 1024 },
  medium: { vcpus: 2, memory_mb: 4096 },
  large: { vcpus: 4, memory_mb: 8192 },
};

/**
 * Créer une VM, vierge ou à partir d'un template.
 *
 * VM vierge : un nom, un gabarit, un disque (nouveau, existant ou aucun), une ISO facultative,
 * un réseau et un firmware. Les choix (pools, volumes, réseaux, limites) viennent de l'API (`vm-options`) :
 * la modale les charge à son ouverture. Un administrateur peut aussi désigner le propriétaire de la VM,
 * et le quota de l'utilisateur est rappelé en haut du formulaire.
 *
 * À partir d'un template : pas de disque ni d'ISO à choisir, la VM reçoit une copie du disque de
 * sa dernière version prête (pour choisir une autre version : l'onglet Templates). L'API répond alors avec une tâche (« job ») : la modale reste en chargement jusqu'à la
 * fin de la copie (comme le clonage). Le choix « Template » n'apparaît que s'il y a un template prêt.
 */
@Component({
  selector: 'app-vm-form-modal',
  imports: [
    ModalShellComponent,
    ColumnComponent,
    RowComponent,
    TextFieldComponent,
    TextComponent,
    ButtonComponent,
    ChoiceCardsComponent,
    NumberFieldComponent,
    UserPickerComponent,
    CalloutComponent,
  ],
  templateUrl: './vm-form-modal.component.html',
  styleUrl: './vm-form-modal.component.scss',
})
export class VmFormModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<VirtualMachine>);
  private readonly vms = inject(VmService);
  private readonly templateService = inject(TemplateService);
  private readonly jobs = inject(JobService);
  protected readonly auth = inject(AuthService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');

  /** Les choix proposés par l'API ; null tant qu'ils ne sont pas chargés. */
  protected readonly options = signal<VmOptions | null>(null);

  /** Les templates prêts de l'hyperviseur (vide s'il n'y en a pas, ou si leur chargement a échoué). */
  protected readonly templates = signal<Template[]>([]);
  protected readonly source = signal<Source>('blank');
  protected readonly templateId = signal<string | undefined>(undefined);

  protected readonly name = signal('');
  protected readonly vcpus = signal(PRESETS.medium.vcpus);
  protected readonly memoryMb = signal(PRESETS.medium.memory_mb);

  protected readonly diskMode = signal<DiskMode>('new');
  protected readonly pool = signal<string | undefined>(undefined);
  protected readonly diskGb = signal('20');
  protected readonly existingVolume = signal<string | undefined>(undefined);

  protected readonly network = signal<string | undefined>(undefined);
  protected readonly firmware = signal<string | undefined>(undefined);
  /** L'ISO choisie, sous la forme « pool/volume » ; '' = aucune. */
  protected readonly iso = signal('');
  protected readonly start = signal(false);
  /** Admin seulement : créer la VM pour un autre utilisateur (sans choix : pour soi). */
  protected readonly ownerId = signal<string | undefined>(undefined);

  /** Le quota de l'utilisateur, en une phrase (vide s'il n'a aucune limite). Voir GET /api/me. */
  protected readonly quotaSummary = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return quotaRows(user)
      .filter((row) => row.limit !== null)
      .map((row) => `${row.label} : ${formatQuotaRow(row)}`)
      .join(' · ');
  });

  /** Le gabarit qui correspond aux valeurs actuelles ; aucun si on les a modifiées à la main. */
  protected readonly preset = computed<Preset | undefined>(() => {
    const vcpus = this.vcpus();
    const mem = this.memoryMb();
    return (Object.keys(PRESETS) as Preset[]).find(
      (k) => PRESETS[k].vcpus === vcpus && PRESETS[k].memory_mb === mem,
    );
  });

  protected readonly presets: Choice<Preset>[] = [
    { value: 'small', label: 'Petite', description: '1 vCPU · 1 Go' },
    { value: 'medium', label: 'Moyenne', description: '2 vCPU · 4 Go' },
    { value: 'large', label: 'Grande', description: '4 vCPU · 8 Go' },
  ];

  protected readonly diskModeChoices: Choice<DiskMode>[] = [
    { value: 'new', label: 'Nouveau disque', description: 'Créer un volume qcow2' },
    { value: 'existing', label: 'Volume existant', description: 'Attacher un disque existant' },
    { value: 'none', label: 'Sans disque', description: 'Pour Live ISO uniquement' },
  ];

  protected readonly sourceChoices: Choice<Source>[] = [
    { value: 'blank', label: 'VM vierge', description: 'Disque et ISO au choix' },
    { value: 'template', label: 'Template', description: 'Système déjà installé' },
  ];

  protected readonly templateChoices = computed<Choice<string>[]>(() =>
    this.templates().map((t) => ({ value: t.id, label: t.name, description: `Version ${t.default_version} · pool ${t.pool}` })),
  );

  protected readonly selectedTemplate = computed(() => this.templates().find((t) => t.id === this.templateId()));

  protected readonly startChoices: Choice<boolean>[] = [
    { value: false, label: 'Non', description: 'La VM reste arrêtée' },
    { value: true, label: 'Oui', description: 'Démarrer tout de suite' },
  ];

  protected readonly pools = computed<Choice<string>[]>(() => {
    const rawPools = this.options()?.storage_pools ?? [];
    return rawPools.map((p) => ({
      value: p.name,
      label: p.name,
      description: `${p.available_gb} Go libres`,
    }));
  });

  protected readonly availableVolumes = computed<Choice<string>[]>(() => {
    const currentPool = this.pool();
    if (!currentPool) {
      return [];
    }
    const found = this.options()?.storage_pools.find((p) => p.name === currentPool);
    if (!found) {
      return [];
    }
    return found.volumes
      .filter((v) => v.kind === 'disk' && (!v.used_by || v.used_by.length === 0))
      .map((v) => ({
        value: v.name,
        label: v.name,
        description: `${Math.round(v.size_mb / 1024)} Go · ${v.format}`,
      }));
  });

  protected readonly networks = computed<Choice<string>[]>(() => {
    const rawNets = this.options()?.networks ?? [];
    return rawNets.map((n) => ({
      value: n.name,
      label: n.name,
      description: n.bridge,
    }));
  });

  protected readonly isos = computed<Choice<string>[]>(() => {
    const rawPools = this.options()?.storage_pools ?? [];
    const list: Choice<string>[] = [{ value: '', label: 'Aucune', description: 'Disque vide' }];
    for (const p of rawPools) {
      for (const v of p.volumes) {
        if (v.kind === 'iso') {
          list.push({
            value: `${p.name}/${v.name}`,
            label: v.name,
            description: p.name,
          });
        }
      }
    }
    return list;
  });

  protected readonly firmwares = computed<Choice<string>[]>(() => {
    const rawFw = this.options()?.firmware ?? [];
    return rawFw.map((f) => ({
      value: f,
      label: f.toUpperCase(),
    }));
  });

  /** Choisir un gabarit remplit simplement les champs vCPU et mémoire. */
  protected applyPreset(preset: Preset | undefined): void {
    if (preset) {
      this.vcpus.set(PRESETS[preset].vcpus);
      this.memoryMb.set(PRESETS[preset].memory_mb);
    }
  }

  protected readonly submitted = signal(false);

  protected readonly nameError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    return !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,63}$/.test(this.name())
      ? 'De 1 à 64 caractères : lettres, chiffres, tirets, underscores ou points (pas de point au début).'
      : null;
  });

  protected readonly templateError = computed(() =>
    this.submitted() && this.source() === 'template' && !this.selectedTemplate() ? 'Choisissez un template.' : null,
  );

  protected readonly diskError = computed(() => {
    if (!this.submitted() || this.source() === 'template') {
      return null;
    }
    const mode = this.diskMode();
    if (mode === 'new') {
      const limits = this.options()?.limits.disk_gb;
      const size = Number(this.diskGb());
      if (!limits) {
        return null;
      }
      return Number.isInteger(size) && size >= limits.min && size <= limits.max
        ? null
        : `Entre ${limits.min} et ${limits.max} Go.`;
    }
    if (mode === 'existing') {
      return !this.existingVolume() ? 'Veuillez sélectionner un volume existant.' : null;
    }
    if (mode === 'none') {
      return !this.iso() ? 'Une ISO est obligatoire si aucun disque n’est attaché.' : null;
    }
    return null;
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

  protected readonly poolError = computed(() => {
    if (this.submitted() && this.source() === 'blank' && this.diskMode() !== 'none' && !this.pool()) {
      return 'Aucun pool de stockage disponible.';
    }
    return null;
  });

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<VirtualMachine | null>(null);
  protected readonly loadingLabel = signal('Chargement des options…');

  ngOnInit(): void {
    this.auth.refreshUsage(); // La consommation affichée doit être à jour.
    this.loadOptions();
  }

  protected loadOptions(): void {
    this.loadingLabel.set('Chargement des options…');
    this.state.set('loading');
    // Les options et les templates en parallèle ; sans templates (erreur), on propose seulement une VM vierge.
    forkJoin({
      options: this.vms.options(this.hypervisorId()),
      templates: this.templateService.list(this.hypervisorId()).pipe(catchError(() => of([] as Template[]))),
    }).subscribe({
      next: ({ options, templates }) => {
        // Un template est utilisable s'il est activé et a une version prête (même si une reconstruction est en cours).
        const ready = templates.filter((t) => t.allow_vm_creation && t.default_version !== null && t.default_version !== undefined);
        this.templates.set(ready);
        this.templateId.set(ready[0]?.id);
        this.options.set(options);
        this.vcpus.set(options.defaults.vcpus);
        this.memoryMb.set(options.defaults.memory_mb);
        this.pool.set(options.storage_pools[0]?.name);
        this.diskGb.set(String(options.defaults.disk_gb));
        const defaultNet = options.networks.find((n) => n.name === options.defaults.network)?.name;
        this.network.set(defaultNet ?? options.networks[0]?.name);
        this.firmware.set(options.defaults.firmware);
        this.state.set('form');
      },
      error: (error: unknown) => {
        this.fail(error);
      },
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
    const mode = this.diskMode();
    const pool = this.pool();

    if (
      !options ||
      this.nameError() ||
      this.diskError() ||
      this.resourcesError() ||
      this.poolError() ||
      this.templateError()
    ) {
      return;
    }

    if (this.source() === 'template') {
      this.submitFromTemplate();
      return;
    }

    const disks: DiskSpec[] = [];
    if (mode === 'new' && pool) {
      disks.push({ pool, size_gb: Number(this.diskGb()) });
    } else if (mode === 'existing' && pool && this.existingVolume()) {
      disks.push({ pool, volume: this.existingVolume() });
    }

    const iso = this.selectedIso();
    const body: CreateVm = {
      name: this.name().trim(),
      memory_mb: this.memoryMb(),
      vcpus: this.vcpus(),
      disks,
      network: this.network(),
      firmware: this.firmware(),
      start: this.start(),
      ...(iso ? { iso } : {}),
      ...(this.auth.isAdmin() && this.ownerId() ? { owner_id: this.ownerId() } : {}),
    };

    this.loadingLabel.set('Création de la VM…');
    this.state.set('loading');
    this.vms.create(this.hypervisorId(), body).subscribe({
      next: (vm) => {
        this.result.set(vm);
        this.state.set('success');
      },
      error: (error: unknown) => {
        this.fail(error);
      },
    });
  }

  /** La VM est créée à partir du template choisi : l'API copie son disque dans une tâche de fond. */
  private submitFromTemplate(): void {
    const template = this.selectedTemplate();
    if (!template) {
      return;
    }
    const body: CreateVmFromTemplate = {
      name: this.name().trim(),
      memory_mb: this.memoryMb(),
      vcpus: this.vcpus(),
      network: this.network(),
      firmware: this.firmware(),
      start: this.start(),
      ...(this.auth.isAdmin() && this.ownerId() ? { owner_id: this.ownerId() } : {}),
    };
    this.loadingLabel.set('Copie du disque du template, cela peut prendre quelques minutes…');
    this.state.set('loading');
    this.templateService.createVm(this.hypervisorId(), template.id, body).subscribe({
      next: (job) => this.followJob(job.id),
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Interroge la tâche jusqu'à sa fin (voir JobService.watch). */
  private followJob(jobId: string): void {
    this.jobs.watch(jobId).subscribe({
      next: (job) => {
        if (job.status === 'succeeded') {
          this.result.set(job.result ?? null);
          this.state.set('success');
        } else {
          // La tâche a échoué : on fabrique une erreur à partir de sa raison.
          this.error.set({
            kind: 'technical',
            api: 'hypervisor-api',
            method: 'POST',
            endpoint: 'templates/vms',
            status: 0,
            title: 'La création a échoué',
            message: "L'hyperviseur n'a pas pu créer la machine virtuelle à partir du template.",
            detail: job.error,
            occurredAt: new Date(),
          });
          this.state.set('error');
        }
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Retrouve le pool et le volume de l'ISO choisie (le nom du pool peut contenir « / »). */
  private selectedIso(): VolumeRef | null {
    const key = this.iso();
    const pools = this.options()?.storage_pools ?? [];
    for (const p of pools) {
      const prefix = `${p.name}/`;
      if (key.startsWith(prefix)) {
        const volumeName = key.slice(prefix.length);
        const match = p.volumes.some((v) => v.kind === 'iso' && v.name === volumeName);
        if (match) {
          return { pool: p.name, volume: volumeName };
        }
      }
    }
    return null;
  }

  private fail(error: unknown): void {
    this.error.set(isAppError(error) ? error : null);
    this.state.set('error');
  }
}
