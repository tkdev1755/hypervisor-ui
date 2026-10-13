import { Component, input, model } from '@angular/core';

/** Une option : la valeur réelle, le texte affiché, et une description facultative. */
export interface Choice<T> {
  value: T;
  label: string;
  description?: string;
}

/**
 * CHOICE CARDS — choisir une option parmi plusieurs, présentées en cartes.
 *
 *   readonly taille = signal<'petite' | 'grande'>('petite');
 *   readonly options: Choice<'petite' | 'grande'>[] = [
 *     { value: 'petite', label: 'Petite', description: '1 vCPU' },
 *     { value: 'grande', label: 'Grande', description: '4 vCPU' },
 *   ];
 *   <app-choice-cards [options]="options" [(value)]="taille" />
 *
 * Les flèches du clavier permettent aussi de changer de choix.
 */
@Component({
  selector: 'app-choice-cards',
  templateUrl: './choice-cards.component.html',
  styleUrl: './choice-cards.component.scss',
})
export class ChoiceCardsComponent<T> {
  readonly options = input.required<Choice<T>[]>();
  readonly value = model<T>();
  readonly label = input('Choix');
  readonly columns = input(3);

  protected select(value: T): void {
    this.value.set(value);
  }

  /** Flèches gauche / droite : passer à l'option précédente ou suivante. */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    const options = this.options();
    const next = (index + step + options.length) % options.length;
    this.select(options[next].value);
    const group = (event.currentTarget as HTMLElement).parentElement;
    (group?.children[next] as HTMLElement | undefined)?.focus();
  }
}
