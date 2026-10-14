import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * FRAME — affiche une autre page web dans un cadre (une iframe).
 *
 *   <app-frame url="http://localhost:6080/vnc.html" title="Console" [height]="480" />
 *   <app-frame url="..." height="calc(95vh - 200px)" />
 *
 * Angular refuse par sécurité d'afficher une adresse inconnue dans une iframe.
 * Ce composant doit donc recevoir une adresse de confiance : ne lui donnez
 * jamais une adresse saisie par un utilisateur.
 */
@Component({
  selector: 'app-frame',
  templateUrl: './frame.component.html',
  styleUrl: './frame.component.scss',
})
export class FrameComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly url = input.required<string>();
  readonly title = input('Contenu intégré');
  /** En pixels (nombre) ou en CSS (texte), par exemple 'calc(95vh - 200px)'. */
  readonly height = input<number | string>(420);

  protected readonly cssHeight = computed(() => (typeof this.height() === 'number' ? `${this.height()}px` : String(this.height())));

  protected readonly safeUrl = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.url()));
}
