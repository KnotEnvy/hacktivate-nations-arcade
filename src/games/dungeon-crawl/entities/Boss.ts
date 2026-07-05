// ===== src/games/dungeon-crawl/entities/Boss.ts =====
// v2 — kit-driven Guardian boss. Three kits (Ember Guardian / Bone Colossus /
// Hollow King) share one phase machine: pursue → telegraph → attack → recover,
// speeding up when enraged. DungeonCrawlGame resolves damage and rewards.

import { BOSS } from '../data/enemies';
import { BossAttackKind, BossKit, bossKitForTier } from '../data/bosses';
import { EnemyTypeId } from '../data/enemies';
import { Rng } from '../dungeon/rng';
import { TileMap } from '../dungeon/TileMap';

export type BossPhase = 'pursue' | 'telegraph' | 'charge' | 'recover';

export interface BossUpdateContext {
  playerX: number;
  playerY: number;
  map: TileMap;
  rng: Rng;
  fireBolt: (x: number, y: number, dirX: number, dirY: number, speed: number) => void;
  /** v2 — Hollow King: bolt that steers toward the player. */
  fireHomingBolt: (x: number, y: number, dirX: number, dirY: number, speed: number) => void;
  /** v2 — Bone Colossus: expanding shockwave ring (delay staggers pairs). */
  spawnShockwave: (x: number, y: number, delay: number) => void;
  /** v2 — Hollow King: game picks a safe reappear spot near the player. */
  requestTeleportSpot: () => { x: number; y: number };
  summonMinion: (x: number, y: number, type: EnemyTypeId) => void;
  minionCount: () => number;
  onChargeSlam: (x: number, y: number) => void; // wall impact feedback
  onTeleport: (fromX: number, fromY: number, toX: number, toY: number) => void;
}

export class Boss {
  alive = true;
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  readonly tier: number; // 1-based boss encounter number
  readonly kit: BossKit;
  flash = 0;

  phase: BossPhase = 'pursue';
  phaseTimer: number = BOSS.PURSUE_TIME;
  pendingAttack: BossAttackKind = 'charge';
  private chargeDirX = 0;
  private chargeDirY = 0;
  private attackCycle = 0;
  fading = 0; // teleport fade animation (0..1 = how vanished)

  constructor(x: number, y: number, tier: number) {
    this.x = x;
    this.y = y;
    this.tier = tier;
    this.kit = bossKitForTier(tier);
    this.maxHp = Math.round((BOSS.BASE_HP + BOSS.HP_PER_TIER * (tier - 1)) * this.kit.hpMult);
    this.hp = this.maxHp;
  }

  get size(): number {
    return BOSS.SIZE;
  }

  get radius(): number {
    return BOSS.SIZE / 2;
  }

  get enraged(): boolean {
    return this.hp <= this.maxHp * BOSS.ENRAGE_THRESHOLD;
  }

  get isCharging(): boolean {
    return this.phase === 'charge';
  }

  private speedScale(): number {
    return (this.enraged ? 1.45 : 1) * this.kit.speedMult;
  }

  private nextAttack(ctx: BossUpdateContext): BossAttackKind {
    let attack = this.kit.attackCycle[this.attackCycle % this.kit.attackCycle.length];
    if (attack === 'summon' && ctx.minionCount() >= BOSS.MAX_MINIONS) {
      attack = 'spread';
    }
    this.attackCycle++;
    return attack;
  }

  update(dt: number, ctx: BossUpdateContext): void {
    if (!this.alive) return;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.fading > 0) this.fading = Math.max(0, this.fading - dt * 3);

    const dx = ctx.playerX - this.x;
    const dy = ctx.playerY - this.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const dirX = dx / dist;
    const dirY = dy / dist;

    this.phaseTimer -= dt * this.speedScale();

    switch (this.phase) {
      case 'pursue': {
        const moved = ctx.map.moveWithCollision(
          this.x,
          this.y,
          this.size,
          dirX * BOSS.SPEED * this.speedScale() * dt,
          dirY * BOSS.SPEED * this.speedScale() * dt,
        );
        this.x = moved.x;
        this.y = moved.y;
        if (this.phaseTimer <= 0) {
          this.pendingAttack = this.nextAttack(ctx);
          this.phase = 'telegraph';
          this.phaseTimer = BOSS.TELEGRAPH_TIME;
          this.chargeDirX = dirX;
          this.chargeDirY = dirY;
        }
        break;
      }
      case 'telegraph': {
        // Locked in place, glowing — the player's dodge window.
        if (this.phaseTimer <= 0) this.executeAttack(ctx, dirX, dirY);
        break;
      }
      case 'charge': {
        const moved = ctx.map.moveWithCollision(
          this.x,
          this.y,
          this.size,
          this.chargeDirX * BOSS.CHARGE_SPEED * dt,
          this.chargeDirY * BOSS.CHARGE_SPEED * dt,
        );
        this.x = moved.x;
        this.y = moved.y;
        if (moved.hitX || moved.hitY || this.phaseTimer <= 0) {
          ctx.onChargeSlam(this.x, this.y);
          this.phase = 'recover';
          this.phaseTimer = this.enraged ? 0.5 : 0.9; // stunned window = punish opening
        }
        break;
      }
      case 'recover': {
        if (this.phaseTimer <= 0) {
          this.phase = 'pursue';
          this.phaseTimer = BOSS.PURSUE_TIME * (this.enraged ? 0.6 : 1);
        }
        break;
      }
    }
  }

  private executeAttack(ctx: BossUpdateContext, dirX: number, dirY: number): void {
    switch (this.pendingAttack) {
      case 'charge': {
        this.phase = 'charge';
        this.phaseTimer = 1.4; // hard cap; usually ends on a wall
        this.chargeDirX = dirX;
        this.chargeDirY = dirY;
        return;
      }
      case 'spread': {
        const bolts = this.enraged ? BOSS.SPREAD_BOLTS + 4 : BOSS.SPREAD_BOLTS;
        for (let i = 0; i < bolts; i++) {
          const angle = (i / bolts) * Math.PI * 2 + ctx.rng.range(0, 0.3);
          ctx.fireBolt(this.x, this.y, Math.cos(angle), Math.sin(angle), BOSS.SPREAD_BOLT_SPEED);
        }
        this.phase = 'recover';
        this.phaseTimer = 0.8;
        return;
      }
      case 'summon': {
        for (let i = 0; i < BOSS.SUMMON_COUNT; i++) {
          const angle = ctx.rng.range(0, Math.PI * 2);
          const type = ctx.rng.pick(this.kit.summons);
          ctx.summonMinion(this.x + Math.cos(angle) * 60, this.y + Math.sin(angle) * 60, type);
        }
        this.phase = 'recover';
        this.phaseTimer = 1.0;
        return;
      }
      case 'slam': {
        // Two staggered rings; enrage adds a third.
        ctx.spawnShockwave(this.x, this.y, 0);
        ctx.spawnShockwave(this.x, this.y, 0.3);
        if (this.enraged) ctx.spawnShockwave(this.x, this.y, 0.6);
        this.phase = 'recover';
        this.phaseTimer = 1.1;
        return;
      }
      case 'teleport': {
        const from = { x: this.x, y: this.y };
        const spot = ctx.requestTeleportSpot();
        this.x = spot.x;
        this.y = spot.y;
        this.fading = 1;
        ctx.onTeleport(from.x, from.y, spot.x, spot.y);
        // Reappear burst punishes standing next to the arrival point.
        const bolts = this.enraged ? 8 : 6;
        for (let i = 0; i < bolts; i++) {
          const angle = (i / bolts) * Math.PI * 2;
          ctx.fireBolt(this.x, this.y, Math.cos(angle), Math.sin(angle), BOSS.SPREAD_BOLT_SPEED * 0.85);
        }
        this.phase = 'recover';
        this.phaseTimer = 0.7;
        return;
      }
      case 'homing': {
        const count = this.enraged ? 4 : 3;
        for (let i = 0; i < count; i++) {
          const angle = Math.atan2(this.chargeDirY, this.chargeDirX) + (i - (count - 1) / 2) * 0.5;
          ctx.fireHomingBolt(this.x, this.y, Math.cos(angle), Math.sin(angle), 150);
        }
        this.phase = 'recover';
        this.phaseTimer = 0.9;
        return;
      }
    }
  }
}
