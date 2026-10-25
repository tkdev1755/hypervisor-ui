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
import { CreateVmFromTemplate, Template, TemplateVersion } from '@app/models/template.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { VmOptions } from '@app/models/vm-options.model';
import { AuthService } from '@app/services/auth.service';
import { JobService } from '@app/services/job.service';
import { ModalRef } from '@app/services/modal-ref';
import { TemplateService } from '@app/services/template.service';
import { VmService } from '@app/services/vm.service';
import { formatQuotaRow, quotaRows } from '@app/utils/quota';

/**
 * Les choix par défaut de l'API (src/vm_options.rs), utilisés quand `vm-options` répond 403 :
 * un droit sur le template suffit pour créer une VM, même sans accès à l'hyperviseur.
 */
const FALLBACK_OPTIONS: VmOptions = {
  storage_pools: [],
  networks: [{ name: 'default' }],
  firmware: ['bios', 'uefi'],
  limits: { memory_mb: { min: 64, max: 1048576 }, vcpus: { min: 1, max: 256 }, disk_gb: { min: 1, max: 2048 } },
  defaults: { network: 'default', firmware: 'bios', memory_mb: 2048, vcpus: 2, disk_gb: 20 },
};

/**
 * Créer une VM à partir d'un template : une version prête, un nom, des vCPU, de la mémoire, un réseau,
 * un firmware. Pas de choix de disque : la VM reçoit une copie complète de celui de la version (sa
 * taille compte dans le quota). À l'ouverture, on charge `vm-options` (réseaux, firmwares, limites) et
 * les versions prêtes du template ; la version proposée est `version` si on la donne, sinon la
 * dernière prête (`default_version`). Sans accès à l'hyperviseur (mais avec un droit sur le template),
 * `vm-options` répond 403 : on propose alors les choix par défaut de l'API (réseau `default`).
 * La limite de VM de ce template (`access.max_vms`) est rappelée en haut du formulaire.
 *
 * L'API répond tout de suite avec une tâche (« job ») et copie le disque en arrière-plan : la modale
 * reste en chargement et interroge la tâche jusqu'à sa fin (comme le clonage). Se ferme avec la VM créée.
 */
@Component({
  selector: 'app-template-vm-modal',
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
  templateUrl: './template-vm-modal.component.html',
  styleUrl: './template-vm-modal.component.scss',
})
export class TemplateVmModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<VirtualMachine>);
  private readonly templates = inject(TemplateService);
  private readonly vms = inject(VmService);
  private readonly jobs = inject(JobService);
  protected readonly auth = inject(AuthService);

  readonly hypervisorId = input.required<string>();
  readonly template = input.required<Template>();
  /** La version à proposer ; null = la dernière version prête. */
  readonly version = input<number | null>(null);

  /** Les versions prêtes du template, la plus récente en premier. */
  protected readonly versions = signal<TemplateVersion[]>([]);
  protected readonly selectedVersion = signal<number | undefined>(undefined);
  protected readonly versionChoices = computed<Choice<number>[]>(() =>
    this.versions().map((v) => ({
      value: v.version,
      label: `Version ${v.version}` + (v.version === this.template().default_version ? ' (dernière)' : ''),
      description: `${v.disk_size_gb ?? '?'} Go · ${new Date(v.created_at * 1000).toLocaleDateString('fr-FR')}`,
    })),
  );
  /** La version choisie, pour afficher la taille de son disque. */
  protected readonly chosen = computed(() => this.versions().find((v) => v.version === this.selectedVersion()));

  /** Les choix proposés par l'API ; null tant qu'ils ne sont pas chargés. */
  protected readonly options = signal<VmOptions | null>(null);

  protected readonly name = signal('');
  protected readonly vcpus = signal(2);
  protected readonly memoryMb = signal(2048);
  protected readonly network = signal<string | undefined>(undefined);
  protected readonly firmware = signal<string | undefined>(undefined);
  protected readonly start = signal(true);
  /** Admin seulement : créer la VM pour un autre utilisateur (sans choix : pour soi). */
  protected readonly ownerId = signal<string | undefined>(undefined);

  /** La limite de VM de ce template pour l'utilisateur, en une phrase (vide s'il n'y en a pas, ou pour un admin). */
  protected readonly templateLimit = computed(() => {
    const { level, max_vms, vm_count } = this.template().access;
    if (level === 'admin' || max_vms === null) {
      return '';
    }
    return `Vous possédez ${vm_count} VM créée(s) à partir de ce template, sur ${max_vms} au plus.`;
  });

  /** Le quota de l'utilisateur, en une phrase (vide s'il n'a aucune limite). */
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

  protected readonly networks = computed<Choice<string>[]>(() =>
    (this.options()?.networks ?? []).map((n) => ({ value: n.name, label: n.name, description: n.bridge })),
  );

  protected readonly firmwares = computed<Choice<string>[]>(() =>
    (this.options()?.firmware ?? []).map((f) => ({ value: f, label: f.toUpperCase() })),
  );

  protected readonly startChoices: Choice<boolean>[] = [
    { value: true, label: 'Oui', description: 'Démarrer tout de suite' },
    { value: false, label: 'Non', description: 'La VM reste arrêtée' },
  ];

  protected readonly submitted = signal(false);

  protected readonly nameError = computed(() =>
    this.submitted() && !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,63}$/.test(this.name().trim())
      ? 'De 1 à 64 caractères : lettres, chiffres, tirets, underscores ou points (pas de point au début).'
      : null,
  );

  protected readonly versionError = computed(() =>
    this.submitted() && !this.chosen() ? "Ce template n'a aucune version prête." : null,
  );

  protected readonly resourcesError = computed(() => {
    const limits = this.options()?.limits;
    if (!this.submitted() || !limits) {
      return null;
    }
    const vcpus = this.vcpus();
    const memory = this.memoryMb();
    const vcpusOk = Number.isInteger(vcpus) && vcpus >= limits.vcpus.min && vcpus <= limits.vcpus.max;
    const memoryOk = Number.isInteger(memory) && memory >= limits.memory_mb.min && memory <= limits.memory_mb.max;
    return vcpusOk && memoryOk ? null : 'Les vCPU ou la mémoire sont hors des limites.';
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
    forkJoin({
      options: this.vms.options(this.hypervisorId()).pipe(catchError(() => of(FALLBACK_OPTIONS))),
      versions: this.templates.listVersions(this.hypervisorId(), this.template().id),
    }).subscribe({
      next: ({ options, versions }) => {
        const ready = versions.filter((v) => v.status === 'created');
        this.versions.set(ready);
        this.selectedVersion.set(this.version() ?? this.template().default_version ?? ready[0]?.version);
        this.options.set(options);
        this.vcpus.set(options.defaults.vcpus);
        this.memoryMb.set(options.defaults.memory_mb);
        const defaultNet = options.networks.find((n) => n.name === options.defaults.network)?.name;
        this.network.set(defaultNet ?? options.networks[0]?.name);
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
    if (!this.options() || this.nameError() || this.resourcesError() || this.versionError()) {
      return;
    }
    const body: CreateVmFromTemplate = {
      name: this.name().trim(),
      memory_mb: this.memoryMb(),
      vcpus: this.vcpus(),
      version: this.selectedVersion(),
      network: this.network(),
      firmware: this.firmware(),
      start: this.start(),
      ...(this.auth.isAdmin() && this.ownerId() ? { owner_id: this.ownerId() } : {}),
    };
    this.loadingLabel.set('Copie du disque du template, cela peut prendre quelques minutes…');
    this.state.set('loading');
    this.templates.createVm(this.hypervisorId(), this.template().id, body).subscribe({
      next: (job) => this.followJob(job.id),
      error: (error: unknown) => this.fail(error),
    });
  }

  private followJob(jobId: string): void {
    this.jobs.watch(jobId).subscribe({
      next: (job) => {
        if (job.status === 'succeeded') {
          this.result.set(job.result ?? null);
          this.state.set('success');
        } else {
          this.fail(null, job.error);
        }
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown, jobError?: string): void {
    if (isAppError(error)) {
      this.error.set(error);
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
        detail: jobError,
        occurredAt: new Date(),
      });
    }
    this.state.set('error');
  }
}
