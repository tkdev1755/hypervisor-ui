import { Component, input, signal } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

/**
 * CODE BLOCK — un bloc de code avec un bouton « Copier » (utilisé par les leçons).
 *
 *   <app-code-block [code]="exemple" title="mon-composant.ts" />
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

  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.code());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
