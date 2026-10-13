/** Alignements utilisés par les composants de mise en page (Column, Row). */
export type MainAlign = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type CrossAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

/** Traduit nos noms simples en valeurs CSS. */
export function toCss(value: MainAlign | CrossAlign): string {
  switch (value) {
    case 'start':
      return 'flex-start';
    case 'end':
      return 'flex-end';
    default:
      return value;
  }
}
