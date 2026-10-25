import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { SpacerComponent } from '@app/components/layout/spacer/spacer.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { Choice, ChoiceCardsComponent } from '@app/components/ui/choice-cards/choice-cards.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { Template, TemplateVisibility } from '@app/models/template.model';
import { ModalRef } from '@app/services/modal-ref';
import { TemplateService } from '@app/services/template.service';
import { VmService } from '@app/services/vm.service';
import { PACKER_EXAMPLE, detectDiskName } from '@app/utils/packer-example';

/** Même règle que l'API pour le nom du template et celui du disque (vm_xml::validate_name). */
const NAME_PATTERN = /^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,63}$/;
const MAX_CONFIG_BYTES = 64 * 1024;

/**
 * Créer ou modifier un template (admin seulement) : un nom, une configuration Packer, le nom du
 * fichier disque qu'elle produit, le pool qui recevra les disques, et qui peut l'utiliser.
 *
 * - Sans `template` : création. L'API répond tout de suite (202) et construit la version 1 en
 *   arrière-plan ; la liste des templates suit son avancement.
 * - Avec `template` : modification (PATCH). Les versions déjà construites ne changent pas : il faut
 *   « Reconstruire » pour appliquer la nouvelle définition.
 *
 * Le nom du disque est lu automatiquement dans la configuration (vm_name) : le champ ne sert que
 * si on veut le préciser à la main. La liste des pools vient de `vm-options`, chargée à l'ouverture.
 * Se ferme avec le template créé ou modifié.
 */
@Component({
  selector: 'app-template-form-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, SpacerComponent, TextFieldComponent, TextComponent, ButtonComponent, ChoiceCardsComponent, CalloutComponent],
  templateUrl: './template-form-modal.component.html',
  styleUrl: './template-form-modal.component.scss',
})
export class TemplateFormModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<Template>);
  private readonly templates = inject(TemplateService);
  private readonly vms = inject(VmService);

  readonly hypervisorId = input.required<string>();
  readonly hypervisorName = input('');
  /** Le template à modifier ; absent pour une création. */
  readonly template = input<Template | null>(null);

  protected readonly editing = computed(() => this.template() !== null);

  protected readonly name = signal('');
  protected readonly packerConfig = signal('');
  protected readonly diskName = signal('');
  protected readonly pool = signal<string | undefined>(undefined);
  protected readonly visibility = signal<TemplateVisibility>('hypervisor');

  protected readonly visibilityChoices: Choice<TemplateVisibility>[] = [
    { value: 'hypervisor', label: "Tous ceux qui ont l'accès", description: "à l'hyperviseur" },
    { value: 'restricted', label: 'Restreint', description: 'Seulement les utilisateurs choisis' },
  ];

  /** Les pools de l'hyperviseur, proposés en cartes ; vide tant qu'ils ne sont pas chargés. */
  protected readonly pools = signal<Choice<string>[]>([]);

  /** Le nom du disque trouvé dans la configuration (vm_name), affiché en aide sous le champ. */
  protected readonly detectedDiskName = computed(() => detectDiskName(this.packerConfig()));
  /** Le nom réellement envoyé : celui tapé à la main, sinon celui de la configuration. */
  private readonly finalDiskName = computed(() => this.diskName().trim() || this.detectedDiskName() || '');

  protected readonly diskNameHint = computed(() => {
    const detected = this.detectedDiskName();
    return detected
      ? `Laissez vide pour utiliser celui de la configuration : ${detected}`
      : 'Le fichier que Packer écrit : la valeur de vm_name dans le builder qemu.';
  });

  protected readonly submitted = signal(false);

  protected readonly nameError = computed(() =>
    this.submitted() && !NAME_PATTERN.test(this.name().trim())
      ? 'De 1 à 64 caractères : lettres, chiffres, tirets, underscores ou points (pas de point au début).'
      : null,
  );

  protected readonly configError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    const config = this.packerConfig();
    if (!config.trim()) {
      return 'Collez la configuration Packer (HCL2 ou JSON).';
    }
    return new TextEncoder().encode(config).length > MAX_CONFIG_BYTES ? 'La configuration dépasse 64 Ko.' : null;
  });

  protected readonly diskNameError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    const disk = this.finalDiskName();
    if (!disk) {
      return "Indiquez le nom du fichier disque (il n'a pas été trouvé dans la configuration).";
    }
    return NAME_PATTERN.test(disk) ? null : 'De 1 à 64 caractères : lettres, chiffres, tirets, underscores ou points.';
  });

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);
  protected readonly loadingLabel = signal('Chargement des pools…');
  protected readonly result = signal<Template | null>(null);

  ngOnInit(): void {
    // En modification, le formulaire part des valeurs actuelles du template.
    const template = this.template();
    if (template) {
      this.name.set(template.name);
      this.packerConfig.set(template.packer_config ?? '');
      this.diskName.set(template.disk_name);
      this.visibility.set(template.visibility);
    }
    this.loadPools();
  }

  protected loadPools(): void {
    this.loadingLabel.set('Chargement des pools…');
    this.state.set('loading');
    this.vms.options(this.hypervisorId()).subscribe({
      next: (options) => {
        this.pools.set(
          options.storage_pools.map((p) => ({ value: p.name, label: p.name, description: `${p.available_gb} Go libres` })),
        );
        // En modification : le pool actuel. Sinon le pool « default » de libvirt s'il existe
        // (c'est aussi le choix par défaut de l'API).
        const preferred = options.storage_pools.find((p) => p.name === 'default') ?? options.storage_pools[0];
        this.pool.set(this.template()?.pool ?? preferred?.name);
        this.state.set('form');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** « Réessayer » : recharger les pools s'ils manquent, sinon revenir au formulaire. */
  protected retry(): void {
    if (this.pools().length) {
      this.state.set('form');
    } else {
      this.loadPools();
    }
  }

  /** Remplit le formulaire avec l'exemple Debian 12 (sans écraser un nom déjà tapé). */
  protected useExample(): void {
    if (!this.name().trim()) {
      this.name.set(PACKER_EXAMPLE.name);
    }
    this.packerConfig.set(PACKER_EXAMPLE.config);
    this.diskName.set('');
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.nameError() || this.configError() || this.diskNameError()) {
      return;
    }
    const body = {
      name: this.name().trim(),
      packer_config: this.packerConfig(),
      disk_name: this.finalDiskName(),
      pool: this.pool(),
      visibility: this.visibility(),
    };
    const template = this.template();
    this.loadingLabel.set(template ? 'Enregistrement…' : 'Lancement de la construction…');
    this.state.set('loading');
    const request = template ? this.templates.update(this.hypervisorId(), template.id, body) : this.templates.create(this.hypervisorId(), body);
    request.subscribe({
      next: (saved) => {
        this.result.set(saved);
        this.state.set('success');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.error.set(isAppError(error) ? error : null);
    this.state.set('error');
  }
}
