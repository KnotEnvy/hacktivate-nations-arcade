// Can the runner actually be played?
//
// The fairness suite proves each rule in isolation. This one proves they add
// up: a bot with simple reflexes and no foresight should get a long way, and a
// player doing nothing at all should not.
//
// The bot is deliberately dumb — see an obstacle, react to it — so what it
// reaches is close to a floor on what a human can reach. If a tuning change
// drops it, the run got unfair rather than harder.

import { RunnerGame } from '../RunnerGame';
import { Obstacle } from '../entities/Obstacle';
import { Player } from '../entities/Player';
import { FlyingEnemy } from '../entities/FlyingEnemy';
import { HoverEnemy } from '../entities/HoverEnemy';
import { initGame, Harness } from '@/games/shared/gameTestHarness';

interface BossView {
  position: { x: number; y: number };
  size: { x: number; y: number };
  getPhase(): string;
  isDefeated(): boolean;
}

interface RunnerInternals {
  gameState: string;
  distance: number;
  gameSpeed: number;
  groundY: number;
  lives: number;
  themeLevel: number;
  bossesDefeated: number;
  obstacles: (Obstacle & { size: { x: number } })[];
  flyingEnemies: FlyingEnemy[];
  hoverEnemies: HoverEnemy[];
  player: Player;
  boss: BossView | null;
  bossProjectiles: { position: { x: number; y: number } }[];
  groundPounds: { position: { x: number; y: number } }[];
}

interface InputStubs {
  isActionPressed: jest.Mock;
  isDownPressed: jest.Mock;
  isUpPressed: jest.Mock;
  isLeftPressed: jest.Mock;
  isRightPressed: jest.Mock;
}

function wire(): { h: Harness; g: RunnerInternals; input: InputStubs } {
  const h = initGame(new RunnerGame());
  const g = h.game as unknown as RunnerInternals;
  g.gameState = 'playing';
  return { h, g, input: h.services.input as unknown as InputStubs };
}

/** What the bot intends this frame. */
interface Intent {
  jump: boolean;
  slide: boolean;
  left: boolean;
  right: boolean;
}

const IDLE: Intent = { jump: false, slide: false, left: false, right: false };

/**
 * Reflex rules, in priority order:
 *
 *  1. a hanging barrier inside the reaction window -> slide
 *  2. anything else inside the reaction window     -> jump, holding for tall
 *     hazards and pits so the arc clears them
 *
 * The window is measured in SECONDS of travel, not pixels, so the bot reacts
 * at the same moment however fast the world is moving — which is exactly the
 * property the spawn scheduler is supposed to preserve.
 */
function decide(g: RunnerInternals, holdFramesLeft: number): Intent {
  const pxPerSecond = 200 * g.gameSpeed;
  const playerRight = g.player.position.x + 32;

  const within = (x: number, seconds: number): boolean => {
    const lead = x - playerRight;
    return lead > -14 && lead < pxPerSecond * seconds;
  };

  if (holdFramesLeft > 0) return { ...IDLE, jump: true };

  // Boss fight: line up on the boss's flank — outside the inset body box —
  // then jump and drift in over the wide top. That is the intended answer, so
  // a bot that can execute it is evidence the fight is winnable.
  if (g.boss && !g.boss.isDefeated() && g.boss.getPhase() !== 'intro') {
    const boss = g.boss;

    for (const p of g.bossProjectiles) {
      if (within(p.position.x, 0.18)) return { ...IDLE, slide: true };
    }
    for (const gp of g.groundPounds) {
      if (within(gp.position.x, 0.25)) return { ...IDLE, jump: true };
    }

    if (!g.player.getIsGrounded()) return { ...IDLE, right: true };

    const flankX = boss.position.x - 10;
    const offset = flankX - (g.player.position.x + 16);
    if (Math.abs(offset) > 14) {
      return { ...IDLE, left: offset < 0, right: offset > 0 };
    }
    // Reachable means the boss's top edge is inside the measured jump arc.
    return { ...IDLE, jump: g.groundY - boss.position.y < 190 };
  }

  for (const o of g.obstacles) {
    if (o.type === 'high-barrier') {
      // Stay down until the whole barrier is past, not just its leading edge.
      const lead = o.position.x - playerRight;
      if (lead > -(o.size.x + 40) && lead < pxPerSecond * 0.2) {
        return { ...IDLE, slide: true };
      }
      continue;
    }
    if (within(o.position.x, 0.3)) return { ...IDLE, jump: true };
  }

  for (const e of g.hoverEnemies) {
    if (within(e.position.x, 0.28)) return { ...IDLE, jump: true };
  }
  for (const e of g.flyingEnemies) {
    // Flyers dive through the jump arc, so duck rather than jump into them.
    if (within(e.position.x, 0.2)) return { ...IDLE, slide: true };
  }

  return IDLE;
}

/** Drive a run to its end (or the frame budget) and report what happened. */
function playRun(maxFrames: number): {
  distance: number;
  stage: number;
  bosses: number;
  ended: boolean;
} {
  const { h, g, input } = wire();
  let jump = false;
  let slide = false;
  let left = false;
  let right = false;
  let holdFrames = 0;

  input.isActionPressed.mockImplementation(() => jump);
  input.isDownPressed.mockImplementation(() => slide);
  input.isLeftPressed.mockImplementation(() => left);
  input.isRightPressed.mockImplementation(() => right);

  let frames = 0;
  for (; frames < maxFrames; frames++) {
    if (g.gameState !== 'playing' && g.gameState !== 'boss-victory') break;

    if (g.gameState === 'playing') {
      const intent = decide(g, holdFrames);
      // Hold the jump for a few frames to get the tall arc, then release so
      // the next press is a fresh edge.
      if (intent.jump && holdFrames === 0) holdFrames = 12;
      else if (holdFrames > 0) holdFrames--;
      jump = intent.jump && holdFrames > 0;
      slide = intent.slide;
      left = intent.left;
      right = intent.right;
    } else {
      jump = false;
      slide = false;
      left = false;
      right = false;
    }

    h.game.update(1 / 60);
  }

  return {
    distance: g.distance,
    stage: g.themeLevel + 1,
    bosses: g.bossesDefeated,
    ended: g.gameState !== 'playing' && g.gameState !== 'boss-victory',
  };
}

describe('a competent player gets a real run', () => {
  it('carries a reflex bot well past the opening stage', () => {
    // Three minutes of frames is plenty for the bot to either get somewhere
    // or fall over early.
    const run = playRun(60 * 180);

    // Before the tuning pass this bot could not get past the first boss at
    // all: the fight's damage box reached the floor, and boss contact ignored
    // the post-hit invulnerability window, so three lives went in a fifth of a
    // second. It now clears at least one boss on essentially every run.
    expect(run.distance).toBeGreaterThan(4000);
    expect(run.bosses).toBeGreaterThanOrEqual(1);
    expect(run.stage).toBeGreaterThanOrEqual(2);
  });

  it('is not a walkover either — doing nothing ends the run', () => {
    const { h, g, input } = wire();
    input.isActionPressed.mockReturnValue(false);
    input.isDownPressed.mockReturnValue(false);

    let frames = 0;
    for (; frames < 60 * 180; frames++) {
      if (g.gameState === 'stats-recap' || g.gameState === 'death-animation') break;
      h.game.update(1 / 60);
    }

    expect(g.gameState === 'stats-recap' || g.gameState === 'death-animation').toBe(true);
    // And it should take a little while — an instant death would mean the
    // opening spawned something unavoidable.
    expect(g.distance).toBeGreaterThan(200);
  });

  it('gives the player their three lives back on restart', () => {
    const { h, g } = wire();
    g.lives = 1;
    g.distance = 4000;
    g.themeLevel = 3;
    h.game.restart?.();

    expect(g.lives).toBe(3);
    expect(g.distance).toBe(0);
    expect(g.themeLevel).toBe(0);
    expect(g.gameState).toBe('menu');
  });
});
