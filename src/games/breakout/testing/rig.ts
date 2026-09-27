// Test plumbing for the Mini Breakout suites; the game never imports it.
// Boots a game on the shared harness, reaches its private state through one
// typed cast, and drives its inputs. It lives outside __tests__ because jest
// runs every file in there as a suite.

import { BreakoutGame } from '../BreakoutGame';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';
import type { Ball, Brick, Capsule, Paddle } from '../entities/types';
import type { ActivePowers } from '../systems/powerups';
import type { Streak } from '../systems/streak';
import type { RailFlash } from '../systems/ArenaRenderer';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { BannerState } from '../systems/HudRenderer';

/** The private surface these tests reach through. */
export interface BreakoutInternals {
  gameState: 'ready' | 'playing' | 'lost' | 'clear' | 'gameover';
  stateTime: number;
  level: number;
  lives: number;
  score: number;
  pickups: number;
  gameTime: number;
  isPaused: boolean;
  renderBaseHud: boolean;
  paddle: Paddle;
  balls: Ball[];
  bricks: Brick[];
  capsules: Capsule[];
  powers: ActivePowers;
  streak: Streak;
  serveWait: number;
  serveLean: number;
  cardOpen: boolean;
  cardAlpha: number;
  banner: BannerState | null;
  railFlashes: RailFlash[];
  particles: ParticleSystem;
  slowmo: number;
  hurt: number;
  flash: number;
  dim: number;
  bricksDestroyedThisGame: number;
  onBrick(ball: Ball, brick: Brick): void;
  collect(c: Capsule): void;
  releaseStuck(): void;
}

export interface Rig {
  h: Harness;
  g: BreakoutInternals;
  /** Keys currently held. */
  held: Set<string>;
  mouse: { x: number; y: number };
  buttons: Set<number>;
  touches: Array<{ id: number; x: number; y: number }>;
  sounds: string[];
}

export function boot(): Rig {
  const h = initGame(new BreakoutGame());
  const held = new Set<string>();
  const mouse = { x: 0, y: 0 };
  const buttons = new Set<number>();
  const touches: Array<{ id: number; x: number; y: number }> = [];
  const input = h.services.input as unknown as Record<string, jest.Mock>;
  input.isKeyPressed.mockImplementation((c: string) => held.has(c));
  input.isMousePressed.mockImplementation((b = 0) => buttons.has(b));
  input.getMousePosition.mockImplementation(() => ({ ...mouse }));
  input.getTouches.mockImplementation(() => touches.map(t => ({ ...t })));
  const sounds: string[] = [];
  (h.services.audio.playSound as unknown as jest.Mock).mockImplementation(
    (name: string) => sounds.push(name)
  );
  return {
    h,
    g: h.game as unknown as BreakoutInternals,
    held,
    mouse,
    buttons,
    touches,
    sounds,
  };
}

/** Update only (no render), `seconds` of game time at `dt`. */
export function run(r: Rig, seconds: number, dt = 1 / 60): void {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) r.h.game.update(dt);
}

/** Tap a key for one frame. */
export function press(r: Rig, code: string, dt = 1 / 60): void {
  r.held.add(code);
  r.h.game.update(dt);
  r.held.delete(code);
  r.h.game.update(dt);
}

/** Serve and settle into play. */
export function serve(r: Rig): void {
  press(r, 'Space');
  expect(r.g.gameState).toBe('playing');
}

/** Deterministic Math.random for a test (restored by jest.restoreAllMocks). */
export function seedRandom(seed: number): void {
  let a = seed >>> 0;
  jest.spyOn(Math, 'random').mockImplementation(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

export function overlaps(ball: Ball, b: Brick): boolean {
  const nx = Math.max(b.x, Math.min(ball.x, b.x + b.w));
  const ny = Math.max(b.y, Math.min(ball.y, b.y + b.h));
  return (ball.x - nx) ** 2 + (ball.y - ny) ** 2 < ball.r * ball.r - 1e-6;
}

export function testBrick(x: number, y: number, hp = 1): Brick {
  return {
    x,
    y,
    w: 68,
    h: 20,
    row: 0,
    col: 0,
    hp,
    maxHp: hp,
    alive: true,
    armored: false,
    color: '#3d7bff',
    shake: 0,
    flash: 0,
    enterDelay: 0,
    enter: 1,
    baseX: x,
    drift: 0,
    cracks: [],
  };
}
