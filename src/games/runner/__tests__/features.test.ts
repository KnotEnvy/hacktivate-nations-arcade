// The stage features and the graze system.
//
// Both are new verbs rather than new art, so they get the same treatment as
// the rest of the runner's rules: pin what they promise, not what they are
// currently tuned to.

import { RunnerGame } from '../RunnerGame';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { StageFeature, FEATURE_FOR_THEME } from '../entities/StageFeature';
import { GrazeSystem } from '../systems/GrazeSystem';
import { ScorePopups } from '../systems/ScorePopups';
import { initGame, step, Harness } from '@/games/shared/gameTestHarness';

const GROUND_Y = 550;

interface RunnerInternals {
  gameState: string;
  groundY: number;
  distance: number;
  themeLevel: number;
  bonusScore: number;
  score: number;
  lives: number;
  obstacles: Obstacle[];
  stageFeatures: StageFeature[];
  player: Player;
  specialEventMeter: number;
  environmentSystem: { setTheme(i: number): void; getCurrentTheme(): string };
  spawnStageFeature(kind: string): void;
  checkCollisions(): void;
}

function startedGame(): { h: Harness; g: RunnerInternals } {
  const h = initGame(new RunnerGame());
  const g = h.game as unknown as RunnerInternals;
  g.gameState = 'playing';
  return { h, g };
}

describe('every stage past the first has a verb of its own', () => {
  it('gives four of the five stages a distinct feature, and stage 1 none', () => {
    // Stage 1 teaches the basics, so it deliberately has nothing extra.
    expect(FEATURE_FOR_THEME.day).toBeUndefined();

    const kinds = [
      FEATURE_FOR_THEME.sunset,
      FEATURE_FOR_THEME.night,
      FEATURE_FOR_THEME.desert,
      FEATURE_FOR_THEME.forest,
    ];
    expect(kinds.every(Boolean)).toBe(true);
    // All different: a reskinned mechanic would defeat the point.
    expect(new Set(kinds).size).toBe(4);
  });

  it('only spawns the feature belonging to the current stage', () => {
    const { h, g } = startedGame();
    g.environmentSystem.setTheme(4); // forest
    g.themeLevel = 4;
    g.stageFeatures = [];
    g.distance = 1200;

    step(h, 3000);

    expect(g.stageFeatures.every(f => f.kind === 'bounce')).toBe(true);
  });
});

describe('the bounce pad', () => {
  it('launches a descending player harder than any jump, and refunds the jump', () => {
    const { g } = startedGame();
    g.groundY = GROUND_Y;
    g.stageFeatures = [];
    g.spawnStageFeature('bounce');
    const pad = g.stageFeatures[0];
    pad.position.x = 100;

    // Measure the best a normal jump can do, for comparison.
    const jumper = new Player(100, GROUND_Y - 32, GROUND_Y, 800);
    jumper.update(1 / 60, false);
    jumper.update(1 / 60, true);
    const bestJump = jumper.velocity.y;

    // Drop the runner onto the cap.
    g.player.position.x = 100;
    // Feet just inside the cap: the pad only fires on a descent onto its top.
    g.player.position.y = pad.getTopY() - 30;
    g.player.velocity.y = 6;
    g.checkCollisions();

    expect(g.player.velocity.y).toBeLessThan(bestJump);
    expect(g.player.getIsGrounded()).toBe(false);
    // The launch hands the air jump back, so the pad opens a route rather
    // than ending one.
    expect(g.player.getJumpsRemaining()).toBeGreaterThan(0);
  });

  it('ignores a player who is rising into it', () => {
    const { g } = startedGame();
    g.groundY = GROUND_Y;
    g.stageFeatures = [];
    g.spawnStageFeature('bounce');
    const pad = g.stageFeatures[0];
    pad.position.x = 100;

    g.player.position.x = 100;
    g.player.position.y = pad.getTopY() - 10;
    g.player.velocity.y = -6;
    const before = g.player.velocity.y;
    g.checkCollisions();

    expect(g.player.velocity.y).toBe(before);
  });
});

describe('the geyser', () => {
  it('is harmless while dormant and dangerous only while erupting', () => {
    const feature = new StageFeature(100, GROUND_Y, 'geyser');
    const seen = new Set<string>();
    let dangerousOnlyWhenErupting = true;

    for (let i = 0; i < 600; i++) {
      feature.update(1 / 60, 0); // hold it in place
      const phase = feature.geyserPhase();
      seen.add(phase);
      if (feature.isDangerous() && phase !== 'erupt') {
        dangerousOnlyWhenErupting = false;
      }
    }

    // It cycles through all three, so there is always a safe window and
    // always a warning before the dangerous one.
    expect(seen.has('sleep')).toBe(true);
    expect(seen.has('warn')).toBe(true);
    expect(seen.has('erupt')).toBe(true);
    expect(dangerousOnlyWhenErupting).toBe(true);
  });

  it('warns before it fires, never without notice', () => {
    const feature = new StageFeature(100, GROUND_Y, 'geyser');
    let previous = feature.geyserPhase();
    let eruptionsSeen = 0;

    for (let i = 0; i < 1200; i++) {
      feature.update(1 / 60, 0);
      const phase = feature.geyserPhase();
      if (phase === 'erupt' && previous !== 'erupt') {
        eruptionsSeen++;
        // The only state an eruption may follow is the warning.
        expect(previous).toBe('warn');
      }
      previous = phase;
    }

    expect(eruptionsSeen).toBeGreaterThan(0);
  });
});

describe('the updraft and the gust', () => {
  it('lifts a player inside the column without firing them off screen', () => {
    const { g } = startedGame();
    g.groundY = GROUND_Y;
    g.stageFeatures = [];
    g.spawnStageFeature('updraft');
    const vent = g.stageFeatures[0];
    vent.position.x = 90;

    g.player.position.x = 100;
    g.player.position.y = GROUND_Y - 60;
    g.player.velocity.y = 2;

    for (let i = 0; i < 120; i++) g.checkCollisions();

    expect(g.player.velocity.y).toBeLessThan(0);
    // Capped, so the column is a ride and not a cannon.
    expect(g.player.velocity.y).toBeGreaterThanOrEqual(-8);
  });

  it('pushes a player left, and never off the left edge of the world', () => {
    const { g } = startedGame();
    g.groundY = GROUND_Y;
    g.stageFeatures = [];
    g.spawnStageFeature('gust');
    const gust = g.stageFeatures[0];
    // Park the wall over the runner; it is not stepped, so it stays put.
    gust.position.x = 250;

    g.player.position.x = 300;
    const startX = g.player.position.x;
    for (let i = 0; i < 400; i++) g.checkCollisions();

    expect(g.player.position.x).toBeLessThan(startX);
    expect(g.player.position.x).toBeGreaterThanOrEqual(0);
  });
});

describe('near misses', () => {
  const box = (x: number, y: number, w = 20, h = 20) => ({
    getBounds: () => new Obstacle(x, y, 'spike').getBounds(),
    x,
    y,
    w,
    h,
  });

  it('pays for passing close, and not for touching', () => {
    const grazes = new GrazeSystem();
    const player = new Player(100, GROUND_Y - 32, GROUND_Y, 800);
    const bounds = player.getBounds();

    // Directly on top of the player: a hit, not a graze.
    const touching = new Obstacle(bounds.x, bounds.y, 'spike');
    expect(grazes.check(bounds, [touching]).hits).toHaveLength(0);

    // Just outside the hitbox but inside the band.
    const close = new Obstacle(bounds.right + 6, bounds.y, 'spike');
    expect(grazes.check(bounds, [close]).hits).toHaveLength(1);

    // Far away: nothing.
    const far = new Obstacle(bounds.right + 400, bounds.y, 'spike');
    expect(grazes.check(bounds, [far]).hits).toHaveLength(0);
    void box;
  });

  it('only pays once per hazard', () => {
    const grazes = new GrazeSystem();
    const player = new Player(100, GROUND_Y - 32, GROUND_Y, 800);
    const bounds = player.getBounds();
    const close = new Obstacle(bounds.right + 6, bounds.y, 'spike');

    expect(grazes.check(bounds, [close]).hits).toHaveLength(1);
    // Still adjacent on the next frame, but already claimed.
    expect(grazes.check(bounds, [close]).hits).toHaveLength(0);
  });

  it('pays more for a chain, but not without limit', () => {
    const grazes = new GrazeSystem();
    expect(grazes.valueFor(2)).toBeGreaterThan(grazes.valueFor(1));
    expect(grazes.valueFor(50)).toBe(grazes.valueFor(500));
  });

  it('drops the chain once the window lapses', () => {
    const grazes = new GrazeSystem();
    const player = new Player(100, GROUND_Y - 32, GROUND_Y, 800);
    const bounds = player.getBounds();

    grazes.check(bounds, [new Obstacle(bounds.right + 6, bounds.y, 'spike')]);
    expect(grazes.getStreak()).toBe(1);

    for (let i = 0; i < 60 * 4; i++) grazes.update(1 / 60);
    expect(grazes.getStreak()).toBe(0);
  });
});

describe('score is more than distance now', () => {
  it('counts what the player does, not only how far they got', () => {
    const { h, g } = startedGame();
    step(h, 60);
    const distanceOnly = Math.floor(g.distance / 10);
    expect(g.score).toBe(distanceOnly);

    g.bonusScore += 500;
    step(h, 1);
    expect(g.score).toBeGreaterThan(Math.floor(g.distance / 10));
  });
});

describe('score popups', () => {
  it('expire, and never pile up without bound', () => {
    const popups = new ScorePopups();
    for (let i = 0; i < 200; i++) popups.add(10, 10, '+1', 'coin');
    expect(popups.count).toBeLessThanOrEqual(24);

    for (let i = 0; i < 180; i++) popups.update(1 / 60);
    expect(popups.count).toBe(0);
  });
});
