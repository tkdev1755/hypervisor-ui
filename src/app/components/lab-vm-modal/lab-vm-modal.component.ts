import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { ListTileComponent } from '@app/components/ui/list-tile/list-tile.component';
import { ListComponent } from '@app/components/ui/list/list.component';
import { NumberFieldComponent } from '@app/components/ui/number-field/number-field.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { LabDetail, LabNetwork, LabVm, LabVmBody, LabVmRole } from '@app/models/lab.model';
import { Template } from '@app/models/template.model';
import { LabService } from '@app/services/lab.service';
import { ModalRef } from '@app/services/modal-ref';
import { TemplateService } from '@app/services/template.service';

/** Même règle que l'API pour le nom d'une VM (vm_xml::validate_name), en 55 caractères au plus (l'API y ajoute « -» et 8 caractères). */
const VM_NAME_PATTERN = /^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,54}$/;
/** Les limites de l'API (src/vm_options.rs). */
const MEMORY = { min: 64, max: 1048576 };
const VCPUS = { min: 1, max: 256 };
const MAX_NICS = 8;
/** Dans le choix de version, 0 veut dire « la dernière version prête au moment du déploiement » (null pour l'API). */
const LATEST = 0;

/**
 * Ajouter une VM à un labo, ou la modifier (droit 'manage'). Une VM de labo, c'est :
 *
 * - un nom (chaque instance ajoute un suffixe : deux instances ne se gênent pas) ;
 * - un rôle : 'vm', ou 'router' (OPNsense…) qui relie les réseaux et démarre avant les autres ;
 * - un template (seulement ceux que l'utilisateur peut utiliser) et une version : la dernière prête au
 *   moment du déploiement (le plus simple), ou une version précise ;
 * - des vCPU, de la mémoire, un firmware (celui avec lequel le template a été installé) ;
 * - des cartes réseau, DANS L'ORDRE : la première est la première carte vue par la VM (pour un
 *   OPNsense : le WAN d'abord, puis le LAN).
 *
 * Modifier remplace la VM entière (PUT) ; les instances déjà déployées ne changent pas.
 * Se ferme avec la VM enregistrée.
 */
@Component({
  selector: 'app-lab-vm-modal',
  imports: [
    ModalShellComponent,
    ColumnComponent,
    RowComponent,
    TextFieldComponent,
    TextComponent,
    ButtonComponent,
    ChoiceCardsComponent,
    NumberFieldComponent,
    CalloutComponent,
    ListComponent,
    ListTileComponent,
  ],
  templateUrl: './lab-vm-modal.component.html',
  styleUrl: './lab-vm-modal.component.scss',
})
export class LabVmModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<LabVm>);
  private readonly labs = inject(LabService);
  private readonly templates = inject(TemplateService);

  readonly hypervisorId = input.required<string>();
  readonly lab = input.required<LabDetail>();
  /** La VM à modifier ; absente pour en ajouter une. */
  readonly vm = input<LabVm | null>(null);

  protected readonly editing = computed(() => this.vm() !== null);
  protected readonly memoryLimits = MEMORY;
  protected readonly vcpuLimits = VCPUS;
  protected readonly maxNics = MAX_NICS;

  protected readonly name = signal('');
  protected readonly role = signal<LabVmRole>('vm');
  protected readonly templateId = signal<string | undefined>(undefined);
  protected readonly version = signal<number>(LATEST);
  protected readonly memoryMb = signal(2048);
  protected readonly vcpus = signal(2);
  protected readonly firmware = signal('bios');
  /** Les ids des réseaux du labo, une carte chacun, dans l'ordre. */
  protected readonly nics = signal<string[]>([]);

  protected readonly roleChoices: Choice<LabVmRole>[] = [
    { value: 'vm', label: 'VM', description: 'Une machine du labo' },
    { value: 'router', label: 'Routeur', description: 'OPNsense… : relie les réseaux, démarre en premier' },
  ];
  protected readonly firmwareChoices: Choice<string>[] = [
    { value: 'bios', label: 'BIOS' },
    { value: 'uefi', label: 'UEFI' },
  ];

  /** Les templates que l'utilisateur peut utiliser sur cet hyperviseur. */
  private readonly templateList = signal<Template[]>([]);
  protected readonly templateChoices = computed<Choice<string>[]>(() =>
    this.templateList().map((t) => ({
      value: t.id,
      label: t.name,
      description: t.default_version ? `Dernière version prête : v${t.default_version}` : 'Aucune version prête pour l’instant',
    })),
  );

  /** Les versions prêtes du template choisi, plus « la dernière au déploiement ». */
  protected readonly versionChoices = signal<Choice<number>[]>([]);

  /** Les cartes réseau, avec le réseau du labo de chacune (pour l'affichage). */
  protected readonly nicRows = computed(() =>
    this.nics().map((id, index) => ({ index, id, network: this.lab().networks.find((n) => n.id === id) })),
  );

  protected readonly submitted = signal(false);
  protected readonly nameError = computed(() =>
    this.submitted() && !VM_NAME_PATTERN.test(this.name().trim())
      ? 'De 1 à 55 caractères : lettres, chiffres, tirets, underscores ou points (pas de point au début).'
      : null,
  );
  protected readonly templateError = computed(() => (this.submitted() && !this.templateId() ? 'Choisissez un template.' : null));
  protected readonly resourcesError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    const memory = this.memoryMb();
    const vcpus = this.vcpus();
    const ok =
      Number.isInteger(memory) && memory >= MEMORY.min && memory <= MEMORY.max && Number.isInteger(vcpus) && vcpus >= VCPUS.min && vcpus <= VCPUS.max;
    return ok ? null : 'Les vCPU ou la mémoire sont hors des limites.';
  });

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);
  protected readonly result = signal<LabVm | null>(null);

  /** Le template choisi au passage précédent de l'effect ci-dessous. */
  private lastTemplateId?: string;

  constructor() {
    // Quand le template choisi change, on charge ses versions prêtes. Si on passe d'un template à un
    // autre, la version précise choisie n'a plus de sens : on revient à « la dernière prête ».
    effect(() => {
      const templateId = this.templateId();
      untracked(() => {
        if (this.lastTemplateId !== undefined && this.lastTemplateId !== templateId) {
          this.version.set(LATEST);
        }
        this.lastTemplateId = templateId;
        this.loadVersions(templateId);
      });
    });
  }

  ngOnInit(): void {
    const vm = this.vm();
    if (vm) {
      this.name.set(vm.name);
      this.role.set(vm.role);
      this.templateId.set(vm.template_id);
      this.version.set(vm.version ?? LATEST);
      this.memoryMb.set(vm.memory_mb);
      this.vcpus.set(vm.vcpus);
      this.firmware.set(vm.firmware);
      this.nics.set([...vm.networks]);
    }
    this.loadTemplates();
  }

  protected loadTemplates(): void {
    this.state.set('loading');
    this.templates.list(this.hypervisorId()).subscribe({
      next: (templates) => {
        this.templateList.set(templates);
        this.state.set('form');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private loadVersions(templateId: string | undefined): void {
    const latest: Choice<number> = { value: LATEST, label: 'La dernière prête', description: 'Au moment de chaque déploiement' };
    this.versionChoices.set([latest]);
    if (!templateId) {
      return;
    }
    this.templates.listVersions(this.hypervisorId(), templateId).subscribe({
      next: (versions) => {
        const ready = versions.filter((v) => v.status === 'created');
        this.versionChoices.set([
          latest,
          ...ready.map((v) => ({ value: v.version, label: `Version ${v.version}`, description: `${v.disk_size_gb ?? '?'} Go` })),
        ]);
      },
      // Sans la liste des versions, on garde « la dernière prête ».
      error: () => undefined,
    });
  }

  /** La ligne d'une carte réseau : son réseau et ce qu'il est. */
  protected describeNetwork(network: LabNetwork | undefined): string {
    if (!network) {
      return 'Réseau retiré du labo';
    }
    return network.kind === 'external' ? `Externe · ${network.libvirt_network}` : 'Interne · isolé, propre à chaque instance';
  }

  protected addNic(network: LabNetwork): void {
    this.nics.update((nics) => [...nics, network.id]);
  }

  protected removeNic(index: number): void {
    this.nics.update((nics) => nics.filter((_, i) => i !== index));
  }

  /** Remonte une carte d'un cran (l'ordre compte : la première carte est la première vue par la VM). */
  protected moveUp(index: number): void {
    this.nics.update((nics) => {
      const next = [...nics];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    const templateId = this.templateId();
    if (this.nameError() || this.templateError() || this.resourcesError() || !templateId) {
      return;
    }
    const body: LabVmBody = {
      name: this.name().trim(),
      role: this.role(),
      template_id: templateId,
      version: this.version() === LATEST ? null : this.version(),
      memory_mb: this.memoryMb(),
      vcpus: this.vcpus(),
      firmware: this.firmware(),
      networks: this.nics(),
    };
    const vm = this.vm();
    this.state.set('loading');
    const request = vm
      ? this.labs.updateVm(this.hypervisorId(), this.lab().id, vm.id, body)
      : this.labs.addVm(this.hypervisorId(), this.lab().id, body);
    request.subscribe({
      next: (saved) => {
        this.result.set(saved);
        this.state.set('success');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** « Réessayer » : recharger les templates s'ils manquent, sinon revenir au formulaire. */
  protected retry(): void {
    if (this.templateList().length) {
      this.state.set('form');
    } else {
      this.loadTemplates();
    }
  }

  private fail(error: unknown): void {
    this.error.set(isAppError(error) ? error : null);
    this.state.set('error');
  }
}
