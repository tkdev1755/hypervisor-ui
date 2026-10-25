/**
 * Les icônes de l'application, dessinées en traits sur une grille de 24 × 24.
 * Ajouter une icône : une ligne ici, avec ses tracés SVG (attribut « d »).
 */
export const ICONS = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M10 21v-6h4v6'],
  learn: ['M2 8l10-5 10 5-10 5z', 'M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5', 'M22 8v6'],
  server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01'],
  cpu: ['M7 7h10v10H7z', 'M10 10h4v4h-4z', 'M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4'],
  disk: ['M3 15h18v5H3z', 'M5.5 6.5 3 15h18l-2.5-8.5A2 2 0 0 0 16.6 5H7.4a2 2 0 0 0-1.9 1.5z', 'M7 17.5h.01'],
  network: ['M9 3h6v6H9z', 'M3 15h6v6H3z', 'M15 15h6v6h-6z', 'M12 9v3M6 15v-3h12v3'],
  terminal: ['M3 4h18v16H3z', 'M7 9l3 3-3 3', 'M12 15h5'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  play: ['M7 4.5v15l12-7.5z'],
  stop: ['M6 6h12v12H6z'],
  refresh: ['M21 12a9 9 0 1 1-2.64-6.36L21 8', 'M21 3v5h-5'],
  close: ['M6 6l12 12M18 6 6 18'],
  alert: ['M12 3 2 20h20L12 3z', 'M12 10v4', 'M12 17h.01'],
  check: ['M5 12.5 10 17 19 7'],
  'check-circle': ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z', 'M8 12.5l3 3 5-6'],
  info: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z', 'M12 11v5', 'M12 8h.01'],
  bulb: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'arrow-left': ['M19 12H5', 'M11 18l-6-6 6-6'],
  'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
  book: ['M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z', 'M5 18a2 2 0 0 1 2-2h12'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  activity: ['M3 12h4l3-8 4 16 3-8h4'],
  code: ['M8 8l-4 4 4 4', 'M16 8l4 4-4 4'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  layout: ['M3 4h18v16H3z', 'M3 9h18', 'M9 9v11'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  share: ['M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7', 'M16 6l-4-4-4 4', 'M12 2v13'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  key: ['M15 7a4 4 0 1 1-3.5 5.9L4 20.4V22h2v-2h2v-2h2l2.1-2.1A4 4 0 0 1 15 7z', 'M16 10h.01'],
  layers: ['M12 3 2 8l10 5 10-5z', 'M2 12.5l10 5 10-5', 'M2 17l10 5 10-5'],
} as const;

/** Le nom d'une icône : 'home', 'server', 'plus'... (TypeScript refuse un nom qui n'existe pas). */
export type IconName = keyof typeof ICONS;
