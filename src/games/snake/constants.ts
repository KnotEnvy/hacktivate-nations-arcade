// ===== src/games/snake/constants.ts =====
//
// Layout, palette and timings for Snake. Everything a renderer, a rule or a
// test needs to agree on lives here, so the numbers are stated once.
//
// The screen is three bands: a 64px HUD band on top, the terrarium board in
// the middle, and a 44px band underneath for power-up pods and hints. The
// board sits entirely inside its band with its frame, and nothing but
// in-board effects is ever drawn over it.

export const CANVAS_W = 800;
export const CANVAS_H = 600;

export const TOP_BAND = 64;
export const BOTTOM_BAND = 44;
export const BOTTOM_BAND_Y = CANVAS_H - BOTTOM_BAND;

/** An odd row and column count gives the board a true centre cell. */
export const COLS = 31;
export const ROWS = 19;
export const CELL = 24;
export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL;
export const BOARD_X = (CANVAS_W - BOARD_W) / 2;
export const BOARD_Y =
  TOP_BAND + (CANVAS_H - TOP_BAND - BOTTOM_BAND - BOARD_H) / 2;
export const FRAME = 8;
export const BOARD_RADIUS = 10;

/**
 * Mosslight's palette. Deep teal glass, a moss bed, bone-white ink and two
 * accents of the studio's own: sprout (feasts) and tide (pace). Amber is
 * never used here: in this arcade it means currency, and the only amber
 * things in Snake are coins.
 */
export const PAL = {
  case: '#031215',
  caseLift: '#06191c',
  band: '#071b1f',
  bandEdge: '#0c2a2c',
  bedA: '#0b3533',
  bedB: '#0d3b38',
  bedGlow: '#3fd49a',
  frameLight: '#2d6f5f',
  frameMid: '#164238',
  frameDark: '#05181a',
  marker: '#9fd8b0',

  bone: '#efe9d6',
  sage: '#9dbcab',
  lichen: '#5f8276',
  sprout: '#b8f36b',
  tide: '#62d6c8',

  snakeBody: '#3dbb68',
  snakeHead: '#4ccb77',
  snakeOutline: '#0b3522',
  snakeStripe: '#a9ef8c',
  snakeFlash: '#e4ffe9',
  eye: '#f3efdc',
  pupil: '#0a1c14',
  tongue: '#ff6f95',

  apple: '#e03d58',
  appleDark: '#8c1733',
  appleLight: '#ff9fad',
  stem: '#6b4a2b',
  leaf: '#72d46c',

  egg: '#efe6cf',
  eggShade: '#c9bfa5',
  eggSpeckle: '#7fa293',
} as const;

// ----------------------------------------------------------- timings ----

/** The READY card ends on the first input or after this long. */
export const READY_AUTO_START = 2.0;
/** Freeze after a non-fatal hit, before the snake hatches again. */
export const HIT_STOP = 0.5;
/** A freshly hatched snake waits this long for a turn before it moves. */
export const RESPAWN_WAIT = 1.5;
/** Invulnerability once a hatched snake starts moving. */
export const RESPAWN_INVULNERABILITY = 1.5;
/** Death: segments pop head to tail over this long... */
export const DEATH_POP_TIME = 1.2;
/** ...then the red board holds for this long before endGame(). */
export const DEATH_HOLD = 0.45;
/** After WRAP or GHOST runs out the head keeps that power this long. */
export const POWER_GRACE = 0.5;
/** Power-up pods blink and tick for their last seconds. */
export const EXPIRY_WARNING = 2.0;

// ------------------------------------------------------------ spawns ----

export const COIN_INTERVAL = 4;
export const MAX_COINS = 2;
export const COIN_LIFETIME = 6;
export const POWERUP_INTERVAL = 10;
export const MAX_POWERUPS = 1;
export const POWERUP_LIFETIME = 8;
export const MAGNET_RANGE = 4;

// ------------------------------------------------------------ scores ----

export const FOOD_POINTS = 10;
export const COIN_POINTS = 25;
export const POWERUP_POINTS = 30;
export const LENGTH_MILESTONE = 20;
export const START_LENGTH = 3;
export const MAX_LIVES = 3;
