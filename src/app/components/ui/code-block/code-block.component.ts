import { Component, ElementRef, effect, input, signal, viewChild } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

/**
 * CODE BLOCK — un bloc de code avec un bouton « Copier » (utilisé par les leçons).
 *
 *   <app-code-block [code]="exemple" title="mon-composant.ts" />
 *
 * - maxHeight : hauteur maximale en pixels (0 = aucune) ; au-delà, le bloc défile
 * - followEnd : reste en bas quand le code s'allonge (pratique pour un journal qui se remplit)
 */
@Component({
  selector: 'app-code-block',
  imports: [IconComponent],
  templateUrl: './code-block.component.html',
  styleUrl: './code-block.component.scss',
})
export class CodeBlockComponent {
  readonly code = input.required<string>();
  readonly title = input('exemple.ts');
  readonly maxHeight = input(0);
  readonly followEnd = input(false);

  private readonly pre = viewChild.required<ElementRef<HTMLElement>>('pre');

  constructor() {
    // À chaque nouveau contenu, on descend tout en bas si followEnd est activé.
    effect(() => {
      this.code();
      if (this.followEnd()) {
        const element = this.pre().nativeElement;
        setTimeout(() => (element.scrollTop = element.scrollHeight));
      }
    });
  }

  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.code());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
