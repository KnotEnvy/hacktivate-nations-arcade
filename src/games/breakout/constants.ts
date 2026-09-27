// Mini Breakout — the numbers the court is built on.
//
// Geometry, timing and tuning live here so the rules tests and the renderers
// read the same values the game plays by. Everything is in canvas pixels and
// seconds; nothing here is per-frame.

export const VIEW_W = 800;
export const VIEW_H = 600;

/** The broadcast strip at the top. Only the HUD lives in it. */
export const HUD_BAND = 52;

/**
 * The inner edges of the three rails the ball rings off. The top rail sits
 * just under the HUD band, so the ball never enters the band either.
 */
export const ARENA = { left: 22, right: 778, top: 62, bottom: VIEW_H } as const;
export const RAIL_THICKNESS = 5;

export const BRICK_COLS = 10;
export const BRICK_TOP = 98;
export const BRICK_H = 20;
export const BRICK_GAP = 6;
export const BRICK_SIDE_PAD = 8;
export const BRICK_W =
  (ARENA.right -
    ARENA.left -
    BRICK_SIDE_PAD * 2 -
    BRICK_GAP * (BRICK_COLS - 1)) /
  BRICK_COLS;
export const BRICK_PITCH_X = BRICK_W + BRICK_GAP;
export const BRICK_PITCH_Y = BRICK_H + BRICK_GAP;

export const PADDLE_Y = 552;
export const PADDLE_H = 14;
export const PADDLE_W = 104;
export const PADDLE_WIDE_W = 156;
/** Keyboard paddle: top speed, and how quickly it gets there and stops. */
export const PADDLE_MAX_SPEED = 660;
export const PADDLE_ACCEL = 4200;
export const PADDLE_DECEL = 5200;
export const PADDLE_TURN_ACCEL = 9000;
/** Mouse / finger follow rate (1/s, exponential approach). */
export const PADDLE_FOLLOW = 32;

export const BALL_R = 7;
/** Level 1 serve speed, px/s. */
export const BASE_SPEED = 300;
/** +4% per level, capped at +40% (420px/s, reached on level 11). */
export const LEVEL_SPEED_STEP = 0.04;
export const LEVEL_SPEED_CAP = 1.4;
/** Each paddle return adds 1.5%, up to 25% over the level's serve speed. */
export const RALLY_GAIN = 0.015;
export const RALLY_CAP = 1.25;
/** Hard ceiling on ball speed. 300 * 1.4 * 1.25 = 525 sits under it. */
export const MAX_BALL_SPEED = 560;
/** The ball never moves further than this between collision checks. */
export const MAX_SUBSTEP = 5;

/** A paddle return leaves at most 60 degrees off vertical. */
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
/** The ball never flies flatter than 24 degrees above the horizontal. */
export const MIN_VY_FRACTION = Math.sin((24 * Math.PI) / 180);
/**
 * Nothing leaves the paddle dead vertical: a ball that did would come
 * straight back to the same spot, so a player who never moved would never
 * lose it. ~4.6 degrees is invisible in play but ends that loop.
 */
export const MIN_OFF_VERTICAL = 0.08;
/** Paddle velocity adds this much angle (radians) at full speed. */
export const RETURN_ENGLISH = 0.2;
/** On a serve the paddle's velocity is the aim, so it counts for more. */
export const SERVE_ENGLISH = 0.55;

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const MAX_BALLS = 6;

// ------------------------------------------------------------- beats ----
export const SERVE_TIMEOUT = 3;
export const CARD_TIME = 2;
export const LOST_BEAT = 1.2;
export const GAMEOVER_BEAT = 1.6;
export const SLOWMO_TIME = 0.4;
export const SLOWMO_SCALE = 0.35;
export const CLEAR_BEAT = 1.6;
/** When, inside the clear beat, the next layout starts dropping in. */
export const BUILD_START = 0.45;
export const ROW_DROP_DELAY = 0.08;
export const BRICK_DROP_TIME = 0.38;

// -------------------------------------------------------------- feel ----
export const SQUASH_TIME = 0.09;
export const RAIL_FLASH_TIME = 0.12;
export const BRICK_SHAKE_TIME = 0.14;
export const BALL_FLASH_TIME = 0.12;

// ---------------------------------------------------------- power-ups ----
export const DROP_CHANCE = 0.15;
export const CAPSULE_W = 44;
export const CAPSULE_H = 19;
export const CAPSULE_FALL = 140;
export const WIDEN_TIME = 10;
export const SLOW_TIME = 7;
export const SLOW_SCALE = 0.65;
export const CATCH_TIME = 8;

// ------------------------------------------------------------- score ----
export const BREAK_POINTS = 50;
export const CRACK_POINTS = 10;
export const CLEAR_POINTS = 200;
export const CLEAR_POINTS_PER_LEVEL = 50;
/** One pickup (10 coins) for every this-many bricks broken. */
export const BRICKS_PER_PICKUP = 2;

/**
 * Floodlight's court palette. Amber is the arcade's currency colour and red
 * its problem colour, so neither appears here: the brick ramp runs cool
 * (cobalt, top) to hot (magenta, bottom) instead of blue-to-red.
 */
export const COURT = {
  void: '#03040a',
  floorTop: '#11143c',
  floorMid: '#080a22',
  floorBottom: '#010104',
  grid: '#2c3796',
  line: '#dfe6ff',
  mint: '#2ee6c0',
  mintBright: '#b9fff0',
  violet: '#9b6bff',
  pink: '#ff4fc8',
  steel: '#8e97ad',
  steelDark: '#3c4358',
  glass: '#0a0b1f',
  lime: '#b8ff3c',
} as const;

export const BRICK_RAMP = [
  '#3d7bff',
  '#4f66ff',
  '#6552ff',
  '#7e46f7',
  '#9a3fe9',
  '#b63bd9',
  '#d23ac7',
  '#ec3fb4',
] as const;

/** Streak tiers tint the ball's comet: mint, violet, magenta. */
export const STREAK_COLORS = [COURT.mint, COURT.violet, COURT.pink] as const;
