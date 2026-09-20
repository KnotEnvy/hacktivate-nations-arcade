// ===== src/games/runner/systems/Director.ts =====
//
// What the run throws at the player, and when.
//
// This is deliberately separate from RunnerGame. It holds the difficulty
// curve, the spawn clock and the pattern table — the three things most likely
// to need retuning — with no knowledge of entities, rendering or collision. It
// asks for spawns through a small interface the game implements.
//
// The one rule the whole file exists to protect: SPAWNS ARE SCHEDULED IN
// SECONDS, then converted to distance. Obstacles travel at `200 * speed` px/s
// while the odometer climbs at `100 * speed` units/s, so a gap measured in
// distance units silently shrinks in real time as the run speeds up. The
// original scheduler made that worse by subtracting a speed factor from the
// gap, which is how late runs ended up throwing hazards closer together than
// a jump could clear.

import { ObstacleType } from '../entities/Obstacle';
import { StageFeatureKind } from '../entities/StageFeature';

/** Everything the director can ask the game to put on screen. */
export interface SpawnApi {
  spawnObstacle(offset: number, type: ObstacleType): void;
  spawnCoinArc(offset: number, count: number, spread?: number): void;
  spawnLowCoins(offset: number, count: number): void;
  spawnPowerUp(): void;
  spawnFlyingEnemy(): void;
  spawnHoverEnemy(): void;
  spawnStageFeature(kind: StageFeatureKind): void;
  /** True if a ground hazard sits within `range` px of the spawn edge. */
  groundBusy(range: number): boolean;
}

export interface DirectorState {
  distance: number;
  gameSpeed: number;
  tutorial: boolean;
  /** Which tutorial step is running, when `tutorial` is set. */
  tutorialStep: number;
  /** The stage's signature feature, or null for stage 1. */
  feature: StageFeatureKind | null;
}

export class Director {
  private nextObstacle = 0;
  private nextAerial = 0;
  private nextFeature = 0;

  /** How hard the run currently is: 0 at the start, approaching 1. */
  difficulty(distance: number): number {
    return 1 - Math.exp(-distance / 5000);
  }

  /** Distance the world covers in one second at the current speed. */
  unitsPerSecond(gameSpeed: number): number {
    return 100 * gameSpeed;
  }

  /**
   * Screen distance the runner needs to land, recover and jump again.
   * Derived from the jump arc rather than guessed, so it holds at any speed.
   */
  safeFollowUpGap(gameSpeed: number): number {
    // ~0.62s of travel: airtime on a tapped jump plus a beat to react.
    return 0.62 * this.unitsPerSecond(gameSpeed) * 2;
  }

  reset(): void {
    this.nextObstacle = 0;
    this.nextAerial = 0;
    this.nextFeature = 0;
  }

  /** Called once the run starts, and after any jump in the odometer. */
  rescheduleAll(state: DirectorState): void {
    this.scheduleObstacle(state);
    this.scheduleAerial(state);
    this.scheduleFeature(state);
  }

  /** Run the spawn clock for this frame. */
  update(state: DirectorState, api: SpawnApi): void {
    if (state.distance >= this.nextObstacle) {
      if (state.tutorial) this.tutorialPattern(state, api);
      else this.pattern(state, api);
      this.scheduleObstacle(state);
    }

    if (state.tutorial) return;

    if (state.distance >= this.nextAerial) {
      this.aerial(state, api);
      this.scheduleAerial(state);
    }

    if (state.distance >= this.nextFeature) {
      if (state.feature && !api.groundBusy(190)) {
        api.spawnStageFeature(state.feature);
      }
      this.scheduleFeature(state);
    }
  }

  // ---------------------------------------------------------- scheduling --

  /**
   * The interval closes from 1.55s to 0.95s over the run — pressure the
   * player can feel, without ever dropping under the time a jump takes.
   */
  private scheduleObstacle(state: DirectorState): void {
    const d = this.difficulty(state.distance);
    const seconds = 1.55 - d * 0.6 + Math.random() * 0.45;
    this.nextObstacle =
      state.distance +
      Math.max(0.9, seconds) * this.unitsPerSecond(state.gameSpeed);
  }

  private scheduleAerial(state: DirectorState): void {
    const d = this.difficulty(state.distance);
    const seconds = 3.2 - d * 1.1 + Math.random() * 1.4;
    this.nextAerial =
      state.distance +
      Math.max(1.5, seconds) * this.unitsPerSecond(state.gameSpeed);
  }

  private scheduleFeature(state: DirectorState): void {
    // Rare enough to stay an event, frequent enough to be the stage's
    // signature rather than a curiosity.
    const seconds = 7 + Math.random() * 6;
    this.nextFeature =
      state.distance + seconds * this.unitsPerSecond(state.gameSpeed);
  }

  // ------------------------------------------------------------ patterns --

  /**
   * One deliberate hazard arrangement, rather than a die roll per obstacle.
   *
   * Every pattern has a known answer: jump it, slide it, or jump the pit. The
   * spacing inside a pattern is chosen so the answer stays available — a
   * second blocker never lands inside the first one's landing window.
   */
  private pattern(state: DirectorState, api: SpawnApi): void {
    const d = this.difficulty(state.distance);
    const far = state.distance;
    const roll = Math.random();

    // Before 300m it is only single blockers, so the first thirty seconds
    // teach the basic jump.
    if (far < 300) {
      api.spawnObstacle(50, 'cactus');
      if (Math.random() < 0.7) api.spawnCoinArc(140, 3);
      return;
    }

    // Two spike beds ABUTTING, read as one wide hazard.
    if (roll < 0.14 + d * 0.1 && far > 900) {
      api.spawnObstacle(50, 'spike');
      api.spawnObstacle(86, 'spike');
      api.spawnCoinArc(70, 3, 84);
      return;
    }

    // Slide gate, with coins underneath as the reward for committing.
    if (roll < 0.34 && far > 500) {
      api.spawnObstacle(50, 'high-barrier');
      api.spawnLowCoins(60, 3);
      return;
    }

    // Pit: jump it. Coins arc over the hole.
    if (roll < 0.5 && far > 700) {
      api.spawnObstacle(50, 'gap');
      api.spawnCoinArc(90, 4, 66);
      return;
    }

    // Blocker then pit, far enough apart to land and re-jump.
    if (roll < 0.6 && far > 1600) {
      api.spawnObstacle(50, 'cactus');
      api.spawnObstacle(50 + this.safeFollowUpGap(state.gameSpeed), 'gap');
      return;
    }

    // Barrier then blocker: slide, stand, jump. The only pattern that asks
    // for two different moves in sequence, so it is held back until the
    // player has had time to learn both.
    if (roll < 0.68 && far > 2400) {
      api.spawnObstacle(50, 'high-barrier');
      api.spawnObstacle(50 + this.safeFollowUpGap(state.gameSpeed), 'cactus');
      api.spawnLowCoins(60, 2);
      return;
    }

    // Spike bed.
    if (roll < 0.8) {
      api.spawnObstacle(50, 'spike');
      if (Math.random() < 0.6) api.spawnCoinArc(120, 3);
      return;
    }

    // Plain blocker, the bread and butter.
    api.spawnObstacle(50, 'cactus');
    if (Math.random() < 0.55) api.spawnCoinArc(130, 3);

    // Power-ups thin out as the player gets deeper, so they stay a treat.
    if (Math.random() < 0.16 && far > 300) api.spawnPowerUp();
  }

  /** The tutorial spawns exactly the hazard the current step is teaching. */
  private tutorialPattern(state: DirectorState, api: SpawnApi): void {
    switch (state.tutorialStep) {
      case 0:
        api.spawnObstacle(50, 'cactus');
        if (Math.random() < 0.6) api.spawnCoinArc(140, 3);
        break;
      case 1:
        // Barriers, so "hold DOWN to slide" has something to slide under.
        api.spawnObstacle(50, 'high-barrier');
        api.spawnLowCoins(60, 2);
        break;
      default:
        if (Math.random() < 0.5) api.spawnObstacle(50, 'cactus');
        api.spawnCoinArc(120, 4);
        break;
    }
  }

  /**
   * Aerials, placed so they never land on top of a ground hazard the player
   * is already committed to jumping. Flyers cruise at jump-apex height, so
   * one over a forced jump puts an enemy exactly where the player must go.
   */
  private aerial(state: DirectorState, api: SpawnApi): void {
    const d = this.difficulty(state.distance);
    if (api.groundBusy(150)) return;

    if (state.distance > 500 && Math.random() < 0.35 + d * 0.25) {
      api.spawnFlyingEnemy();
      return;
    }

    if (state.distance > 800 && Math.random() < 0.3 + d * 0.25) {
      api.spawnHoverEnemy();
    }
  }
}
