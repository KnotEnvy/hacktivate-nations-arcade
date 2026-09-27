// ===== src/games/tapdodge/TapDodgeGame.ts =====
//
// TAP DODGE — a five-lane highway seen from above, descending. Hazards come
// down the road in ROWS that always leave a way through; the player hops
// lanes, jumps LOW beams and ducks HIGH ones. Late dodges pay.
//
// The run: READY card (first input or 2s) -> play -> a 1.4s death beat ->
// the in-canvas run report (any input after 0.5s, or 4s) -> endGame().
//
// This file owns the lifecycle, input routing, the collision pass and the
// score. Rows come from systems/PatternSpawner, difficulty from
// systems/Progression, pixels from the entity and renderer modules.

import { BaseGame } from '@/games/shared/BaseGame';
import { UI, edgeVignette, withAlpha } from '@/games/shared/hud/canvasUi';
import type { GameManifest, GameScore } from '@/lib/types';
import type { SoundName } from '@/services/AudioManager';
import { Coin } from './entities/Coin';
import { Gem } from './entities/Gem';
import { NEAR_MISS_PX, Obstacle } from './entities/Obstacle';
import { DodgeKind, Player } from './entities/Player';
import { POWERUP_CONFIG, PowerUp, PowerUpType } from './entities/PowerUp';
import { Backdrop, rgba } from './systems/Backdrop';
import { ComboSystem } from './systems/ComboSystem';
import { Controls, Intents } from './systems/Controls';
import { FEVER_LEVELS, FeverSystem } from './systems/FeverSystem';
import { HudRenderer, HudState, Popup } from './systems/HudRenderer';
import { icon } from './systems/icons';
import {
  DECK_Y,
  Rect,
  SPAWN_Y,
  VIEW_H,
  VIEW_W,
  intersects,
  laneCenter,
  rectGap,
} from './systems/layout';
import { GEM, HAZARD, RUSH_HOT, SHIP, ZONES } from './systems/palette';
import { ParticleSystem } from './systems/ParticleSystem';
import {
  PatternKind,
  PatternSpawner,
  RowSpec,
  SpawnContext,
} from './systems/PatternSpawner';
import {
  BASE_SPEED,
  ProgressEvent,
  Progression,
  RUSH_LENGTH,
} from './systems/Progression';
import { RecapRenderer, RunStats, gradeRun } from './systems/RecapRenderer';
import { ScreenShake } from './systems/ScreenShake';

export type Phase = 'ready' | 'play' | 'dying' | 'recap' | 'done';

export const READY_SECONDS = 2;
/**
 * The key that pressed the shell's Start button can still be down on the
 * first frame; a press this early does not dismiss READY.
 */
export const READY_MIN_INPUT = 0.25;
export const DEATH_BEAT = 1.4;
export const RECAP_SECONDS = 4;
/** A press this early in the recap is still the panic press; ignore it. */
export const RECAP_MIN_INPUT = 0.5;
export const HIT_FREEZE = 0.09;
export const HIT_INVULN = 1;
export const NEAR_MISS_SLOWMO = 0.4;
export const NEAR_MISS_SCALE = 0.7;
export const SLOW_POWER_SCALE = 0.6;
export const MAX_LIVES = 3;
export const HOP_BUFFER = 3;

/** Economy: points per world second (times fever), and per event. */
export const SURVIVAL_POINTS = 20;
export const COIN_POINTS = 50;
export const GEM_POINTS = 250;
export const RUSH_POINTS = 300;
export const DRONE_KILL_POINTS = 40;

/** Longest sub-step the collision pass takes (s): nothing tunnels at 0.05. */
const MAX_STEP = 0.02;
const DODGE_BUFFER = 0.15;
const MAGNET_RANGE = 170;
const MAGNET_PULL = 420;
const DRONE_FIRE_EVERY = 0.32;
const BOLT_SPEED = 900;
const BEST_KEY = 'tapdodge_best';

interface Bolt {
  x: number;
  y: number;
}

interface ActivePower {
  type: PowerUpType;
  left: number;
  max: number;
}

export class TapDodgeGame extends BaseGame {
  manifest: GameManifest = {
    id: 'tapdodge',
    title: 'Tap Dodge',
    thumbnail: '/games/tapdodge/tapdodge-thumb.svg',
    inputSchema: ['touch', 'keyboard'],
    assetBudgetKB: 60,
    tier: 0,
    description:
      'Five lanes, a falling road. Hop, jump and duck through the gaps; late dodges score.',
  };

  protected renderBaseHud = false;

  private gameState: Phase = 'ready';
  private phaseTime = 0;

  private player = new Player();
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private gems: Gem[] = [];
  private powerUps: PowerUp[] = [];
  private bolts: Bolt[] = [];
  private popups: Popup[] = [];
  private activePowerUps: ActivePower[] = [];

  private controls = new Controls();
  private progression = new Progression();
  private spawner = new PatternSpawner();
  private backdrop = new Backdrop();
  private fever = new FeverSystem();
  private combo = new ComboSystem();
  private particles = new ParticleSystem();
  private shake = new ScreenShake();
  private hud = new HudRenderer();
  private recap = new RecapRenderer();

  private lives = MAX_LIVES;
  /** Seconds of live play: never the READY card, a pause or the recap. */
  private runTime = 0;
  private scoreAcc = 0;
  private coinsTaken = 0;
  private gemsTaken = 0;
  private best = 0;
  private bestAtStart = 0;
  private hopQueue: number[] = [];
  private steer: number | null = null;
  private pendingDodge: { kind: DodgeKind; ttl: number } | null = null;
  private freeze = 0;
  private slowMo = 0;
  private hitFlash = 0;
  private zoneFlip = 1;
  private droneTimer = 0;
  private stats: RunStats | null = null;
  private soundAt = new Map<SoundName, number>();

  // ============================================================ lifecycle

  protected onInit(): void {
    try {
      const saved = localStorage.getItem(BEST_KEY);
      this.best = saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      this.best = 0;
    }
    this.resetRun();
  }

  protected onRestart(): void {
    this.resetRun();
  }

  private resetRun(): void {
    this.gameState = 'ready';
    this.phaseTime = 0;
    this.player.reset();
    this.obstacles = [];
    this.coins = [];
    this.gems = [];
    this.powerUps = [];
    this.bolts = [];
    this.popups = [];
    this.activePowerUps = [];
    this.controls.reset();
    this.progression.reset();
    this.spawner.reset(Math.floor(Math.random() * 0xffffffff));
    this.backdrop.reset();
    this.fever.reset();
    this.combo.resetAll();
    this.particles.clear();
    this.shake.stop();
    this.lives = MAX_LIVES;
    this.runTime = 0;
    this.scoreAcc = 0;
    this.score = 0;
    this.pickups = 0;
    this.coinsTaken = 0;
    this.gemsTaken = 0;
    this.bestAtStart = this.best;
    this.hopQueue = [];
    this.steer = null;
    this.pendingDodge = null;
    this.freeze = 0;
    this.slowMo = 0;
    this.hitFlash = 0;
    this.zoneFlip = 1;
    this.droneTimer = 0;
    this.stats = null;
    this.extendedGameData = null;
    this.soundAt.clear();
  }

  protected onUpdate(dt: number): void {
    const intents = this.controls.update(this.services.input, dt);
    this.phaseTime += dt;
    switch (this.gameState) {
      case 'ready':
        this.updateReady(dt, intents);
        break;
      case 'play':
        this.updatePlay(dt, intents);
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'recap':
        this.updateRecap(dt, intents);
        break;
      case 'done':
        break;
    }
  }

  private updateReady(dt: number, intents: Intents): void {
    const dy = BASE_SPEED * 0.35 * dt;
    this.backdrop.update(dt, dy);
    this.player.update(dt, dt, dy);
    const pressed = intents.anyPress && this.phaseTime >= READY_MIN_INPUT;
    if (pressed || this.phaseTime >= READY_SECONDS) this.startPlay(pressed);
  }

  private startPlay(fromPress: boolean): void {
    this.gameState = 'play';
    this.phaseTime = 0;
    // The press that started the run is spent: it does not also hop.
    if (fromPress) this.controls.consumePress();
    this.zoneFlip = 0;
    this.backdrop.paint(ZONES[0].name, ZONES[0].accent, 'ZONE 1');
    this.sound('click');
  }

  // ================================================================= play

  private updatePlay(dt: number, intents: Intents): void {
    // Input is buffered first, so a press during a hit-freeze still lands.
    for (const d of intents.hops) {
      if (this.hopQueue.length < HOP_BUFFER) this.hopQueue.push(d);
    }
    if (intents.steer !== null) {
      this.steer = intents.steer;
      this.hopQueue = [];
    }
    if (intents.dodge) {
      this.pendingDodge = { kind: intents.dodge, ttl: DODGE_BUFFER };
    }

    this.particles.update(dt);
    this.shake.update(dt);
    this.updatePopups(dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.zoneFlip = Math.min(1, this.zoneFlip + dt / 0.35);

    if (this.freeze > 0) {
      this.freeze = Math.max(0, this.freeze - dt);
      return;
    }

    this.applyControls();
    if (this.pendingDodge) {
      this.pendingDodge.ttl -= dt;
      if (this.pendingDodge.ttl <= 0) this.pendingDodge = null;
    }

    this.runTime += dt;
    if (this.fever.update(dt)) this.sound('success', 0.2, 0.6);
    this.combo.update(dt);
    this.slowMo = Math.max(0, this.slowMo - dt);
    this.updateActivePowerUps(dt);

    const wdt = dt * this.timeScale();
    for (const ev of this.progression.update(wdt)) this.onProgress(ev);

    const n = Math.max(1, Math.ceil(dt / MAX_STEP));
    for (let i = 0; i < n && this.gameState === 'play'; i++) {
      this.step(dt / n, wdt / n);
    }

    if (this.gameState === 'play') {
      this.addPoints(SURVIVAL_POINTS * this.fever.multiplier() * wdt);
    }
  }

  private applyControls(): void {
    let hopped = 0;
    if (this.steer !== null) {
      const from = this.player.lane;
      if (this.player.steerTo(this.steer)) hopped = this.player.lane - from;
      this.steer = null;
    }
    while (this.hopQueue.length > 0) {
      const dir = this.hopQueue.shift() ?? 0;
      if (this.player.hop(dir)) hopped = dir;
    }
    if (hopped !== 0) {
      this.particles.puff(
        this.player.x,
        this.player.y,
        Math.sign(hopped),
        SHIP.flame
      );
      this.sound('click', 0.06, 0.45);
    }
    if (this.pendingDodge && this.player.startDodge(this.pendingDodge.kind)) {
      this.sound(this.pendingDodge.kind === 'jump' ? 'whoosh' : 'land');
      this.pendingDodge = null;
    }
  }

  private timeScale(): number {
    let k = 1;
    if (this.hasPower('slow')) k = Math.min(k, SLOW_POWER_SCALE);
    if (this.slowMo > 0) k = Math.min(k, NEAR_MISS_SCALE);
    return k;
  }

  /** One sub-step: move everything by the road's single speed, then collide. */
  private step(dt: number, wdt: number): void {
    const dy = this.progression.speed() * wdt;
    this.player.update(dt, wdt, dy);
    for (const o of this.obstacles) o.update(dy, wdt);
    for (const c of this.coins) c.update(dy, wdt);
    for (const g of this.gems) g.update(dy, wdt);
    for (const p of this.powerUps) p.update(dy, wdt);
    for (const b of this.bolts) b.y -= BOLT_SPEED * dt;
    this.backdrop.update(dt, dy);

    if (this.hasPower('magnet')) {
      const pull = MAGNET_PULL * wdt;
      for (const c of [...this.coins, ...this.gems]) {
        const dx = this.player.x - c.x;
        const dyy = this.player.y - c.y;
        if (dx * dx + dyy * dyy < MAGNET_RANGE * MAGNET_RANGE) {
          c.attract(this.player.x, this.player.y, pull);
        }
      }
    }

    for (const { row, overshoot } of this.spawner.advance(
      dy,
      this.spawnContext()
    )) {
      this.placeRow(row, SPAWN_Y + overshoot);
    }

    this.collide();
    this.cull();
  }

  private spawnContext(): SpawnContext {
    return {
      zone: this.progression.zoneIndex,
      worldTime: this.progression.worldTime,
      speed: this.progression.speed(),
      rush: this.progression.rushPhase === 'active',
    };
  }

  private placeRow(row: RowSpec, bottomY: number): void {
    for (const h of row.hazards) {
      this.obstacles.push(
        new Obstacle(h.kind, h.lane, row.id, bottomY, h.band ?? null, row.id)
      );
    }
    for (const p of row.pickups) {
      const x = laneCenter(p.lane);
      const y = bottomY - p.dy;
      if (p.kind === 'coin') this.coins.push(new Coin(x, y, p.dy * 0.05));
      else if (p.kind === 'gem') this.gems.push(new Gem(x, y, row.id));
      else if (p.power) this.powerUps.push(new PowerUp(x, y, p.power, row.id));
    }
  }

  /** Scenes and tests: put one row of a given pattern at the far end now. */
  spawnPattern(kind: PatternKind): RowSpec {
    const row = this.spawner.next(this.spawnContext(), kind);
    this.placeRow(row, SPAWN_Y);
    return row;
  }

  private cull(): void {
    const floor = DECK_Y + 40;
    this.obstacles = this.obstacles.filter(o => !o.destroyed && o.y < floor);
    this.coins = this.coins.filter(c => !c.collected && c.y < floor);
    this.gems = this.gems.filter(g => !g.collected && g.y < floor);
    this.powerUps = this.powerUps.filter(p => !p.collected && p.y < floor);
    this.bolts = this.bolts.filter(b => b.y > 0);
  }

  // ============================================================ collisions

  private collide(): void {
    const ship = this.player.hitbox();
    const ghost = this.hasPower('ghost');

    for (const o of this.obstacles) {
      if (o.destroyed || o.passed) continue;
      const box = o.hitbox();
      if (o.kind === 'laser') {
        this.collideLaser(o, box, ship, ghost);
      } else if (intersects(ship, box)) {
        if (!o.touched) {
          o.touched = true;
          if (!ghost) this.takeHit();
        }
      } else if (!o.touched) {
        o.closest = Math.min(o.closest, rectGap(ship, box));
      }
      if (this.gameState !== 'play') return;
      // A close pass is judged as the hazard draws level with the ship, so
      // the reward lands on the move that earned it; slipping in right
      // behind a hazard is caught when it has fully passed.
      const level = box.y + box.h >= this.player.y;
      const past = box.y > ship.y + ship.h;
      if (
        o.kind !== 'laser' &&
        (level || past) &&
        !o.nearMissed &&
        !o.touched &&
        o.closest <= NEAR_MISS_PX
      ) {
        this.nearMiss(o, ship);
      }
      if (past) {
        o.passed = true;
        if (o.kind === 'laser' && o.dodged && !o.touched) this.laserClear(o);
      }
    }

    this.collectPickups(ship);
    this.collideBolts();
  }

  private collideLaser(
    o: Obstacle,
    box: Rect,
    ship: Rect,
    ghost: boolean
  ): void {
    const overlap = box.y < ship.y + ship.h && box.y + box.h > ship.y;
    if (!overlap || o.touched) return;
    const right =
      (o.band === 'high' && this.player.isDucking()) ||
      (o.band === 'low' && this.player.isJumping());
    if (ghost) {
      o.touched = true;
    } else if (right) {
      o.dodged = true;
    } else {
      o.touched = true;
      this.takeHit();
    }
  }

  private takeHit(): void {
    if (this.player.isInvulnerable()) return;
    const shield = this.activePowerUps.find(p => p.type === 'shield');
    if (shield) {
      this.activePowerUps = this.activePowerUps.filter(p => p !== shield);
      this.player.setInvulnerable(0.6);
      this.particles.ring(
        this.player.x,
        this.player.y,
        POWERUP_CONFIG.shield.color,
        34
      );
      this.shake.shake(4, 0.2);
      this.popup(
        this.player.x,
        this.player.y - 40,
        'SHIELD',
        'HELD',
        POWERUP_CONFIG.shield.color
      );
      this.sound('hit');
      return;
    }
    this.lives--;
    this.player.setInvulnerable(HIT_INVULN);
    this.freeze = HIT_FREEZE;
    this.shake.shake(10, 0.35);
    this.hitFlash = 0.5;
    this.fever.onDamage();
    this.combo.breakChain();
    this.particles.sparks(this.player.x, this.player.y, HAZARD.signal, 10);
    this.sound('collision');
    if (this.lives <= 0) {
      this.die();
    } else {
      this.popup(this.player.x, this.player.y - 40, 'HULL', '-1', UI.bad);
    }
  }

  private nearMiss(o: Obstacle, ship: Rect): void {
    o.nearMissed = true;
    const pts = this.combo.addNearMiss();
    this.addPoints(pts);
    const b = o.hitbox();
    o.flash = 0.25;
    // Flash the edge that faced the ship.
    if (ship.x >= b.x + b.w) o.flashSide = 'right';
    else if (ship.x + ship.w <= b.x) o.flashSide = 'left';
    else o.flashSide = ship.y >= b.y + b.h ? 'bottom' : 'top';
    this.slowMo = NEAR_MISS_SLOWMO;
    this.popup(
      this.player.x,
      this.player.y - 44,
      'CLOSE',
      `+${pts}`,
      this.accentHex()
    );
    this.sound('success');
    this.services?.analytics?.trackFeatureUsage?.('tapdodge_near_miss');
  }

  private laserClear(o: Obstacle): void {
    const pts = this.combo.addClear();
    this.addPoints(pts);
    this.popup(
      this.player.x,
      this.player.y - 44,
      o.band === 'high' ? 'UNDER' : 'OVER',
      `+${pts}`,
      this.accentHex()
    );
    this.sound('success');
  }

  private collectPickups(ship: Rect): void {
    for (const c of this.coins) {
      if (c.collected || !intersects(ship, c.hitbox())) continue;
      c.collected = true;
      this.coinsTaken++;
      this.pickups++;
      this.combo.addCoin();
      this.addPoints(COIN_POINTS);
      this.particles.sparkle(c.x, c.y, UI.coin);
      this.popup(c.x, c.y - 16, '', `+${COIN_POINTS}`, UI.ink);
      this.sound('coin', 0.04);
    }
    for (const g of this.gems) {
      if (g.collected || !intersects(ship, g.hitbox())) continue;
      g.collected = true;
      this.gemsTaken++;
      this.pickups++;
      this.addPoints(GEM_POINTS);
      this.particles.burst(g.x, g.y, GEM.light);
      this.popup(g.x, g.y - 18, 'GEM', `+${GEM_POINTS}`, GEM.light);
      this.sound('powerup');
      this.services?.analytics?.trackFeatureUsage?.('tapdodge_gem_collected');
    }
    for (const p of this.powerUps) {
      if (p.collected || !intersects(ship, p.hitbox())) continue;
      p.collected = true;
      this.activatePowerUp(p.type);
      const style = POWERUP_CONFIG[p.type];
      this.particles.ring(p.x, p.y, style.color, 26);
      this.popup(p.x, p.y - 22, style.label, '', style.color);
      this.sound('powerup');
      this.services?.analytics?.trackFeatureUsage?.('tapdodge_power', {
        type: p.type,
      });
    }
  }

  private collideBolts(): void {
    for (const b of this.bolts) {
      for (const o of this.obstacles) {
        if (o.destroyed || !o.isDestructible()) continue;
        const box = o.hitbox();
        if (
          b.x > box.x &&
          b.x < box.x + box.w &&
          b.y > box.y &&
          b.y < box.y + box.h
        ) {
          o.destroyed = true;
          b.y = -100;
          this.addPoints(DRONE_KILL_POINTS);
          this.particles.sparks(o.x + o.w / 2, o.y + o.h / 2, HAZARD.signal, 8);
          this.sound('bounce');
          break;
        }
      }
    }
  }

  // ============================================================= power-ups

  private activatePowerUp(type: PowerUpType): void {
    const duration = POWERUP_CONFIG[type].duration;
    const existing = this.activePowerUps.find(p => p.type === type);
    if (existing) {
      existing.left = duration;
      existing.max = duration;
    } else {
      this.activePowerUps.push({ type, left: duration, max: duration });
    }
    if (type === 'drone') this.droneTimer = 0;
  }

  private updateActivePowerUps(dt: number): void {
    for (const p of this.activePowerUps) {
      p.left -= dt;
      // Coming out of ghost inside a hazard must not be an instant hit.
      if (p.left <= 0 && p.type === 'ghost') this.player.setInvulnerable(0.4);
    }
    this.activePowerUps = this.activePowerUps.filter(p => p.left > 0);
    if (this.hasPower('drone')) {
      this.droneTimer -= dt;
      if (this.droneTimer <= 0) {
        this.droneTimer = DRONE_FIRE_EVERY;
        this.bolts.push({ x: this.player.x + 30, y: this.player.y - 24 });
      }
    }
  }

  private hasPower(type: PowerUpType): boolean {
    return this.activePowerUps.some(p => p.type === type);
  }

  // ============================================================ progression

  private onProgress(ev: ProgressEvent): void {
    switch (ev.type) {
      case 'zone': {
        const zone = ZONES[ev.zone];
        this.backdrop.setZone(ev.zone);
        this.zoneFlip = 0;
        this.backdrop.paint(zone.name, zone.accent, `ZONE ${ev.zone + 1}`);
        this.sound('success');
        break;
      }
      case 'rush-warning':
        this.backdrop.paint('RUSH', RUSH_HOT, '', true);
        this.sound('laser');
        break;
      case 'rush-start':
        this.shake.shake(5, 0.3);
        this.sound('whoosh');
        break;
      case 'rush-clear':
        this.addPoints(RUSH_POINTS);
        this.backdrop.paint('CLEAR', this.accentHex(), `+${RUSH_POINTS}`);
        this.popup(
          this.player.x,
          this.player.y - 60,
          'RUSH',
          `+${RUSH_POINTS}`,
          RUSH_HOT
        );
        this.sound('unlock');
        break;
    }
  }

  // ================================================================== end

  private die(): void {
    this.gameState = 'dying';
    this.phaseTime = 0;
    this.freeze = 0;
    this.particles.explode(this.player.x, this.player.y, SHIP.hull, SHIP.glow);
    this.shake.shake(14, 0.6);
    this.hitFlash = 0.9;
    this.progression.abandonRush();
    this.sound('explosion');
    this.stats = this.buildStats();
    this.services?.analytics?.trackFeatureUsage?.('tapdodge_game_over', {
      score: this.score,
      zone: this.progression.zoneIndex,
    });
  }

  private updateDying(dt: number): void {
    this.particles.update(dt);
    this.shake.update(dt);
    this.updatePopups(dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    // The road coasts to a stop under the wreck.
    const k = Math.max(0, 1 - this.phaseTime / DEATH_BEAT);
    const dy = this.progression.speed() * dt * k * k;
    for (const o of this.obstacles) o.update(dy, dt * k);
    for (const c of this.coins) c.update(dy, dt * k);
    for (const g of this.gems) g.update(dy, dt * k);
    for (const p of this.powerUps) p.update(dy, dt * k);
    this.backdrop.update(dt, dy);
    if (this.phaseTime >= DEATH_BEAT) {
      this.gameState = 'recap';
      this.phaseTime = 0;
    }
  }

  private updateRecap(dt: number, intents: Intents): void {
    this.particles.update(dt);
    const skip = intents.anyPress && this.phaseTime >= RECAP_MIN_INPUT;
    if (skip || this.phaseTime >= RECAP_SECONDS) {
      if (skip) this.sound('click');
      this.finish();
    }
  }

  private buildStats(): RunStats {
    const zone = this.progression.zoneIndex;
    return {
      score: this.score,
      best: this.bestAtStart,
      newBest: this.score > this.bestAtStart,
      survival: this.runTime,
      nearMisses: this.combo.getNearMisses(),
      maxChain: this.combo.getMaxChain(),
      coins: this.coinsTaken,
      gems: this.gemsTaken,
      maxFever: this.fever.maxLevelReached,
      maxFeverName: FEVER_LEVELS[this.fever.maxLevelReached].name,
      zone,
      zoneName: ZONES[zone].name,
      rushes: this.progression.rushesCleared,
    };
  }

  private finish(): void {
    this.gameState = 'done';
    // Set before endGame(): getScore() inside it merges these in.
    this.extendedGameData = {
      survival_time: this.runTime,
      near_misses: this.combo.getNearMisses(),
      max_near_chain: this.combo.getMaxChain(),
      coins_collected: this.pickups,
      gems_collected: this.gemsTaken,
      max_combo: this.combo.getMaxCoinCombo(),
      zone_reached: this.progression.zoneIndex,
      max_fever_level: this.fever.maxLevelReached,
      rushes_cleared: this.progression.rushesCleared,
    };
    this.endGame();
  }

  protected onGameEnd(finalScore: GameScore): void {
    try {
      const prev = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
      if (finalScore.score > prev) {
        localStorage.setItem(BEST_KEY, String(finalScore.score));
      }
    } catch {
      // Private mode or storage full: the best just is not remembered.
    }
    this.best = Math.max(this.best, finalScore.score);

    const track = (key: string, value: number) =>
      this.services?.analytics?.trackGameSpecificStat?.('tapdodge', key, value);
    track('survival_time', this.runTime);
    track('near_misses', this.combo.getNearMisses());
    track('coins_collected', this.pickups);
    track('gems_collected', this.gemsTaken);
    track('max_combo', this.combo.getMaxCoinCombo());
    track('max_fever', this.fever.maxLevelReached);
  }

  // ============================================================== helpers

  private addPoints(points: number): void {
    this.scoreAcc += points;
    this.score = Math.floor(this.scoreAcc);
  }

  private popup(
    x: number,
    y: number,
    label: string,
    value: string,
    color: string
  ): void {
    if (this.popups.length >= 8) this.popups.shift();
    this.popups.push({ x, y, label, value, color, life: 0.7, max: 0.7 });
  }

  private updatePopups(dt: number): void {
    for (const p of this.popups) p.life -= dt;
    this.popups = this.popups.filter(p => p.life > 0);
  }

  /** Play a sound at most once per `gap` seconds of game time. */
  private sound(name: SoundName, gap = 0.05, volume?: number): void {
    const last = this.soundAt.get(name);
    if (last !== undefined && this.gameTime - last < gap) return;
    this.soundAt.set(name, this.gameTime);
    this.services?.audio?.playSound?.(
      name,
      volume === undefined ? undefined : { volume }
    );
  }

  private accentHex(): string {
    return ZONES[this.progression.zoneIndex].accent;
  }

  // ================================================================ render

  protected onRender(ctx: CanvasRenderingContext2D): void {
    this.renderWorld(ctx);
  }

  private renderWorld(ctx: CanvasRenderingContext2D): void {
    const offset = this.shake.getOffset();
    ctx.save();
    ctx.translate(offset.x, offset.y);
    this.backdrop.render(ctx, this.gameTime, this.progression.rushBlend);

    if (this.fever.level > 0) {
      // Fever warms the air: 1% a level, 4% at the top (the cap is 6%).
      ctx.fillStyle = withAlpha(
        this.fever.info().color,
        0.01 * this.fever.level
      );
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    for (const c of this.coins) c.render(ctx);
    for (const g of this.gems) g.render(ctx);
    for (const p of this.powerUps) p.render(ctx);
    // HIGH beams hang above the road, so they draw over the ship (a duck
    // reads as passing under); everything else sits on the road beneath it.
    for (const o of this.obstacles) if (o.band !== 'high') o.render(ctx);

    if (this.bolts.length > 0) {
      ctx.fillStyle = POWERUP_CONFIG.drone.color;
      for (const b of this.bolts) ctx.fillRect(b.x - 1.5, b.y - 8, 3, 12);
    }

    const alive = this.gameState === 'ready' || this.gameState === 'play';
    if (alive) {
      if (this.hasPower('drone')) {
        icon(
          ctx,
          'drone',
          this.player.x + 30,
          this.player.y - 16,
          16,
          POWERUP_CONFIG.drone.color
        );
      }
      this.player.render(ctx, {
        speedFactor: this.progression.speedFactor(),
        shield: this.hasPower('shield'),
        ghost: this.hasPower('ghost'),
        time: this.gameTime,
      });
    }
    for (const o of this.obstacles) if (o.band === 'high') o.render(ctx);
    this.particles.render(ctx);
    ctx.restore();

    const slow = this.hasPower('slow') ? 0.6 : this.slowMo / NEAR_MISS_SLOWMO;
    if (slow > 0)
      edgeVignette(ctx, VIEW_W, VIEW_H, this.accentHex(), slow * 0.5);
    if (this.hitFlash > 0) {
      edgeVignette(
        ctx,
        VIEW_W,
        VIEW_H,
        UI.bad,
        Math.min(1, this.hitFlash * 1.8)
      );
    }
    if (this.lives === 1 && this.gameState === 'play') {
      edgeVignette(
        ctx,
        VIEW_W,
        VIEW_H,
        UI.bad,
        0.3 + 0.12 * Math.sin(this.gameTime * 5)
      );
    }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    this.hud.renderPopups(ctx, this.popups);
    this.hud.renderBands(ctx, this.hudState());
    if (this.gameState === 'ready') {
      this.hud.renderReady(
        ctx,
        this.accentHex(),
        this.phaseTime / READY_SECONDS
      );
    } else if (this.gameState === 'recap' && this.stats) {
      this.dimPlayfield(ctx, Math.min(0.5, this.phaseTime * 2));
      this.recap.render(
        ctx,
        this.stats,
        gradeRun(this.stats),
        this.accentHex(),
        this.phaseTime,
        this.phaseTime / RECAP_SECONDS
      );
    }
  }

  /** The finished run, still and dimmed, under the shell's summary. */
  protected onRenderEnded(ctx: CanvasRenderingContext2D): void {
    this.renderWorld(ctx);
    this.hud.renderBands(ctx, this.hudState());
    if (this.stats) {
      this.dimPlayfield(ctx, 0.5);
      this.recap.render(
        ctx,
        this.stats,
        gradeRun(this.stats),
        this.accentHex(),
        0,
        1,
        true
      );
    }
    ctx.fillStyle = 'rgba(4, 6, 12, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private dimPlayfield(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.fillStyle = `rgba(4, 6, 12, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private hudState(): HudState {
    const p = this.progression;
    const info = this.fever.info();
    return {
      score: this.score,
      best: this.bestAtStart,
      zone: p.zoneIndex,
      zoneCount: ZONES.length,
      zoneName: ZONES[p.zoneIndex].name,
      zoneProgress: p.zoneProgress(),
      nextZoneIn: p.secondsToNextZone(),
      accent: rgba(this.backdrop.accentRgb(), 1),
      rushPhase: p.rushPhase,
      rushTimer: p.rushTimer,
      rushLength: RUSH_LENGTH,
      feverName: info.name,
      feverMult: info.multiplier,
      feverColor: info.color,
      feverProgress: this.fever.progress(),
      feverFlash: this.fever.flash,
      chain: this.combo.getChain(),
      combo: this.combo.getCoinCombo(),
      lives: Math.max(0, this.lives),
      maxLives: MAX_LIVES,
      powerUps: this.activePowerUps,
      zoneFlip: this.zoneFlip,
      time: this.gameTime,
    };
  }
}
