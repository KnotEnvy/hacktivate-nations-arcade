// Mini Breakout — a Floodlight court.
//
// One paddle, one wall of glass tiles, three LED rails. The run is a small
// state machine:
//
//   READY (ball rides the paddle, aim guide, auto-serve at 3s)
//     → PLAYING
//     → LOST beat (1.2s) → READY            … a serve is lost
//     → CLEAR beat (0.4s slow-mo + 1.6s) → READY on the next set
//     → GAMEOVER beat (1.6s) → endGame()    … the last serve is lost
//
// Physics lives in systems/physics.ts (substepped, so nothing tunnels at the
// loop's 0.05s dt clamp); layouts in systems/levels.ts; the chrome in
// systems/HudRenderer.ts. This file wires them together and owns the rules
// for scoring, streaks, power-ups and beats.

import { BaseGame } from '@/games/shared/BaseGame';
import { PressTracker } from '@/games/shared/input/PressTracker';
import { UI } from '@/games/shared/hud/canvasUi';
import type { GameManifest, GameScore } from '@/lib/types';
import {
  ARENA,
  BALL_FLASH_TIME,
  BRICK_DROP_TIME,
  BRICK_PITCH_X,
  BRICK_PITCH_Y,
  BRICK_RAMP,
  BRICK_SHAKE_TIME,
  BREAK_POINTS,
  BRICKS_PER_PICKUP,
  BUILD_START,
  CAPSULE_FALL,
  CAPSULE_H,
  CAPSULE_W,
  CARD_TIME,
  CATCH_TIME,
  CLEAR_BEAT,
  CLEAR_POINTS,
  CLEAR_POINTS_PER_LEVEL,
  COURT,
  CRACK_POINTS,
  DROP_CHANCE,
  GAMEOVER_BEAT,
  LOST_BEAT,
  MAX_BALLS,
  MAX_BALL_SPEED,
  MAX_LIVES,
  PADDLE_W,
  PADDLE_WIDE_W,
  RAIL_FLASH_TIME,
  RALLY_CAP,
  RALLY_GAIN,
  RETURN_ENGLISH,
  SERVE_ENGLISH,
  SERVE_TIMEOUT,
  SLOWMO_SCALE,
  SLOWMO_TIME,
  SLOW_SCALE,
  SLOW_TIME,
  SQUASH_TIME,
  START_LIVES,
  STREAK_COLORS,
  VIEW_H,
  WIDEN_TIME,
} from './constants';
import {
  type Ball,
  type Brick,
  type Capsule,
  type Paddle,
  type PowerType,
  makeBall,
  makePaddle,
} from './entities/types';
import {
  type CollisionHandlers,
  type RailSide,
  aimBall,
  launchAngle,
  moveBall,
  paddleOffset,
} from './systems/physics';
import { levelSpeed, makeBricks, requiredLeft } from './systems/levels';
import { Streak } from './systems/streak';
import {
  type ActivePowers,
  POWER_DEFS,
  noPowers,
  pickPower,
} from './systems/powerups';
import { PaddleController } from './systems/PaddleController';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { Sfx } from './systems/Sfx';
import { ArenaRenderer, type RailFlash } from './systems/ArenaRenderer';
import { BrickRenderer } from './systems/BrickRenderer';
import { EntityRenderer } from './systems/EntityRenderer';
import {
  type BannerState,
  COIN_TARGET,
  HudRenderer,
  type HudState,
} from './systems/HudRenderer';

export type BreakoutState = 'ready' | 'playing' | 'lost' | 'clear' | 'gameover';

const KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'KeyA',
  'KeyD',
  'Space',
  'Enter',
  'ArrowUp',
  'KeyW',
] as const;
const LAUNCH_KEYS = ['Space', 'Enter', 'ArrowUp', 'KeyW'] as const;
const HIGH_SCORE_KEY = 'breakout_high_score';

function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

export class BreakoutGame extends BaseGame {
  manifest: GameManifest = {
    id: 'breakout',
    title: 'Mini Breakout',
    thumbnail: '/games/breakout/breakout-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Break bricks with a paddle. Clear the board!',
  };

  protected renderBaseHud = false;

  private gameState: BreakoutState = 'ready';
  /** Seconds in the current state (real time). */
  private stateTime = 0;
  private level = 1;
  private lives = START_LIVES;
  private paddle: Paddle = makePaddle();
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private capsules: Capsule[] = [];
  private powers: ActivePowers = noPowers();
  private lastDrop: PowerType | null = null;
  private streak = new Streak();
  private highScore = 0;

  // Beats and washes.
  private serveWait = 0;
  /** Which way a dead-centre serve leans (±1), rolled per serve. */
  private serveLean = 1;
  private cardOpen = false;
  private cardAlpha = 0;
  private slowmo = 0;
  private flash = 0;
  private hurt = 0;
  private dim = 0;
  private banner: BannerState | null = null;
  private clearBonus = 0;
  private clearBeatStarted = false;
  private nextLayoutBuilt = false;
  private railFlashes: RailFlash[] = [];
  private shuttleClock = 0;
  private lastBreak = { x: 400, y: 200 };

  // Run stats. The key names in onGameEnd feed achievements; keep them.
  private bricksDestroyedThisGame = 0;
  private levelsCompletedThisGame = 0;
  private powerupsCollectedThisGame = 0;

  private tracker = new PressTracker();
  private controller = new PaddleController();
  private particles = new ParticleSystem();
  private shake = new ScreenShake();
  private sfx = new Sfx(() => this.services?.audio);
  private arena = new ArenaRenderer();
  private brickArt = new BrickRenderer();
  private art = new EntityRenderer();
  private hud = new HudRenderer();

  private handlers: CollisionHandlers = {
    wall: (side, x, y) => this.onRail(side, x, y),
    paddle: ball => this.onPaddle(ball),
    brick: (ball, brick) => this.onBrick(ball, brick),
  };

  // ======================================================= lifecycle ====

  protected onInit(): void {
    try {
      const s = localStorage.getItem(HIGH_SCORE_KEY);
      this.highScore = s ? parseInt(s, 10) || 0 : 0;
    } catch {
      this.highScore = 0;
    }
    this.arena.build();
    this.hud.build();
    this.resetRun();
  }

  protected onRestart(): void {
    this.resetRun();
  }

  /** Everything back to the first serve of a fresh run. */
  private resetRun(): void {
    this.level = 1;
    this.lives = START_LIVES;
    this.powers = noPowers();
    this.lastDrop = null;
    this.streak.clear();
    this.capsules = [];
    this.particles.clear();
    this.shake.stop();
    this.sfx.reset();
    this.tracker.reset();
    this.paddle = makePaddle();
    this.controller.reset(this.paddle);
    this.slowmo = 0;
    this.flash = 0;
    this.hurt = 0;
    this.dim = 0;
    this.banner = null;
    this.clearBonus = 0;
    this.clearBeatStarted = false;
    this.nextLayoutBuilt = false;
    this.railFlashes = [];
    this.shuttleClock = 0;
    this.bricksDestroyedThisGame = 0;
    this.levelsCompletedThisGame = 0;
    this.powerupsCollectedThisGame = 0;
    this.bricks = makeBricks(this.level, true);
    this.cardOpen = true;
    this.cardAlpha = 0;
    this.enterReady();
  }

  private enterReady(): void {
    this.gameState = 'ready';
    this.stateTime = 0;
    this.serveWait = 0;
    this.serveLean = Math.random() < 0.5 ? -1 : 1;
    this.streak.reset();
    this.balls = [this.ballOnPaddle(0, levelSpeed(this.level))];
  }

  private ballOnPaddle(offset: number, speed: number): Ball {
    const p = this.paddle;
    const b = makeBall(p.cx, p.y);
    b.stuck = true;
    b.stuckOffset = offset;
    b.speed = speed;
    b.x = p.cx + (offset * p.w) / 2;
    b.y = p.y - b.r - 0.5;
    return b;
  }

  // ========================================================== update ====

  protected onUpdate(dt: number): void {
    this.tracker.update(this.services.input, KEYS, dt);
    const sim = this.slowmo > 0 ? dt * SLOWMO_SCALE : dt;

    if (this.gameState !== 'gameover') {
      this.movePaddle(dt);
      this.moveShuttles(sim);
    }

    switch (this.gameState) {
      case 'ready':
        this.updateReady(dt);
        break;
      case 'playing':
        this.updatePlaying(dt, sim);
        break;
      case 'lost':
        this.stateTime += dt;
        if (this.stateTime >= LOST_BEAT) this.enterReady();
        break;
      case 'clear':
        this.updateClear(dt, sim);
        break;
      case 'gameover':
        this.stateTime += dt;
        this.dim = Math.min(1, this.stateTime / GAMEOVER_BEAT);
        if (this.stateTime >= GAMEOVER_BEAT) this.endGame();
        break;
    }

    this.updateEffects(dt, sim);
  }

  private launchPressed(): boolean {
    const t = this.tracker;
    return (
      t.anyJustPressed(LAUNCH_KEYS) ||
      (t.pointerJustPressed() && !t.isTouch()) ||
      (t.isTouch() && t.tapped())
    );
  }

  private movePaddle(dt: number): void {
    const p = this.paddle;
    const target = this.powers.widen > 0 ? PADDLE_WIDE_W : PADDLE_W;
    p.targetW = target;
    p.w += (target - p.w) * Math.min(1, dt * 10);
    this.controller.update(
      p,
      this.services.input,
      this.tracker,
      dt,
      ARENA.left,
      ARENA.right
    );
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.x = p.cx + (b.stuckOffset * p.w) / 2;
      b.y = p.y - b.r - 0.5;
    }
  }

  /**
   * The shuttle row slides BEFORE the balls move, so a brick that slides
   * onto a ball is resolved by this frame's collision pass instead of being
   * left overlapping it.
   */
  private moveShuttles(sim: number): void {
    this.shuttleClock += sim;
    for (const b of this.bricks) {
      if (b.drift > 0) {
        b.x = b.baseX + Math.sin(this.shuttleClock * 0.9) * b.drift;
      }
    }
  }

  private updateReady(dt: number): void {
    this.stateTime += dt;
    this.serveWait += dt;
    const launch = this.launchPressed();
    if (
      this.cardOpen &&
      (launch || this.controller.moved || this.stateTime >= CARD_TIME)
    ) {
      this.cardOpen = false;
    }
    if (launch || this.serveWait >= SERVE_TIMEOUT) {
      this.releaseStuck();
      this.gameState = 'playing';
      this.stateTime = 0;
    }
  }

  /** Send every riding ball off along its aim. */
  private releaseStuck(): void {
    const p = this.paddle;
    let any = false;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      any = true;
      b.stuck = false;
      b.stuckTime = 0;
      aimBall(
        b,
        launchAngle(b.stuckOffset, p.vx, SERVE_ENGLISH, this.serveLean),
        b.speed
      );
      b.y = p.y - b.r - 1;
      b.trail = [];
      this.particles.ring(b.x, b.y, 4, 26, COURT.mint, 0.25);
    }
    if (any) this.sfx.play('whoosh', this.gameTime, 0.1);
  }

  private updatePlaying(dt: number, sim: number): void {
    this.stateTime += dt;

    let stuck = false;
    let overdue = false;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      stuck = true;
      b.stuckTime += dt;
      if (b.stuckTime >= SERVE_TIMEOUT) overdue = true;
    }
    if (stuck && (this.launchPressed() || overdue || this.powers.catch <= 0)) {
      this.releaseStuck();
    }

    const ballDt = sim * (this.powers.slow > 0 ? SLOW_SCALE : 1);
    for (const b of this.balls) {
      moveBall(b, ballDt, ARENA, this.paddle, this.bricks, this.handlers);
    }

    if (requiredLeft(this.bricks) === 0) {
      this.startClear();
      return;
    }

    const before = this.balls.length;
    let lastOut: Ball | null = null;
    this.balls = this.balls.filter(b => {
      if (b.y - b.r <= VIEW_H) return true;
      lastOut = b;
      return false;
    });
    if (this.balls.length === 0 && before > 0) {
      this.loseServe(lastOut);
      return;
    }
    if (this.balls.length < before) {
      this.sfx.play('collision', this.gameTime, 0.1, 0.5);
    }

    this.updateCapsules(sim);
    this.powers.widen = Math.max(0, this.powers.widen - sim);
    this.powers.slow = Math.max(0, this.powers.slow - sim);
    this.powers.catch = Math.max(0, this.powers.catch - sim);
  }

  // ======================================================= collisions ====

  private onRail(side: RailSide, x: number, y: number): void {
    const pos = side === 'top' ? x : y;
    this.railFlashes.push({ side, pos, t: RAIL_FLASH_TIME });
    if (this.railFlashes.length > 8) this.railFlashes.shift();
    const dx = side === 'left' ? 1 : side === 'right' ? -1 : 0;
    const dy = side === 'top' ? 1 : 0;
    this.particles.sparks(x, y, COURT.mintBright, 3, dx, dy);
    this.sfx.play('bounce', this.gameTime, 0.06, 0.45);
  }

  private rallyCeiling(): number {
    return Math.min(MAX_BALL_SPEED, levelSpeed(this.level) * RALLY_CAP);
  }

  private onPaddle(ball: Ball): void {
    const p = this.paddle;
    const speed = Math.min(
      this.rallyCeiling(),
      Math.hypot(ball.vx, ball.vy) * (1 + RALLY_GAIN)
    );
    this.streak.reset();
    p.squash = SQUASH_TIME;
    ball.flash = BALL_FLASH_TIME;
    this.shake.shake(1 + (2.5 * speed) / MAX_BALL_SPEED, 0.08);
    this.particles.sparks(ball.x, p.y, COURT.mint, 4, 0, -1);
    this.sfx.play('bounce', this.gameTime, 0.04);

    if (this.powers.catch > 0) {
      ball.stuck = true;
      ball.stuckOffset = paddleOffset(ball, p) * 0.9;
      ball.stuckTime = 0;
      ball.speed = speed;
      ball.vx = 0;
      ball.vy = 0;
      ball.y = p.y - ball.r - 0.5;
      ball.trail = [];
      return;
    }
    // A centre hit keeps travelling the way it came rather than going dead
    // vertical (see MIN_OFF_VERTICAL).
    const lean = ball.vx < 0 ? -1 : 1;
    aimBall(
      ball,
      launchAngle(paddleOffset(ball, p), p.vx, RETURN_ENGLISH, lean),
      speed
    );
    ball.y = p.y - ball.r - 0.01;
  }

  private onBrick(ball: Ball, b: Brick): void {
    if (this.streak.hit()) {
      const m = this.streak.mult;
      this.particles.popup(
        ball.x,
        ball.y - 18,
        `STREAK x${m}`,
        STREAK_COLORS[m - 1],
        16
      );
    }
    b.shake = BRICK_SHAKE_TIME;
    b.flash = 0.1;

    if (this.powers.blast) {
      this.powers.blast = false;
      this.detonate(b);
      return;
    }
    if (b.armored && this.streak.mult < 3) {
      // Steel shrugs off anything below a x3 streak.
      this.particles.sparks(ball.x, ball.y, '#e3e8f3', 7);
      this.sfx.play('collision', this.gameTime, 0.05);
      return;
    }
    b.hp -= 1;
    if (b.hp > 0) {
      this.score += CRACK_POINTS;
      this.particles.sparks(ball.x, ball.y, b.color, 5);
      this.particles.popup(
        b.x + b.w / 2,
        b.y,
        `+${CRACK_POINTS}`,
        UI.inkMuted,
        11
      );
      this.sfx.play('hit', this.gameTime, 0.04);
      return;
    }
    this.breakBrick(b);
  }

  private breakBrick(b: Brick): void {
    b.alive = false;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    this.lastBreak = { x: cx, y: cy };
    this.bricksDestroyedThisGame += 1;
    const mult = this.streak.mult;
    const points = BREAK_POINTS * mult;
    this.score += points;
    if (this.bricksDestroyedThisGame % BRICKS_PER_PICKUP === 0) {
      this.pickups += 1;
      this.particles.coin(cx, cy, COIN_TARGET.x, COIN_TARGET.y);
    }
    this.particles.shards(cx, cy, b.w, b.h, b.color);
    this.particles.popup(
      cx,
      b.y - 2,
      `+${points}`,
      mult > 1 ? STREAK_COLORS[mult - 1] : '#ffffff',
      mult > 1 ? 14 : 12
    );
    this.sfx.play('success', this.gameTime, 0.05);
    this.shake.shake(3, 0.12);
    this.maybeDrop(b);
    this.services?.analytics?.trackFeatureUsage?.('breakout_brick_break', {
      level: this.level,
    });
  }

  /** BLAST: the brick that was hit and everything touching it goes. */
  private detonate(center: Brick): void {
    const cx = center.x + center.w / 2;
    const cy = center.y + center.h / 2;
    this.particles.ring(cx, cy, 8, 120, COURT.pink, 0.45);
    this.particles.ring(cx, cy, 4, 70, '#ffffff', 0.3);
    this.particles.sparks(cx, cy, COURT.pink, 16);
    this.sfx.play('explosion', this.gameTime, 0.05);
    this.shake.shake(6, 0.22);
    for (const b of this.bricks) {
      if (!b.alive) continue;
      const dx = Math.abs(b.x + b.w / 2 - cx);
      const dy = Math.abs(b.y + b.h / 2 - cy);
      if (dx <= BRICK_PITCH_X * 1.2 && dy <= BRICK_PITCH_Y * 1.2) {
        this.breakBrick(b);
      }
    }
  }

  // ======================================================== power-ups ====

  private maybeDrop(b: Brick): void {
    if (this.gameState !== 'playing' || this.capsules.length >= 3) return;
    if (requiredLeft(this.bricks) === 0) return;
    if (Math.random() >= DROP_CHANCE) return;
    const type = pickPower(this.lastDrop, Math.random);
    this.lastDrop = type;
    this.capsules.push({
      x: b.x + b.w / 2,
      y: b.y + b.h / 2,
      vy: CAPSULE_FALL,
      type,
      age: 0,
    });
  }

  private updateCapsules(sim: number): void {
    const p = this.paddle;
    const left = p.cx - p.w / 2;
    this.capsules = this.capsules.filter(c => {
      c.age += sim;
      c.y += c.vy * sim;
      if (c.y - CAPSULE_H / 2 > VIEW_H) return false;
      const caught =
        c.y + CAPSULE_H / 2 >= p.y &&
        c.y - CAPSULE_H / 2 <= p.y + p.h &&
        c.x + CAPSULE_W / 2 >= left &&
        c.x - CAPSULE_W / 2 <= left + p.w;
      if (caught) this.collect(c);
      return !caught;
    });
  }

  private collect(c: Capsule): void {
    const def = POWER_DEFS[c.type];
    this.powerupsCollectedThisGame += 1;
    this.sfx.play('powerup', this.gameTime, 0.05);
    this.particles.ring(c.x, this.paddle.y, 6, 48, def.color, 0.35);
    this.particles.popup(c.x, this.paddle.y - 26, def.label, def.color, 16);
    switch (c.type) {
      case 'widen':
        this.powers.widen = WIDEN_TIME;
        break;
      case 'slow':
        this.powers.slow = SLOW_TIME;
        break;
      case 'catch':
        this.powers.catch = CATCH_TIME;
        break;
      case 'blast':
        this.powers.blast = true;
        break;
      case 'life':
        this.lives = Math.min(MAX_LIVES, this.lives + 1);
        break;
      case 'multi':
        this.splitBalls();
        break;
    }
  }

  /** MULTI: two more balls fan out of the first one in play. */
  private splitBalls(): void {
    const src = this.balls.find(b => !b.stuck) ?? this.balls[0];
    if (!src) return;
    const speed = Math.max(src.speed, Math.hypot(src.vx, src.vy));
    const base = src.stuck ? 0 : Math.atan2(src.vx, -src.vy);
    for (const spread of [-0.4, 0.4]) {
      if (this.balls.length >= MAX_BALLS) break;
      const b = makeBall(src.x, src.y);
      aimBall(b, base + spread, speed);
      if (src.vy > 0 && !src.stuck) b.vy = Math.abs(b.vy);
      b.speed = speed;
      this.balls.push(b);
    }
  }

  // ============================================================ beats ====

  private loseServe(last: Ball | null): void {
    this.lives -= 1;
    this.streak.reset();
    this.powers = noPowers();
    this.capsules = [];
    this.hurt = 1;
    this.shake.shake(8, 0.35);
    const x = last ? last.x : this.paddle.cx;
    this.particles.sparks(x, VIEW_H - 6, UI.bad, 14, 0, -1);
    this.particles.ring(x, VIEW_H - 6, 6, 70, UI.bad, 0.4);
    this.sfx.play('explosion', this.gameTime, 0);
    this.stateTime = 0;
    if (this.lives > 0) {
      this.gameState = 'lost';
      this.banner = {
        title: 'BALL OUT',
        sub: this.lives === 1 ? 'LAST SERVE' : `${this.lives} SERVES LEFT`,
        accent: UI.bad,
        t: 0,
        dur: LOST_BEAT,
      };
    } else {
      this.gameState = 'gameover';
      this.banner = {
        title: 'MATCH OVER',
        sub: `FINAL ${fmt(this.score)} · SET ${this.level}`,
        accent: UI.bad,
        t: 0,
        dur: GAMEOVER_BEAT,
      };
    }
  }

  private startClear(): void {
    this.gameState = 'clear';
    this.stateTime = 0;
    this.slowmo = SLOWMO_TIME;
    this.flash = 1;
    this.clearBeatStarted = false;
    this.nextLayoutBuilt = false;
    this.levelsCompletedThisGame += 1;
    this.clearBonus = CLEAR_POINTS + CLEAR_POINTS_PER_LEVEL * this.level;
    this.score += this.clearBonus;
    this.particles.ring(
      this.lastBreak.x,
      this.lastBreak.y,
      10,
      260,
      '#ffffff',
      0.5
    );
    this.services?.analytics?.trackFeatureUsage?.('breakout_level_clear', {
      level: this.level,
      score: this.score,
    });
  }

  private updateClear(dt: number, sim: number): void {
    this.stateTime += dt;
    if (!this.clearBeatStarted) {
      // The slow-mo tail: the ball keeps flying, but nothing can be lost.
      const ballDt = sim * (this.powers.slow > 0 ? SLOW_SCALE : 1);
      for (const b of this.balls) {
        moveBall(b, ballDt, ARENA, this.paddle, this.bricks, this.handlers);
      }
      this.balls = this.balls.filter(b => b.y - b.r <= VIEW_H);
      if (this.stateTime >= SLOWMO_TIME) this.beginClearBeat();
      return;
    }
    const beat = this.stateTime - SLOWMO_TIME;
    if (!this.nextLayoutBuilt && beat >= BUILD_START) {
      this.level += 1;
      this.bricks = makeBricks(this.level, true);
      this.streak.newLevel();
      this.nextLayoutBuilt = true;
    }
    if (beat >= CLEAR_BEAT) this.enterReady();
  }

  private beginClearBeat(): void {
    this.clearBeatStarted = true;
    this.balls = [];
    this.capsules = [];
    this.powers = noPowers();
    // Steel left standing goes with the set; it does not count as broken.
    for (const b of this.bricks) {
      if (!b.alive) continue;
      b.alive = false;
      this.particles.shards(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, b.color);
    }
    this.banner = {
      title: `SET ${this.level} CLEAR`,
      sub: `+${fmt(this.clearBonus)} BONUS · ${fmt(this.score)} · BEST STREAK ${this.streak.levelBest}`,
      accent: COURT.mint,
      t: 0,
      dur: CLEAR_BEAT,
    };
    this.particles.confetti(
      [...BRICK_RAMP, COURT.mint, '#ffffff'],
      ARENA.left + 20,
      ARENA.right - 20,
      140
    );
    this.sfx.play('win', this.gameTime, 0);
  }

  /** Timers, animations and washes: all of it advances here, never in render. */
  private updateEffects(dt: number, sim: number): void {
    this.particles.update(sim);
    this.shake.update(dt);
    this.streak.update(dt);

    for (const f of this.railFlashes) f.t -= dt;
    this.railFlashes = this.railFlashes.filter(f => f.t > 0);

    for (const b of this.bricks) {
      if (b.shake > 0) b.shake = Math.max(0, b.shake - dt);
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
      if (b.enter < 1) {
        if (b.enterDelay > 0) {
          b.enterDelay -= dt;
          if (b.enterDelay <= 0) {
            b.enter = Math.min(1, -b.enterDelay / BRICK_DROP_TIME);
            b.enterDelay = 0;
          }
        } else {
          b.enter = Math.min(1, b.enter + dt / BRICK_DROP_TIME);
        }
      }
    }

    const p = this.paddle;
    if (p.squash > 0) p.squash = Math.max(0, p.squash - dt);

    const trailLen = 9 + 4 * (this.streak.mult - 1);
    for (const b of this.balls) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
      if (b.stuck) {
        b.trail = [];
        continue;
      }
      const last = b.trail[b.trail.length - 1];
      if (!last || Math.hypot(b.x - last.x, b.y - last.y) > 3) {
        b.trail.push({ x: b.x, y: b.y });
      }
      while (b.trail.length > trailLen) b.trail.shift();
    }

    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.hurt = Math.max(0, this.hurt - dt * 1.1);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    const cardTarget = this.cardOpen && this.gameState === 'ready' ? 1 : 0;
    this.cardAlpha += (cardTarget - this.cardAlpha) * Math.min(1, dt * 12);
    if (this.cardAlpha < 0.01 && cardTarget === 0) this.cardAlpha = 0;
  }

  // ========================================================== render ====

  private hudState(): HudState {
    return {
      score: this.score,
      best: Math.max(this.highScore, this.score),
      coins: this.getScore().coinsEarned,
      level: this.level,
      ballsInPlay: this.gameState === 'ready' ? 1 : this.balls.length,
      lives: this.lives,
      maxLives: MAX_LIVES,
      streak: this.streak.count,
      streakMult: this.streak.mult,
      streakPulse: this.streak.pulse,
      powers: this.powers,
      time: this.gameTime,
    };
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const o = this.shake.getOffset();
    ctx.save();
    ctx.translate(o.x, o.y);
    this.arena.drawFloor(ctx);
    this.arena.drawFlashes(ctx, this.railFlashes);
    // Clip to the court so a set dropping in comes from behind the far rail
    // and never crosses into the band.
    ctx.save();
    ctx.beginPath();
    ctx.rect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, VIEW_H);
    ctx.clip();
    this.brickArt.draw(ctx, this.bricks);
    if (this.gameState === 'playing' && requiredLeft(this.bricks) <= 3) {
      this.brickArt.beacon(ctx, this.bricks, this.gameTime);
    }
    ctx.restore();
    this.particles.render(ctx);
    for (const c of this.capsules) this.art.capsule(ctx, c);
    this.art.paddle(ctx, this.paddle, this.powers.catch > 0, this.gameTime);

    const look = {
      color: STREAK_COLORS[this.streak.mult - 1],
      blastArmed: this.powers.blast,
      time: this.gameTime,
    };
    for (const b of this.balls) this.art.ball(ctx, b, look);
    for (const b of this.balls) {
      if (!b.stuck) continue;
      const waited = this.gameState === 'ready' ? this.serveWait : b.stuckTime;
      const angle = launchAngle(
        b.stuckOffset,
        this.paddle.vx,
        SERVE_ENGLISH,
        this.serveLean
      );
      this.art.aim(ctx, b, angle, waited, COURT.mint);
    }
    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    this.hud.overlays(ctx, {
      hurt: this.hurt,
      flash: this.flash,
      slowmo: this.slowmo / SLOWMO_TIME,
      dim: this.dim,
    });
    if (this.banner) this.hud.banner(ctx, this.banner);
    if (this.cardAlpha > 0) {
      this.hud.serveCard(ctx, this.cardAlpha, this.level);
    } else if (this.balls.some(b => b.stuck)) {
      const verb = this.gameState === 'ready' ? 'SERVE' : 'RELEASE';
      this.hud.servePrompt(ctx, this.paddle.cx, this.paddle.y + 36, 1, verb);
    }
    this.hud.band(ctx, this.hudState());
    this.particles.renderOverlay(ctx);
  }

  /** The court as it stood at the final whistle, dimmed under the summary. */
  protected onRenderEnded(ctx: CanvasRenderingContext2D): void {
    this.arena.drawFloor(ctx);
    this.brickArt.draw(ctx, this.bricks, false);
    this.art.paddle(ctx, this.paddle, false, this.gameTime);
    this.hud.overlays(ctx, { hurt: 0, flash: 0, slowmo: 0, dim: 1 });
    this.hud.band(ctx, this.hudState());
  }

  // ============================================================= end ====

  protected onGameEnd(finalScore: GameScore): void {
    try {
      const prev =
        parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) || 0;
      if (finalScore.score > prev) {
        localStorage.setItem(HIGH_SCORE_KEY, String(finalScore.score));
      }
    } catch {
      // Private mode: the best just does not persist.
    }
    this.highScore = Math.max(this.highScore, finalScore.score);

    this.extendedGameData = {
      bricks_broken: this.bricksDestroyedThisGame,
      levels_cleared: this.levelsCompletedThisGame,
      powerups_collected: this.powerupsCollectedThisGame,
      total_bricks_broken: this.bricksDestroyedThisGame,
      max_level: this.level,
      final_lives: this.lives,
    };

    const track = (key: string, value: number) =>
      this.services?.analytics?.trackGameSpecificStat?.('breakout', key, value);
    track('bricks_broken', this.bricksDestroyedThisGame);
    track('levels_cleared', this.levelsCompletedThisGame);
    track('powerups_collected', this.powerupsCollectedThisGame);
    track('total_bricks_broken', this.bricksDestroyedThisGame);
    track('max_level', this.level);
  }
}
