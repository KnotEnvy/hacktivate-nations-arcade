// Fairness invariants for Endless Runner.
//
// These pin the rules that make the run survivable rather than the exact
// numbers it is tuned to. Each one corresponds to a bug that was live before
// the polish pass:
//
//   * spawn intervals SHRANK in real time as the run sped up, eventually
//     placing hazards closer together than a jump arc
//   * the "slide under it" barrier overlapped a sliding player's hitbox, so
//     the move the tutorial teaches did not work
//   * the pit's hazard band started exactly on the ground line, and
//     Rectangle.intersects is strict, so pits were harmless
//   * game speed had no ceiling

import { RunnerGame } from '../RunnerGame';
import { Obstacle } from '../entities/Obstacle';
import { Player } from '../entities/Player';
import { HoverEnemy } from '../entities/HoverEnemy';
import { Boss } from '../entities/Boss';
import { Director, DirectorState, SpawnApi } from '../systems/Director';
import { initGame, step, Harness } from '@/games/shared/gameTestHarness';

/** The private surface these tests reach through. */
interface RunnerInternals {
  gameState: string;
  distance: number;
  gameSpeed: number;
  groundY: number;
  lives: number;
  obstacles: Obstacle[];
  player: Player;
  hoverEnemies: HoverEnemy[];
  pickups: number;
  enemiesStomped: number;
  spawnObstacle(offset: number, type: string): void;
  stompHoverEnemy(enemy: HoverEnemy): void;
}

function internals(h: Harness): RunnerInternals {
  return h.game as unknown as RunnerInternals;
}

function startedGame(): { h: Harness; g: RunnerInternals } {
  const h = initGame(new RunnerGame());
  const g = internals(h);
  g.gameState = 'playing';
  return { h, g };
}

const GROUND_Y = 550;

describe('spawn timing stays fair as the run speeds up', () => {
  /**
   * These target Director directly. The rule they protect lives there, and
   * driving it in isolation covers the whole plausible range of a run far
   * more thoroughly than stepping a live game could.
   */
  const stateAt = (distance: number): DirectorState => ({
    distance,
    gameSpeed: 1 + 2.1 * (1 - Math.exp(-distance / 5200)),
    tutorial: false,
    tutorialStep: 0,
    feature: null,
  });

  /** A SpawnApi that records nothing — we only care about the clock. */
  const silentApi = (): SpawnApi => ({
    spawnObstacle: () => {},
    spawnCoinArc: () => {},
    spawnLowCoins: () => {},
    spawnPowerUp: () => {},
    spawnFlyingEnemy: () => {},
    spawnHoverEnemy: () => {},
    spawnStageFeature: () => {},
    groundBusy: () => false,
  });

  /** Seconds between this spawn and the next, at a given distance. */
  const gapSeconds = (director: Director, state: DirectorState): number => {
    const api = silentApi();
    director.update(state, api);
    const internals = director as unknown as { nextObstacle: number };
    return (
      (internals.nextObstacle - state.distance) /
      director.unitsPerSecond(state.gameSpeed)
    );
  };

  it('never schedules two hazards less than 0.9s apart, at any distance', () => {
    for (let distance = 0; distance <= 40000; distance += 250) {
      const state = stateAt(distance);
      for (let sample = 0; sample < 25; sample++) {
        const director = new Director();
        expect(gapSeconds(director, state)).toBeGreaterThanOrEqual(0.9);
      }
    }
  });

  it('holds the interval in SECONDS rather than in distance units', () => {
    const sampleAt = (distance: number): number => {
      const state = stateAt(distance);
      let total = 0;
      for (let i = 0; i < 400; i++) {
        total += gapSeconds(new Director(), state);
      }
      return total / 400;
    };

    const early = sampleAt(200);
    const late = sampleAt(30000);

    // It tightens with difficulty, but only within the designed band — the
    // old scheduler let this fall without limit.
    expect(late).toBeLessThan(early);
    expect(late).toBeGreaterThan(1.0);
    expect(early).toBeLessThan(2.0);
  });

  it('caps game speed however far the player gets', () => {
    const { h, g } = startedGame();
    g.distance = 500000;
    step(h, 1);
    expect(g.gameSpeed).toBeLessThanOrEqual(3.2);
  });
});

describe('every hazard has a working answer', () => {
  const standing = (): Player => new Player(100, GROUND_Y - 32, GROUND_Y, 800);

  it('lets a sliding player under a hanging barrier, and stops a standing one', () => {
    const { g } = startedGame();
    g.groundY = GROUND_Y;
    g.obstacles = [];
    g.spawnObstacle(0, 'high-barrier');
    const barrier = g.obstacles[0];
    // Obstacles spawn off the right edge — slide it onto the runner.
    barrier.position.x = 100;

    const upright = standing();
    expect(upright.getBounds().intersects(barrier.getBounds())).toBe(true);

    const sliding = standing();
    sliding.startSlide();
    expect(sliding.getBounds().intersects(barrier.getBounds())).toBe(false);
  });

  it('makes a pit hurt a grounded runner and spare a jumping one', () => {
    const { g } = startedGame();
    g.groundY = GROUND_Y;
    g.obstacles = [];
    g.spawnObstacle(0, 'gap');
    const pit = g.obstacles[0];
    pit.position.x = 100;
    // The pit's band has to line up with where it is drawn.
    expect(pit.getBounds().top).toBeLessThan(GROUND_Y);

    const grounded = standing();
    expect(grounded.getBounds().intersects(pit.getBounds())).toBe(true);

    const airborne = standing();
    airborne.position.y = GROUND_Y - 90;
    expect(airborne.getBounds().intersects(pit.getBounds())).toBe(false);
  });

  it('keeps a blocker clear of a sliding player only when jumped', () => {
    const { g } = startedGame();
    g.groundY = GROUND_Y;
    g.obstacles = [];
    g.spawnObstacle(0, 'cactus');
    const blocker = g.obstacles[0];
    blocker.position.x = 100;

    const sliding = standing();
    sliding.startSlide();
    // Sliding must NOT be a universal dodge — a blocker still stops it.
    expect(sliding.getBounds().intersects(blocker.getBounds())).toBe(true);

    const airborne = standing();
    airborne.position.y = GROUND_Y - 80;
    expect(airborne.getBounds().intersects(blocker.getBounds())).toBe(false);
  });
});

describe('the tutorial teaches what it claims', () => {
  it('spawns barriers to slide under on the slide step', () => {
    const { h, g } = startedGame();
    const t = g as unknown as {
      gameState: string;
      tutorialProgress: { currentStep: number };
      obstacles: Obstacle[];
          distance: number;
    };
    t.gameState = 'tutorial';
    t.tutorialProgress.currentStep = 1;
    t.obstacles = [];

    // Run long enough for several spawn cycles.
    step(h, 900);

    // The step says "hold DOWN to slide under the hanging barriers". Before
    // the polish pass the tutorial only ever spawned blockers, so the
    // instruction referred to something that was never on screen.
    const kinds = new Set(t.obstacles.map(o => o.type));
    expect(t.obstacles.length).toBeGreaterThan(0);
    expect(kinds.has('high-barrier')).toBe(true);
  });

  it('opens with plain blockers on the jump step', () => {
    const { h, g } = startedGame();
    const t = g as unknown as {
      gameState: string;
      tutorialProgress: { currentStep: number };
      obstacles: Obstacle[];
    };
    t.gameState = 'tutorial';
    t.tutorialProgress.currentStep = 0;
    t.obstacles = [];

    step(h, 900);

    // Nothing that needs a move the player has not been taught yet.
    for (const o of t.obstacles) {
      expect(['cactus']).toContain(o.type);
    }
  });
});

describe('player forgiveness windows', () => {
  it('still allows a jump just after leaving the ground (coyote time)', () => {
    const player = new Player(100, GROUND_Y - 32, GROUND_Y, 800);
    // Settle on the floor so the coyote window is armed.
    player.update(1 / 60, false);
    expect(player.getIsGrounded()).toBe(true);

    // Walk off an edge: drop the floor away and fall for a couple of frames
    // without touching the jump button.
    player.position.y = GROUND_Y - 60;
    player.update(1 / 60, false);
    player.update(1 / 60, false);
    expect(player.getIsGrounded()).toBe(false);

    const before = player.velocity.y;
    player.update(1 / 60, true);
    // A jump landed: vertical velocity flipped hard upward.
    expect(player.velocity.y).toBeLessThan(before);
    expect(player.velocity.y).toBeLessThan(-5);
  });

  it('fires a jump pressed just before landing (input buffering)', () => {
    const player = new Player(100, GROUND_Y - 32, GROUND_Y, 800);

    // Spend the one jump so the press below cannot be an air jump.
    player.update(1 / 60, false);
    player.update(1 / 60, true);
    expect(player.getJumpsRemaining()).toBe(0);
    player.update(1 / 60, false);

    // Fall back down, and tap once in the last moments before touchdown.
    let pressedAt = -1;
    let landedAt = -1;
    for (let i = 0; i < 300; i++) {
      const aboutToLand =
        player.velocity.y > 0 && player.position.y > GROUND_Y - 62;
      const press = aboutToLand && pressedAt < 0;
      if (press) pressedAt = i;
      player.update(1 / 60, press);
      if (player.getIsGrounded()) {
        landedAt = i;
        break;
      }
    }

    expect(pressedAt).toBeGreaterThanOrEqual(0);
    expect(landedAt).toBeGreaterThan(pressedAt);

    // The buffered press is spent on touchdown, so the runner leaves again
    // rather than sticking to the floor.
    player.update(1 / 60, false);
    expect(player.velocity.y).toBeLessThan(0);
  });

  it('keeps the jump arc the same at 30fps and 144fps', () => {
    const peakAt = (dt: number): number => {
      const player = new Player(100, GROUND_Y - 32, GROUND_Y, 800);
      player.update(dt, false);
      let peak = player.position.y;
      // Hold the button for the full variable-height window.
      for (let t = 0; t < 1.2; t += dt) {
        player.update(dt, t < 0.25);
        peak = Math.min(peak, player.position.y);
      }
      return GROUND_Y - 32 - peak;
    };

    const slow = peakAt(1 / 30);
    const fast = peakAt(1 / 144);
    // Within a few pixels: the arc is dt-scaled, not per-frame.
    expect(Math.abs(slow - fast)).toBeLessThan(8);
  });
});

describe('stomping a hover drone', () => {
  it('pops the drone and pays out instead of costing a life', () => {
    const { g } = startedGame();
    const livesBefore = g.lives;
    const coinsBefore = g.pickups;

    const drone = new HoverEnemy(200, GROUND_Y - 84, 'day');
    g.hoverEnemies = [drone];
    g.stompHoverEnemy(drone);

    expect(drone.isPopped()).toBe(true);
    expect(g.lives).toBe(livesBefore);
    expect(g.pickups).toBeGreaterThan(coinsBefore);
    expect(g.enemiesStomped).toBe(1);
    // The bounce is what makes a stomp feel like a stomp.
    expect(g.player.velocity.y).toBeLessThan(0);

    // And it clears itself away once the pop has played.
    for (let i = 0; i < 40; i++) drone.update(1 / 60, 1);
    expect(drone.isGone()).toBe(true);
    expect(drone.isOffScreen()).toBe(true);
  });
});

describe('bosses stay inside the jump arc', () => {
  /** How high a full-hold jump actually lifts the runner, measured not guessed. */
  function measuredJumpPeak(): number {
    const player = new Player(100, GROUND_Y - 32, GROUND_Y, 800);
    player.update(1 / 60, false);
    let peak = player.position.y;
    for (let t = 0; t < 1.2; t += 1 / 60) {
      player.update(1 / 60, t < 0.25);
      peak = Math.min(peak, player.position.y);
    }
    // The runner's FEET at the top of the arc.
    return GROUND_Y - (peak + 32);
  }

  it.each([0, 1, 2, 3, 4])(
    'boss %i dips low enough to be stomped and never sinks into the floor',
    themeLevel => {
      const boss = new Boss(900, GROUND_Y, themeLevel);
      const peak = measuredJumpPeak();

      let lowestTop = -Infinity;
      let deepestBottom = -Infinity;
      // Long enough to cover several full hover cycles past the intro.
      for (let i = 0; i < 1200; i++) {
        boss.update(1 / 60, 1);
        if (boss.getPhase() === 'intro') continue;
        lowestTop = Math.max(lowestTop, boss.position.y);
        deepestBottom = Math.max(deepestBottom, boss.position.y + boss.size.y);
      }

      // Reachable: at the bottom of its wave the boss's top edge is within
      // the arc the player can actually reach.
      expect(GROUND_Y - lowestTop).toBeLessThan(peak);
      // And its underside stays clear of a standing runner's head, so there
      // is somewhere to stand while lining the stomp up.
      const standingTop = GROUND_Y - 30;
      expect(deepestBottom).toBeLessThan(standingTop);
    }
  );

  it('keeps part of the wave out of reach, so the fight has timing', () => {
    const boss = new Boss(900, GROUND_Y, 0);
    const peak = measuredJumpPeak();

    let highestTop = Infinity;
    for (let i = 0; i < 1200; i++) {
      boss.update(1 / 60, 1);
      if (boss.getPhase() === 'intro') continue;
      highestTop = Math.min(highestTop, boss.position.y);
    }
    expect(GROUND_Y - highestTop).toBeGreaterThan(peak);
  });
});

describe('the run holds together end to end', () => {
  it('survives a long unattended session without throwing', () => {
    const h = initGame(new RunnerGame());
    const g = internals(h);
    g.gameState = 'playing';
    // Five thousand frames covers theme changes, boss spawns and deaths.
    expect(() => step(h, 5000)).not.toThrow();
  });

  it('reports the stats the arcade reads back', () => {
    const h = initGame(new RunnerGame());
    internals(h).gameState = 'playing';
    step(h, 600);

    const result = h.game.getScore?.() as unknown as Record<string, unknown>;
    expect(result).toBeDefined();
    for (const key of [
      'score',
      'pickups',
      'distance',
      'jumps',
      'bossesDefeated',
      'enemiesStomped',
    ]) {
      expect(result).toHaveProperty(key);
    }
  });
});
