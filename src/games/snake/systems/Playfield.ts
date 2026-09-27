// ===== src/games/snake/systems/Playfield.ts =====
//
// Paints everything inside the terrarium bed for one frame: the apple,
// coins, power-up tokens, pickups still on their way into the mouth, the
// shed skin of a lost life, the snake, and the state's own marks (the
// respawn countdown and turn hints, the hit flash, the red of a death).
// It reads a view of the game and never changes it.

import { UI, roundRectPath, withAlpha } from '@/games/shared/hud/canvasUi';
import {
  BOARD_H,
  BOARD_RADIUS,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  CELL,
  MAGNET_RANGE,
  DEATH_POP_TIME,
  HIT_STOP,
  PAL,
  RESPAWN_WAIT,
} from '../constants';
import { drawCoin, type Coin } from '../entities/Coin';
import { drawApple, type Food } from '../entities/Food';
import { drawPowerUpIcon } from '../entities/icons';
import { POWERUP_CONFIGS, type PowerUp } from '../entities/PowerUp';
import { boardVignette, tintBoard } from './BoardRenderer';
import type { Cell } from './Respawn';
import { drawShed, drawSnake, headPixel } from './SnakeRenderer';
import { DIRS, DIR_VEC, Dir, OPPOSITE } from './TurnQueue';

export interface MorselView {
  kind: 'apple' | 'coin' | 'powerup';
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  type: PowerUp['type'] | null;
  left: number;
  total: number;
}

export interface PlayfieldView {
  state: string;
  stateTime: number;
  time: number;
  snake: readonly Cell[];
  prevTail: Cell;
  t: number;
  bulges: readonly number[];
  heading: Dir;
  food: Food;
  coins: readonly Coin[];
  powerUps: readonly PowerUp[];
  morsels: readonly MorselView[];
  hunger: number;
  flash: boolean;
  rainbow: number;
  squash: number;
  hatch: number;
  popped: number;
  hitCell: Cell | null;
  shed: readonly Cell[];
  shedAge: number;
  boardFlash: number;
  /** Power-ups in effect, for their in-board tells. */
  powers: readonly PowerUp['type'][];
  /** The run is over: draw the body as a shed skin under a dim. */
  ended: boolean;
}

export function drawPlayfield(
  ctx: CanvasRenderingContext2D,
  v: PlayfieldView
): void {
  tintBoard(ctx, PAL.tide, v.boardFlash * 0.16);
  if (!v.ended) drawModeTells(ctx, v);

  const time = v.time;
  v.food.render(ctx, BOARD_X, BOARD_Y, time, v.hunger);
  for (const c of v.coins) c.render(ctx, BOARD_X, BOARD_Y, time);
  for (const p of v.powerUps) p.render(ctx, BOARD_X, BOARD_Y, time);
  for (const m of v.morsels) drawMorsel(ctx, m, time);

  if (v.ended) {
    drawShed(ctx, v.snake, 1);
    tintBoard(ctx, UI.bad, 0.08);
    tintBoard(ctx, '#020d0e', 0.55);
    return;
  }

  const shedAlpha = 1 - v.shedAge / 0.8;
  if (shedAlpha > 0) drawShed(ctx, v.shed, shedAlpha);

  const moving = v.state === 'playing';
  const head = headPixel(v.snake, v.prevTail, v.t);
  const foodPx = {
    x: BOARD_X + (v.food.x + 0.5) * CELL,
    y: BOARD_Y + (v.food.y + 0.5) * CELL,
  };
  const hitK = v.state === 'hit' ? v.stateTime / HIT_STOP : 1;
  const flashOn = v.state === 'hit' && Math.floor(v.stateTime * 14) % 2 === 0;
  if (flashOn && v.hitCell) drawHitCell(ctx, v.hitCell);
  drawSnake(ctx, {
    cells: v.snake,
    prevTail: v.prevTail,
    t: v.t,
    bulges: v.bulges,
    time,
    flash: v.flash,
    rainbow: v.rainbow,
    squash: v.squash,
    hatch: v.state === 'respawn' || moving ? 0.35 + 0.65 * easeOut(v.hatch) : 1,
    nose: v.state === 'hit' ? Math.sin(Math.min(1, hitK * 1.6) * Math.PI) : 0,
    popped: v.popped,
    ghost: v.powers.includes('ghost'),
    stripe: v.powers.includes('double')
      ? POWERUP_CONFIGS.double.color
      : undefined,
    lookAt: v.hunger > 0 && v.food.isPlaced() ? foodPx : null,
    tongue: v.state === 'hit' || v.state === 'dying' ? 0 : tongue(time),
  });

  if (v.state === 'respawn') drawRespawnHints(ctx, head, v);
  if (v.state === 'hit' && v.hitCell) {
    drawHitRing(ctx, v.hitCell, v.stateTime, flashOn);
  }
  if (v.state === 'hit') boardVignette(ctx, UI.bad, 1 - hitK * 0.7);
  if (v.state === 'dying') {
    const k = Math.min(1, v.stateTime / DEATH_POP_TIME);
    tintBoard(ctx, UI.bad, 0.22 * k);
    boardVignette(ctx, UI.bad, 0.6 * k);
  }
}

/**
 * What an active power-up looks like on the board, so the player does not
 * have to read the pods: SLOW frosts the bed, WRAP lights the glass edges
 * violet (they are open), MAGNET rings the head with its reach. GHOST and
 * DOUBLE show on the snake itself.
 */
function drawModeTells(ctx: CanvasRenderingContext2D, v: PlayfieldView): void {
  const pulse = 0.5 + 0.5 * Math.sin(v.time * 4);
  if (v.powers.includes('slow')) {
    tintBoard(ctx, POWERUP_CONFIGS.slow.color, 0.05 + pulse * 0.02);
  }
  if (v.powers.includes('wrap')) {
    const c = POWERUP_CONFIGS.wrap.color;
    ctx.save();
    for (const [w, a] of [
      [12, 0.1],
      [4, 0.35 + pulse * 0.25],
    ] as const) {
      ctx.strokeStyle = withAlpha(c, a);
      ctx.lineWidth = w;
      roundRectPath(ctx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, BOARD_RADIUS);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (v.powers.includes('magnet') && v.snake.length > 0) {
    const head = headPixel(v.snake, v.prevTail, v.t);
    const c = POWERUP_CONFIGS.magnet.color;
    ctx.save();
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) {
      const phase = (v.time * 0.7 + k * 0.5) % 1;
      ctx.strokeStyle = withAlpha(c, 0.3 * (1 - phase));
      ctx.beginPath();
      ctx.arc(
        head.x,
        head.y,
        CELL * MAGNET_RANGE * (1 - phase * 0.7),
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Two quick flicks every few seconds. */
function tongue(time: number): number {
  const period = 2.7;
  const phase = time % period;
  if (phase > 0.4) return 0;
  const s = Math.sin((phase / 0.4) * Math.PI * 2);
  return s * s;
}

function easeOut(k: number): number {
  const c = Math.max(0, Math.min(1, k));
  return 1 - Math.pow(1 - c, 3);
}

/** A pickup the rules took but the head has not reached: it shrinks in. */
function drawMorsel(
  ctx: CanvasRenderingContext2D,
  m: MorselView,
  time: number
): void {
  const k = Math.max(0, Math.min(1, 1 - m.left / m.total));
  const slide = 1 - Math.pow(1 - k, 2);
  const gx = m.fromX + (m.x - m.fromX) * slide;
  const gy = m.fromY + (m.y - m.fromY) * slide;
  const cx = BOARD_X + (gx + 0.5) * CELL;
  const cy = BOARD_Y + (gy + 0.5) * CELL;
  const shrink = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  if (shrink <= 0.02) return;
  if (m.kind === 'apple') {
    drawApple(ctx, cx, cy, (CELL / 2 - 3) * shrink);
  } else if (m.kind === 'coin') {
    drawCoin(ctx, cx, cy, (CELL / 2 - 4) * shrink, time * 4);
  } else if (m.type) {
    const color = POWERUP_CONFIGS[m.type].color;
    drawPowerUpIcon(ctx, m.type, cx, cy, (CELL / 2 - 3) * shrink, color);
  }
}

/** The wait after hatching: a draining ring and the three ways out. */
function drawRespawnHints(
  ctx: CanvasRenderingContext2D,
  head: { x: number; y: number },
  v: PlayfieldView
): void {
  const left = Math.max(0, 1 - v.stateTime / RESPAWN_WAIT);
  ctx.save();
  ctx.strokeStyle = withAlpha(PAL.sprout, 0.85);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(
    head.x,
    head.y,
    CELL * 0.95,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * left
  );
  ctx.stroke();

  const pulse = 0.45 + 0.4 * Math.sin(v.time * 7);
  ctx.strokeStyle = withAlpha(PAL.bone, pulse);
  ctx.lineWidth = 2.2;
  for (const d of DIRS) {
    if (d === OPPOSITE[v.heading]) continue;
    const dv = DIR_VEC[d];
    const reach = CELL * (1.45 + 0.12 * Math.sin(v.time * 7));
    const px = head.x + dv.x * reach;
    const py = head.y + dv.y * reach;
    const a = Math.atan2(dv.y, dv.x);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(3, 0);
    ctx.lineTo(-3, 5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The cell the snake ran into, lit under the snake on flash frames. */
function drawHitCell(ctx: CanvasRenderingContext2D, cell: Cell): void {
  ctx.save();
  ctx.fillStyle = withAlpha(UI.bad, 0.35);
  ctx.fillRect(BOARD_X + cell.x * CELL, BOARD_Y + cell.y * CELL, CELL, CELL);
  ctx.restore();
}

/** A ring spreading from the collision, flashing with the cell. */
function drawHitRing(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  stateTime: number,
  on: boolean
): void {
  const cx = BOARD_X + (cell.x + 0.5) * CELL;
  const cy = BOARD_Y + (cell.y + 0.5) * CELL;
  ctx.save();
  ctx.strokeStyle = withAlpha(UI.bad, on ? 0.95 : 0.4);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * (0.7 + stateTime * 0.6), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
