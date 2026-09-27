// ===== src/games/minesweeper/systems/palette.ts =====
//
// Fieldmark's colours. The game is dressed as a surveyor's instrument: a
// slate housing, enamel keys over a warm charcoal plate, and the hot pink of
// real surveyors' flagging tape for every flag. Two colours are the
// platform's, not ours, and keep the platform's meaning: red (`UI.bad`) is a
// problem (a hit mine, a wrong flag, too many flags) and amber is currency,
// which this game never draws.

export const FIELD = {
  // The desk the instrument sits on.
  desk: '#0c1113',
  deskDeep: '#060809',
  contour: 'rgba(111, 214, 197, 0.075)',

  // The slate housing.
  housing: '#29333b',
  housingTop: '#323e48',
  housingLow: '#1c242a',
  housingEdge: 'rgba(255, 255, 255, 0.09)',
  tick: 'rgba(214, 226, 232, 0.22)',
  readout: '#0b1013',

  // Enamel keys (unrevealed tiles).
  tileTop: '#4aae9f',
  tile: '#3a978a',
  tileHi: '#8fe0d2',
  tileLo: '#1f5e55',
  tileLip: 'rgba(10, 36, 32, 0.55)',
  hoverTop: '#68cdbe',
  hover: '#50b3a3',
  pressedTop: '#215f56',
  pressed: '#276d63',

  // The plate under the keys (revealed tiles).
  plate: '#2a2622',
  plateLine: 'rgba(0, 0, 0, 0.32)',
  plateShade: 'rgba(0, 0, 0, 0.26)',
  plateLight: 'rgba(255, 240, 220, 0.035)',

  // Flagging tape and its stake.
  tape: '#ff4f9a',
  tapeDeep: '#c42d6f',
  pole: '#dde3e7',
  poleShade: '#8c969d',
  stake: '#14191c',

  // Mines.
  iron: '#15191c',
  ironMid: '#2c3237',
  ironHi: '#737d85',
  scorch: '#3a1310',
  crack: '#140605',

  // The face button and the tags.
  bone: '#ece5d6',
  boneShade: '#c8bfad',
  boneDeep: '#a79c87',
  faceInk: '#24201b',

  // Selection and "earned" in this studio's voice: the key colour, lit.
  lit: '#72dccb',
  litDeep: '#1f7a6d',
} as const;

/**
 * Number colours, the classic order (1 blue, 2 green, 3 red, 4 navy,
 * 5 maroon, 6 cyan, 7 near-white, 8 grey), lifted so each one reads on the
 * warm charcoal plate. Navy and maroon cannot survive a dark ground as-is,
 * so 4 becomes a periwinkle and 5 a raspberry: still their own hue family,
 * still distinct from 1 and 3 at 20px.
 */
export const NUMBER_COLORS: readonly string[] = [
  '',
  '#6cb6ff',
  '#6fd08a',
  '#ff6b57',
  '#958aff',
  '#d9668f',
  '#4fd2da',
  '#ece5d6',
  '#a09a91',
];
