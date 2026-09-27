// ===== src/games/snake/SnakeGame.ts =====
//
// Snake, by (the imagined) Mosslight: a terrarium, a hatchling, apples.
//
// The run: READY (a card naming the controls; the first turn, a tap or
// two seconds starts it) → PLAYING → HIT (a half-second freeze, then the
// snake hatches again at the centre and waits for a turn) → DYING (the
// body pops head to tail, the bed goes red) → endGame(). The rules live in
// small modules under systems/ so tests can pin them; this file wires them
// together and owns the state machine.

import { BaseGame } from '@/games/shared/BaseGame';
import { PressTracker } from '@/games/shared/input/PressTracker';
import { UI } from '@/games/shared/hud/canvasUi';
import type { GameManifest } from '@/lib/types';
import type { SoundName } from '@/services/AudioManager';
import {
  BOARD_X,
  BOARD_Y,
  CANVAS_H,
  CANVAS_W,
  CELL,
  COIN_INTERVAL,
  COIN_LIFETIME,
  COIN_POINTS,
  COLS,
  DEATH_HOLD,
  DEATH_POP_TIME,
  FOOD_POINTS,
  HIT_STOP,
  LENGTH_MILESTONE,
  MAGNET_RANGE,
  MAX_COINS,
  MAX_LIVES,
  MAX_POWERUPS,
  PAL,
  POWER_GRACE,
  POWERUP_INTERVAL,
  POWERUP_LIFETIME,
  POWERUP_POINTS,
  READY_AUTO_START,
  RESPAWN_INVULNERABILITY,
  RESPAWN_WAIT,
  ROWS,
  START_LENGTH,
} from './constants';
import { BoardRenderer, clipToBoard } from './systems/BoardRenderer';
import { ComboSystem } from './systems/ComboSystem';
import {
  drawBottomBand,
  drawReadyCard,
  drawRibbon,
  drawTopHud,
  HudState,
  Ribbon,
} from './systems/HudRenderer';
import {
  PACE_TIERS,
  applesToNextPace,
  paceProgress,
  paceTierFor,
  stepRate,
} from './systems/Pace';
import { ParticleSystem } from './systems/ParticleSystem';
import { drawPlayfield, PlayfieldView } from './systems/Playfield';
import {
  Cell,
  inBounds,
  layoutRespawn,
  openRoom,
  respawnFacing,
} from './systems/Respawn';
import { ScreenShake } from './systems/ScreenShake';
import { DIR_VEC, Dir, OPPOSITE, TurnQueue } from './systems/TurnQueue';
import { Coin } from './entities/Coin';
import { Food } from './entities/Food';
import {
  POWERUP_CONFIGS,
  POWERUP_TYPES,
  PowerUp,
  SnakePowerUpType,
} from './entities/PowerUp';

export type SnakeState =
  | 'ready'
  | 'playing'
  | 'hit'
  | 'respawn'
  | 'dying'
  | 'ended';

export interface ActivePowerUp {
  type: SnakePowerUpType;
  duration: number;
  maxDuration: number;
}

/**
 * A pickup the rules have already taken but the picture has not: the drawn
 * head trails the logical head by up to one step, so the apple stays on
 * screen until the mouth reaches it, and its burst, popup and sound fire
 * then rather than a cell early.
 */
export interface Morsel {
  kind: 'apple' | 'coin' | 'powerup';
  x: number;
  y: number;
  /** Where a magnet-pulled coin slides in from. */
  fromX: number;
  fromY: number;
  type: SnakePowerUpType | null;
  left: number;
  total: number;
  text: string;
  /** The feast count if this bite hit a milestone, else 0. */
  milestone: number;
}

const KEYMAP: ReadonlyArray<[Dir, readonly string[]]> = [
  ['up', ['ArrowUp', 'KeyW']],
  ['down', ['ArrowDown', 'KeyS']],
  ['left', ['ArrowLeft', 'KeyA']],
  ['right', ['ArrowRight', 'KeyD']],
];
const KEY_CODES = KEYMAP.flatMap(([, codes]) => codes);
const SWIPE_PX = 22;
/** The mouth covers a pickup about this far into the step that took it. */
const BITE_AT = 0.6;
const HUNGRY_AFTER = 8;
const RIBBON_LIFE = 1.6;

export class SnakeGame extends BaseGame {
  manifest: GameManifest = {
    id: 'snake',
    title: 'Snake',
    thumbnail: '/games/snake/snake-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 80,
    tier: 0,
    description:
      'Classic snake action with modern flair. Eat food, collect coins, grow longer!',
  };

  // State machine.
  private gameState: SnakeState = 'ready';
  private stateTime = 0;

  // The snake.
  private snake: Cell[] = [];
  private prevTail: Cell = { x: 0, y: 0 };
  private turns = new TurnQueue('right');
  private stepProgress = 0;
  private pendingGrowth = 0;
  private bulges: number[] = [];

  // The board.
  private food: Food = new Food(-1, -1);
  private coins: Coin[] = [];
  private powerUps: PowerUp[] = [];
  private morsels: Morsel[] = [];
  private coinTimer = 0;
  private powerUpTimer = 0;
  private activePowerUps: ActivePowerUp[] = [];
  private wrapGrace = 0;
  private ghostGrace = 0;

  // Lives.
  private lives = MAX_LIVES;
  private maxLives = MAX_LIVES;
  private invulnerableFor = 0;
  private lostAge = 99;
  private hitCell: Cell | null = null;
  private shed: Cell[] = [];
  private shedAge = 99;
  private hatchAge = 99;
  private deathPopped = 0;

  // Progress and stats.
  private foodEaten = 0;
  private paceTier = 0;
  private survivalCarry = 0;
  private sinceFood = 0;
  private nextLengthMilestone = LENGTH_MILESTONE;
  private maxLength = START_LENGTH;
  private highScore = 0;
  private powerupsUsed = 0;
  private powerupTypesUsed: Set<SnakePowerUpType> = new Set();

  // Feel.
  private squash = 0;
  private rainbowTimer = 0;
  private paceFlash = 0;
  private comboFlash = 0;
  private boardFlash = 0;
  private readyFadeAge = 99;
  private ribbons: Ribbon[] = [];
  private lastSound: Partial<Record<SoundName, number>> = {};

  // Systems.
  private particles = new ParticleSystem();
  private screenShake = new ScreenShake();
  private comboSystem = new ComboSystem();
  private tracker = new PressTracker();
  private board: BoardRenderer | null = null;

  // ==================================================== lifecycle ====

  protected onInit(): void {
    this.renderBaseHud = false;
    // Built here, not as a field, so its spores use the seeded Math.random
    // the capture harness installs just before init().
    this.board = new BoardRenderer();
    try {
      const saved = localStorage.getItem('snake_best');
      this.highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      this.highScore = 0;
    }
    this.reset();
  }

  protected onRestart(): void {
    this.reset();
  }

  protected onUpdate(dt: number): void {
    this.tracker.update(this.services.input, KEY_CODES, dt);
    this.stateTime += dt;
    this.screenShake.update(dt);
    this.particles.update(dt);
    this.food.update(dt);
    const live = this.gameState === 'playing';
    for (const coin of this.coins) coin.update(dt, live);
    for (const p of this.powerUps) p.update(dt, live);
    this.updateFeel(dt);

    switch (this.gameState) {
      case 'ready':
        this.updateReady();
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'hit':
        if (this.stateTime >= HIT_STOP) this.respawn();
        break;
      case 'respawn':
        this.updateRespawn();
        break;
      case 'dying':
        this.updateDying();
        break;
      case 'ended':
        break;
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PAL.case;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const off = this.screenShake.getOffset();
    ctx.save();
    ctx.translate(off.x, off.y);
    this.board?.drawBoard(ctx);
    ctx.save();
    clipToBoard(ctx);
    this.board?.drawMotes(ctx, this.gameTime);
    drawPlayfield(ctx, this.playfieldView());
    this.particles.render(ctx);
    ctx.restore();
    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    this.board?.drawBands(ctx);
    const hud = this.hudState();
    drawTopHud(ctx, hud);
    drawBottomBand(ctx, hud);

    const cardFade =
      this.gameState === 'ready' ? 1 : 1 - this.readyFadeAge / 0.25;
    if (cardFade > 0) {
      const appear = this.gameState === 'ready' ? this.stateTime / 0.35 : 1;
      drawReadyCard(
        ctx,
        Math.min(1, appear),
        cardFade,
        this.gameState === 'ready' ? this.stateTime / READY_AUTO_START : 1
      );
    }
    if (this.ribbons.length > 0) drawRibbon(ctx, this.ribbons[0]);
  }

  /** The finished run: the board and its shed skin, dimmed, under the HUD. */
  protected onRenderEnded(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PAL.case;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.board?.drawBoard(ctx);
    ctx.save();
    clipToBoard(ctx);
    drawPlayfield(ctx, { ...this.playfieldView(), ended: true });
    ctx.restore();
    this.board?.drawBands(ctx);
    const hud = this.hudState();
    drawTopHud(ctx, hud);
    drawBottomBand(ctx, hud);
  }

  protected onGameEnd(): void {
    try {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('snake_best', String(this.highScore));
      }
    } catch {
      /* storage can be unavailable; the run still counts */
    }

    this.extendedGameData = {
      snake_length: this.snake.length,
      final_speed: stepRate(this.paceTier, false),
      food_eaten: this.foodEaten,
      max_length: this.maxLength,
      powerupsUsed: this.powerupsUsed,
      powerupTypesUsed: [...this.powerupTypesUsed],
      maxCombo: this.comboSystem.getMaxCombo(),
      livesRemaining: this.lives,
      pace_tier: this.paceTier,
    };

    const analytics = this.services?.analytics;
    analytics?.trackGameSpecificStat?.(
      'snake',
      'snake_length',
      this.snake.length
    );
    analytics?.trackGameSpecificStat?.(
      'snake',
      'max_combo',
      this.comboSystem.getMaxCombo()
    );
    analytics?.trackGameSpecificStat?.('snake', 'food_eaten', this.foodEaten);
  }

  // ======================================================= states ====

  private reset(): void {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    this.snake = [];
    for (let i = 0; i < START_LENGTH; i++) {
      this.snake.push({ x: cx - i, y: cy });
    }
    this.prevTail = { ...this.snake[this.snake.length - 1] };
    this.turns.reset('right');
    this.stepProgress = 0;
    this.pendingGrowth = 0;
    this.bulges = [];

    // The first apple sits straight ahead, so the first input is optional.
    this.food = new Food(-1, -1);
    this.food.setPosition(cx + 6, cy);
    this.coins = [];
    this.powerUps = [];
    this.morsels = [];
    this.coinTimer = 0;
    this.powerUpTimer = 0;
    this.activePowerUps = [];
    this.wrapGrace = 0;
    this.ghostGrace = 0;

    this.lives = this.maxLives;
    this.invulnerableFor = 0;
    this.lostAge = 99;
    this.hitCell = null;
    this.shed = [];
    this.shedAge = 99;
    this.hatchAge = 99;
    this.deathPopped = 0;

    this.score = 0;
    this.pickups = 0;
    this.foodEaten = 0;
    this.paceTier = 0;
    this.survivalCarry = 0;
    this.sinceFood = 0;
    this.nextLengthMilestone = LENGTH_MILESTONE;
    this.maxLength = this.snake.length;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();
    this.extendedGameData = null;

    this.squash = 0;
    this.rainbowTimer = 0;
    this.paceFlash = 0;
    this.comboFlash = 0;
    this.boardFlash = 0;
    this.readyFadeAge = 99;
    this.ribbons = [];
    this.lastSound = {};

    this.particles.clear();
    this.screenShake.stop();
    this.comboSystem.reset();
    this.tracker.reset();
    this.setState('ready');
  }

  private setState(next: SnakeState): void {
    this.gameState = next;
    this.stateTime = 0;
  }

  private updateReady(): void {
    const dirs = this.readDirections();
    const tapped = this.tracker.pointerJustPressed();
    if (dirs.length > 0 || tapped || this.stateTime >= READY_AUTO_START) {
      this.turns.pushAll(dirs);
      this.readyFadeAge = 0;
      this.startMoving();
    }
  }

  /** PLAYING, taking the first step at once so the glide never jumps. */
  private startMoving(): void {
    this.setState('playing');
    this.stepProgress = 1;
  }

  private updatePlaying(dt: number): void {
    this.turns.pushAll(this.readDirections());
    this.comboSystem.update(dt);
    this.tickPowerUps(dt);
    this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
    this.sinceFood += dt;

    // Pace pays: points per second = pace tier + 1, accrued as a float so
    // the total does not depend on the frame rate.
    this.survivalCarry += dt * (this.paceTier + 1);
    const whole = Math.floor(this.survivalCarry);
    if (whole > 0) {
      this.score += whole;
      this.survivalCarry -= whole;
    }

    this.stepProgress += dt * this.currentStepRate();
    let guard = 0;
    while (this.stepProgress >= 1 && this.gameState === 'playing') {
      this.stepProgress -= 1;
      this.step();
      if (++guard >= 4) {
        this.stepProgress = 0;
        break;
      }
    }
    if (this.gameState !== 'playing') return;

    this.coinTimer += dt;
    if (this.coinTimer >= COIN_INTERVAL) {
      this.coinTimer = 0;
      if (this.coins.length < MAX_COINS) this.spawnCoin();
    }
    this.powerUpTimer += dt;
    if (this.powerUpTimer >= POWERUP_INTERVAL) {
      this.powerUpTimer = 0;
      if (this.powerUps.length < MAX_POWERUPS) this.spawnPowerUp();
    }
    this.coins = this.coins.filter(c => !c.isExpired());
    this.powerUps = this.powerUps.filter(p => !p.isExpired());
  }

  private updateRespawn(): void {
    const dirs = this.readDirections();
    const heading = this.turns.heading;
    const go = dirs.find(d => d !== OPPOSITE[heading]);
    const tapped = this.tracker.pointerJustPressed();
    if (go || tapped || this.stateTime >= RESPAWN_WAIT) {
      if (go) this.turns.push(go);
      this.invulnerableFor = RESPAWN_INVULNERABILITY;
      this.startMoving();
    }
  }

  private updateDying(): void {
    const total = this.snake.length;
    const target = Math.min(
      total,
      (this.stateTime / DEATH_POP_TIME) * (total + 0.5)
    );
    const per = Math.max(2, Math.min(6, Math.floor(180 / total)));
    while (this.deathPopped < target) {
      const i = Math.floor(this.deathPopped);
      const c = this.snake[Math.min(i, total - 1)];
      const px = BOARD_X + (c.x + 0.5) * CELL;
      const py = BOARD_Y + (c.y + 0.5) * CELL;
      const colors = [PAL.snakeBody, PAL.snakeStripe, PAL.snakeHead];
      this.particles.burst(px, py, i === 0 ? 10 : per, 'chunk', colors, 110, 4);
      this.play('bounce', 0.09, 0.45);
      this.deathPopped += 1;
    }
    if (this.stateTime >= DEATH_POP_TIME + DEATH_HOLD) {
      this.setState('ended');
      this.endGame();
    }
  }

  // ======================================================== rules ====

  private currentStepRate(): number {
    return stepRate(this.paceTier, this.hasPowerUp('slow'));
  }

  private step(): void {
    const dir = this.turns.next();
    let next = this.ahead(this.snake[0], dir);

    if (!inBounds(next.x, next.y)) {
      if (this.canWrap()) {
        next = { x: (next.x + COLS) % COLS, y: (next.y + ROWS) % ROWS };
      } else if (this.invulnerableFor > 0) {
        // A fresh hatchling is steered off the glass rather than hurt.
        const steer = this.steerFromWall(dir);
        if (!steer) return this.collide(this.snake[0]);
        this.turns.force(steer);
        next = this.ahead(this.snake[0], steer);
      } else {
        return this.collide(this.snake[0]);
      }
    }

    // The tail cell is free to enter unless the snake is about to grow.
    const eats = this.food.x === next.x && this.food.y === next.y;
    const grows = this.pendingGrowth > 0 || eats;
    const body = grows ? this.snake : this.snake.slice(0, -1);
    const bites = body.some(c => c.x === next.x && c.y === next.y);
    if (bites && !this.canPassBody()) return this.collide(next);

    this.snake.unshift(next);
    if (eats) this.eatFood();
    if (this.pendingGrowth > 0) {
      this.pendingGrowth--;
      this.prevTail = { ...this.snake[this.snake.length - 1] };
    } else {
      this.prevTail = this.snake.pop()!;
    }

    const ci = this.coins.findIndex(c => c.x === next.x && c.y === next.y);
    if (ci >= 0) this.collectCoin(ci, null);
    const pi = this.powerUps.findIndex(p => p.x === next.x && p.y === next.y);
    if (pi >= 0) this.collectPowerUp(pi);
    if (this.hasPowerUp('magnet')) this.applyMagnet();

    this.maxLength = Math.max(this.maxLength, this.snake.length);
    if (this.snake.length >= this.nextLengthMilestone) {
      this.announce(
        'GROWING',
        `LENGTH ${this.nextLengthMilestone}`,
        PAL.sprout
      );
      this.play('win', 0.5, 0.6);
      this.nextLengthMilestone += LENGTH_MILESTONE;
    }
  }

  private ahead(from: Cell, dir: Dir): Cell {
    const v = DIR_VEC[dir];
    return { x: from.x + v.x, y: from.y + v.y };
  }

  private steerFromWall(dir: Dir): Dir | null {
    const head = this.snake[0];
    const options: Dir[] =
      dir === 'left' || dir === 'right' ? ['up', 'down'] : ['left', 'right'];
    options.sort((a, b) => openRoom(head, b) - openRoom(head, a));
    for (const d of options) {
      const n = this.ahead(head, d);
      if (inBounds(n.x, n.y)) return d;
    }
    return null;
  }

  private canWrap(): boolean {
    return this.hasPowerUp('wrap') || this.wrapGrace > 0;
  }

  private canPassBody(): boolean {
    return (
      this.hasPowerUp('ghost') ||
      this.ghostGrace > 0 ||
      this.invulnerableFor > 0
    );
  }

  private collide(cell: Cell): void {
    this.hitCell = { ...cell };
    // Whatever was being announced no longer matters.
    this.ribbons = [];
    this.lives--;
    this.lostAge = 0;
    this.comboSystem.breakCombo();
    this.stepProgress = 0;
    if (this.lives <= 0) {
      this.setState('dying');
      this.deathPopped = 0;
      this.screenShake.shake(6, 0.45);
      this.play('collision');
      return;
    }
    this.setState('hit');
    this.screenShake.shake(5, 0.35);
    this.play('hit');
  }

  /** Hatch again at the centre: half the length, facing open room. */
  private respawn(): void {
    this.shed = this.snake.map(c => ({ ...c }));
    this.shedAge = 0;
    const length = Math.max(START_LENGTH, Math.floor(this.snake.length / 2));
    const facing = respawnFacing(this.hitCell);
    this.snake = layoutRespawn(length, facing);
    this.prevTail = { ...this.snake[this.snake.length - 1] };
    this.turns.force(facing);
    this.pendingGrowth = 0;
    this.bulges = [];
    this.stepProgress = 0;
    this.hatchAge = 0;
    this.relocateCovered();
    this.setState('respawn');

    const head = this.cellCentre(this.snake[0]);
    this.particles.burst(
      head.x,
      head.y,
      9,
      'shard',
      [PAL.egg, PAL.eggShade],
      120,
      4
    );
    this.particles.ring(head.x, head.y, 6, 30, PAL.egg, 0.45, 2);
    this.play('hole');
    const left = this.lives === 1 ? '1 LIFE LEFT' : `${this.lives} LIVES LEFT`;
    this.announce('HATCHED', left, this.lives === 1 ? UI.bad : PAL.sprout);
  }

  /** Anything the hatchling was laid over moves somewhere free. */
  private relocateCovered(): void {
    const onSnake = (x: number, y: number) =>
      this.snake.some(c => c.x === x && c.y === y);
    if (onSnake(this.food.x, this.food.y)) this.spawnFood();
    for (const c of this.coins) {
      if (!onSnake(c.x, c.y)) continue;
      const cell = this.randomFreeCell();
      if (cell) c.moveTo(cell.x, cell.y);
    }
    this.powerUps = this.powerUps.filter(p => {
      if (!onSnake(p.x, p.y)) return true;
      const cell = this.randomFreeCell();
      if (!cell) return false;
      p.x = cell.x;
      p.y = cell.y;
      return true;
    });
  }

  private eatFood(): void {
    this.foodEaten++;
    this.sinceFood = 0;
    const hit = this.comboSystem.addHit();
    const gain = Math.floor(FOOD_POINTS * hit.multiplier);
    this.score += gain;
    this.pendingGrowth += this.hasPowerUp('double') ? 2 : 1;
    this.addMorsel('apple', this.food.x, this.food.y, null, `+${gain}`, hit);
    this.spawnFood();

    const tier = paceTierFor(this.foodEaten);
    if (tier > this.paceTier) {
      this.paceTier = tier;
      this.paceFlash = 1;
      this.boardFlash = 1;
      this.announce('SPEED UP', PACE_TIERS[tier].name, PAL.tide);
      this.play('whoosh');
    }
  }

  /** `into` is set when a magnet pulls the coin into the mouth. */
  private collectCoin(index: number, into: Cell | null): void {
    const coin = this.coins[index];
    const hit = this.comboSystem.addHit();
    const gain = Math.floor(COIN_POINTS * hit.multiplier);
    this.score += gain;
    this.pickups++;
    const at = into ?? coin;
    const m = this.addMorsel('coin', at.x, at.y, null, `+${gain}`, hit);
    // A pulled coin slides from where it sat into the head.
    m.fromX = coin.x;
    m.fromY = coin.y;
    this.coins.splice(index, 1);
  }

  private collectPowerUp(index: number): void {
    const p = this.powerUps[index];
    const cfg = POWERUP_CONFIGS[p.type];
    const existing = this.activePowerUps.find(a => a.type === p.type);
    if (existing) {
      existing.duration += cfg.duration;
      existing.maxDuration = existing.duration;
    } else {
      this.activePowerUps.push({
        type: p.type,
        duration: cfg.duration,
        maxDuration: cfg.duration,
      });
    }
    if (p.type === 'wrap') this.wrapGrace = 0;
    if (p.type === 'ghost') this.ghostGrace = 0;
    this.powerupsUsed++;
    this.powerupTypesUsed.add(p.type);
    this.score += POWERUP_POINTS;
    this.addMorsel('powerup', p.x, p.y, p.type, cfg.label, null);
    this.powerUps.splice(index, 1);
  }

  /**
   * Coins within range slide one cell toward the head per step. A coin
   * never lands on an occupied cell: if both ways toward the head are
   * blocked it waits, and a coin pulled into the head is eaten, not parked
   * under the neck (the old pull could hide it beneath the body).
   */
  private applyMagnet(): void {
    const head = this.snake[0];
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      const dx = head.x - coin.x;
      const dy = head.y - coin.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0 || dist >= MAGNET_RANGE) continue;
      const moves: Cell[] = [];
      const alongX = { x: Math.sign(dx), y: 0 };
      const alongY = { x: 0, y: Math.sign(dy) };
      if (Math.abs(dx) >= Math.abs(dy)) moves.push(alongX, alongY);
      else moves.push(alongY, alongX);
      for (const m of moves) {
        if (m.x === 0 && m.y === 0) continue;
        const tx = coin.x + m.x;
        const ty = coin.y + m.y;
        if (tx === head.x && ty === head.y) {
          this.collectCoin(i, { x: head.x, y: head.y });
          break;
        }
        if (this.isOccupied(tx, ty)) continue;
        coin.moveTo(tx, ty);
        break;
      }
    }
  }

  private tickPowerUps(dt: number): void {
    this.wrapGrace = Math.max(0, this.wrapGrace - dt);
    this.ghostGrace = Math.max(0, this.ghostGrace - dt);
    for (const p of this.activePowerUps) {
      const before = p.duration;
      p.duration -= dt;
      for (const mark of [2, 1.5, 1, 0.5]) {
        if (before > mark && p.duration <= mark) this.play('click', 0.2, 0.35);
      }
      if (p.duration <= 0) {
        if (p.type === 'wrap') this.wrapGrace = POWER_GRACE;
        if (p.type === 'ghost') this.ghostGrace = POWER_GRACE;
      }
    }
    this.activePowerUps = this.activePowerUps.filter(p => p.duration > 0);
  }

  private hasPowerUp(type: SnakePowerUpType): boolean {
    return this.activePowerUps.some(p => p.type === type);
  }

  // ===================================================== spawning ====

  private isOccupied(x: number, y: number): boolean {
    return (
      this.snake.some(c => c.x === x && c.y === y) ||
      (this.food.x === x && this.food.y === y) ||
      this.coins.some(c => c.x === x && c.y === y) ||
      this.powerUps.some(p => p.x === x && p.y === y)
    );
  }

  /**
   * A random cell nothing occupies, preferring cells not touching the
   * head. Null when the board is full (the old version gave up after 100
   * tries and returned an occupied cell).
   */
  private randomFreeCell(): Cell | null {
    const head = this.snake[0];
    const free: Cell[] = [];
    const clear: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.isOccupied(x, y)) continue;
        free.push({ x, y });
        const near =
          head && Math.abs(head.x - x) <= 1 && Math.abs(head.y - y) <= 1;
        if (!near) clear.push({ x, y });
      }
    }
    const pool = clear.length > 0 ? clear : free;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private spawnFood(): void {
    this.food.setPosition(-1, -1);
    const cell = this.randomFreeCell();
    if (cell) this.food.setPosition(cell.x, cell.y);
  }

  private spawnCoin(): void {
    const cell = this.randomFreeCell();
    if (cell) this.coins.push(new Coin(cell.x, cell.y, COIN_LIFETIME, 1));
  }

  private spawnPowerUp(type?: SnakePowerUpType): void {
    const cell = this.randomFreeCell();
    if (!cell) return;
    const pick =
      type ?? POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    this.powerUps.push(new PowerUp(cell.x, cell.y, pick, POWERUP_LIFETIME));
  }

  // ======================================================== input ====

  /** Directions pressed this frame: key edges, then a swipe (re-armed). */
  private readDirections(): Dir[] {
    const out: Dir[] = [];
    for (const [dir, codes] of KEYMAP) {
      if (codes.some(c => this.tracker.justPressed(c))) out.push(dir);
    }
    const swipe = this.tracker.swipe(SWIPE_PX);
    if (swipe) {
      out.push(swipe);
      this.tracker.rearmSwipe();
    }
    return out;
  }

  // ========================================================= feel ====

  private updateFeel(dt: number): void {
    this.squash = Math.max(0, this.squash - dt / 0.2);
    this.rainbowTimer = Math.max(0, this.rainbowTimer - dt);
    this.paceFlash = Math.max(0, this.paceFlash - dt / 0.7);
    this.comboFlash = Math.max(0, this.comboFlash - dt / 0.5);
    this.boardFlash = Math.max(0, this.boardFlash - dt / 0.4);
    this.lostAge += dt;
    this.shedAge += dt;
    this.hatchAge += dt;
    this.readyFadeAge += dt;

    if (this.ribbons.length > 0) {
      this.ribbons[0].age += dt;
      if (this.ribbons[0].age >= this.ribbons[0].life) this.ribbons.shift();
    }

    if (this.gameState === 'playing') {
      const travel = dt * this.currentStepRate() * 1.4;
      this.bulges = this.bulges
        .map(b => b + travel)
        .filter(b => b < this.snake.length + 1);
    }

    for (let i = this.morsels.length - 1; i >= 0; i--) {
      const m = this.morsels[i];
      m.left -= dt;
      if (m.left <= 0) {
        this.morsels.splice(i, 1);
        this.biteFx(m);
      }
    }
  }

  private addMorsel(
    kind: Morsel['kind'],
    x: number,
    y: number,
    type: SnakePowerUpType | null,
    text: string,
    hit: { combo: number; isMilestone: boolean } | null
  ): Morsel {
    const total = BITE_AT / this.currentStepRate();
    const m: Morsel = {
      kind,
      x,
      y,
      fromX: x,
      fromY: y,
      type,
      left: total,
      total,
      text,
      milestone: hit?.isMilestone ? hit.combo : 0,
    };
    this.morsels.push(m);
    return m;
  }

  /** The mouth reached a pickup: burst, popup, sound. */
  private biteFx(m: Morsel): void {
    const { x, y } = this.cellCentre(m);
    if (m.kind === 'apple') {
      this.particles.burst(
        x,
        y,
        9,
        'dot',
        [PAL.apple, PAL.appleLight],
        120,
        2.6
      );
      this.particles.burst(x, y, 3, 'leaf', [PAL.leaf], 90, 4);
      this.particles.popup(x, y - 14, m.text, PAL.bone);
      this.squash = 1;
      this.bulges.push(0);
      this.screenShake.shake(1.5, 0.12);
      this.play('success', 0.05);
    } else if (m.kind === 'coin') {
      this.particles.burst(x, y, 8, 'spark', [UI.coin, '#fff4d6'], 110, 4.5);
      this.particles.popup(x, y - 14, m.text, PAL.bone);
      this.rainbowTimer = 1.2;
      this.screenShake.shake(1.2, 0.1);
      this.play('coin', 0.05);
    } else if (m.type) {
      const color = POWERUP_CONFIGS[m.type].color;
      this.particles.ring(x, y, 8, 40, color, 0.5, 3);
      this.particles.burst(x, y, 12, 'dot', [color], 130, 2.4);
      this.particles.popup(x, y - 16, m.text, color, 13);
      this.screenShake.shake(2.5, 0.16);
      this.play('powerup');
    }
    if (m.milestone > 0) {
      this.comboFlash = 1;
      const head = this.headCentre();
      this.particles.ring(head.x, head.y, 10, 64, PAL.sprout, 0.6, 3);
      this.particles.popup(
        head.x,
        head.y - 30,
        `FEAST x${m.milestone}`,
        PAL.sprout,
        15,
        1.1
      );
      this.play('unlock', 0.3, 0.7);
    }
  }

  private announce(eyebrow: string, title: string, accent: string): void {
    this.ribbons.push({ eyebrow, title, accent, age: 0, life: RIBBON_LIFE });
    if (this.ribbons.length > 3) this.ribbons.splice(1, 1);
  }

  private play(name: SoundName, minGap = 0, volume?: number): void {
    const last = this.lastSound[name];
    if (last !== undefined && this.gameTime - last < minGap) return;
    this.lastSound[name] = this.gameTime;
    this.services?.audio?.playSound?.(
      name,
      volume === undefined ? undefined : { volume }
    );
  }

  // ======================================================= render ====

  private cellCentre(c: { x: number; y: number }): { x: number; y: number } {
    return {
      x: BOARD_X + (c.x + 0.5) * CELL,
      y: BOARD_Y + (c.y + 0.5) * CELL,
    };
  }

  private headCentre(): { x: number; y: number } {
    return this.cellCentre(this.snake[0]);
  }

  /** Everything the in-board painter needs, read-only. */
  private playfieldView(): PlayfieldView {
    const moving = this.gameState === 'playing';
    const hunger =
      moving && this.sinceFood > HUNGRY_AFTER
        ? Math.min(1, (this.sinceFood - HUNGRY_AFTER) / 3)
        : 0;
    return {
      state: this.gameState,
      stateTime: this.stateTime,
      time: this.gameTime,
      snake: this.snake,
      prevTail: this.prevTail,
      t: moving ? Math.min(1, this.stepProgress) : 1,
      bulges: this.bulges,
      heading: this.turns.heading,
      food: this.food,
      coins: this.coins,
      powerUps: this.powerUps,
      morsels: this.morsels,
      hunger,
      flash:
        this.invulnerableFor > 0 && Math.floor(this.gameTime * 16) % 2 === 0,
      rainbow: this.rainbowTimer / 1.2,
      squash: this.squash,
      hatch: Math.min(1, this.hatchAge / 0.3),
      popped:
        this.gameState === 'dying' || this.gameState === 'ended'
          ? this.deathPopped
          : 0,
      hitCell: this.hitCell,
      shed: this.shed,
      shedAge: this.shedAge,
      boardFlash: this.boardFlash,
      powers: this.activePowerUps.map(p => p.type),
      ended: false,
    };
  }

  private hudState(): HudState {
    return {
      score: this.score,
      best: this.highScore,
      pickups: this.pickups,
      length: this.snake.length,
      paceTier: this.paceTier,
      paceProgress: paceProgress(this.foodEaten),
      paceFlash: this.paceFlash,
      applesToNext: applesToNextPace(this.foodEaten),
      combo: this.comboSystem.getCombo(),
      comboMultiplier: this.comboSystem.getMultiplier(),
      comboLeft: this.comboSystem.getComboProgress(),
      comboFlash: this.comboFlash,
      lives: this.lives,
      maxLives: this.maxLives,
      lostAge: this.lostAge,
      powerUps: this.activePowerUps.map(p => ({
        type: p.type,
        left: Math.max(0, p.duration),
        max: p.maxDuration,
      })),
      state: this.gameState,
      stateTime: this.stateTime,
      time: this.gameTime,
    };
  }
}
