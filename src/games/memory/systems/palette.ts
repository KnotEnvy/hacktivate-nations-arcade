// ===== src/games/memory/systems/palette.ts =====
//
// The Lamplit Parlour palette. Memory Match is set on a card table in a
// quiet room: plum baize under one warm lamp, a padded leather rail, ivory
// card stock and jewel-tone backs. Everything the game draws takes its
// colour from here, except the two platform semantics it borrows from the
// arcade design system: emerald for "earned" and red for "a problem".
// Amber is currency on this platform and never appears in the parlour.

import { UI } from '@/games/shared/hud/canvasUi';

export const P = {
  // The table
  feltDeep: '#12090f',
  felt: '#2a1426',
  feltLit: '#4a2742',
  railDark: '#0d060b',
  rail: '#1c0e19',
  railLit: '#2a1624',
  stitch: 'rgba(244, 234, 216, 0.14)',
  inlay: 'rgba(244, 234, 216, 0.07)',
  lamp: '#fff1de',

  // Card stock and ink
  ivory: '#f4ecdc',
  ivoryShade: '#e6dac3',
  ivoryEdge: '#cdbd9f',
  ink: '#2a1b26',
  inkSoft: '#6e5866',

  // HUD type on the rail
  text: '#f1e7d6',
  textMuted: '#b99db1',
  textFaint: '#7c6477',

  // The studio accent: the cursor, the selected mode, the ornaments.
  rose: '#f2a6c2',
  roseDeep: '#c2688f',

  // Platform semantics
  good: UI.good,
  goodDim: UI.goodDim,
  bad: UI.bad,
} as const;

/** Card backs: base and lattice tone per table, jewel tones two steps apart. */
export const BACKS: ReadonlyArray<{ base: string; line: string }> = [
  { base: '#6c2035', line: '#80304a' }, // oxblood
  { base: '#1b4a50', line: '#2a6068' }, // bottle teal
  { base: '#2a2d69', line: '#3c4185' }, // ink indigo
  { base: '#2b4a2c', line: '#3c6240' }, // moss
  { base: '#35183d', line: '#4d2758' }, // midnight plum
];

/** Confetti paper: the parlour's own colours, never amber. */
export const CONFETTI = [P.ivory, P.rose, P.good, '#7aa7e8', '#c9a0e8'];
