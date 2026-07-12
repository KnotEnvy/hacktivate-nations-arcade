// ===== src/games/dungeon-crawl/entities/Enemy.ts =====
// Data-driven monster. One class interprets every archetype's behavior from
// ENEMY_CONFIGS; DungeonCrawlGame resolves damage, deaths and drops.

import {
  BOMBER,
  ELITE_CONFIGS,
  EliteConfig,
  EliteTrait,
  ENEMY_CONFIGS,
  EnemyConfig,
  EnemyTypeId,
  SORCERER,
} from '../data/enemies';
import { Rng } from '../dungeon/rng';
import { TileMap } from '../dungeon/TileMap';
import type { DeathCause } from '../systems/Combat';

let nextEnemyId = 1;

export interface EnemyUpdateContext {
  playerX: number;
  playerY: number;
  map: TileMap;
  rng: Rng;
  /** Spawn a hostile bolt toward a direction (unit vector supplied). */
  fireBolt: (
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    cause?: DeathCause, // v4 Wave D — recap flavor per shooter (default sorcery)
  ) => void;
  /** v2 — lob an arcing bomb that lands at the target point. */
  throwBomb: (x: number, y: number, targetX: number, targetY: number) => void;
  /** Mimic woke up this frame. */
  onMimicWake: (enemy: Enemy) => void;
  /** v3 — thief Hide in Shadows: aggro drops and cannot re-acquire. */
  playerHidden?: boolean;
}

export class Enemy {
  readonly id: number;
  readonly config: EnemyConfig;
  readonly elite: EliteConfig | null; // v2 — elite trait, null for regulars
  alive = true;
  x: number;
  y: number;
  hp: number;
  flash = 0; // white damage flash
  facingX = 0;
  facingY = 1;

  // Knockback impulse decays quickly.
  private kbX = 0;
  private kbY = 0;

  // Behavior state.
  aggro = false;
  stunned = 0; // v3 — Turn Undead freeze, seconds remaining
  dormant: boolean; // mimic only — looks like a chest until woken
  private wanderTimer = 0;
  private wanderDirX = 0;
  private wanderDirY = 0;
  private fireTimer: number;
  windup = 0; // sorcerer/bomber telegraph (also drawn)
  private flitPhase: number;

  constructor(
    type: EnemyTypeId,
    x: number,
    y: number,
    elite: EliteTrait | null = null,
    hpMult = 1, // v4 — level pressure: hero level scales monster vitality
  ) {
    this.id = nextEnemyId++;
    this.config = ENEMY_CONFIGS[type];
    this.elite = elite ? ELITE_CONFIGS[elite] : null;
    this.x = x;
    this.y = y;
    this.hp = Math.max(1, Math.round(this.config.hp * (this.elite?.hpMult ?? 1) * hpMult));
    this.dormant = this.config.behavior === 'mimic';
    this.fireTimer = SORCERER.FIRE_INTERVAL * (0.5 + Math.random() * 0.5);
    this.flitPhase = Math.random() * Math.PI * 2;
  }

  get size(): number {
    return this.config.size;
  }

  get radius(): number {
    // Elites read slightly larger on screen AND in collision — fair warning.
    return (this.config.size / 2) * (this.elite ? 1.2 : 1);
  }

  get moveSpeed(): number {
    return this.config.speed * (this.elite?.speedMult ?? 1);
  }

  applyKnockback(dirX: number, dirY: number, force: number): void {
    // Armored knights barely budge; mimics are heavy chests; wraiths are mist.
    const behavior = this.config.behavior;
    let resist =
      behavior === 'armored' || behavior === 'mimic' ? 0.35 : behavior === 'wraith' ? 0.2 : 1;
    resist *= this.elite?.knockbackMult ?? 1;
    this.kbX += dirX * force * resist;
    this.kbY += dirY * force * resist;
  }

  /** Wake a dormant mimic (proximity or a hit). */
  wake(ctx: EnemyUpdateContext): void {
    if (!this.dormant) return;
    this.dormant = false;
    this.aggro = true;
    ctx.onMimicWake(this);
  }

  /**
   * True when a melee hit from the given direction is blocked by knight armor.
   * A knight faces the player; hits aligned with its facing (i.e. from the
   * front) clang off. Daggers ignore this — resolved by the game.
   */
  blocksFrontalHit(hitDirX: number, hitDirY: number): boolean {
    if (this.config.behavior !== 'armored') return false;
    // Hit direction travels attacker -> knight. Frontal when it opposes facing.
    const dot = hitDirX * this.facingX + hitDirY * this.facingY;
    return dot < -0.25;
  }

  update(dt: number, ctx: EnemyUpdateContext): void {
    if (!this.alive) return;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.windup > 0) this.windup = Math.max(0, this.windup - dt);

    // v3 — stunned: frozen in place except for knockback decay.
    if (this.stunned > 0) {
      this.stunned = Math.max(0, this.stunned - dt);
      this.applyKnockbackStep(dt, ctx.map);
      return;
    }

    // v3 — a hidden player is no player at all: drop and block aggro.
    if (ctx.playerHidden) this.aggro = false;

    const dx = ctx.playerX - this.x;
    const dy = ctx.playerY - this.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Track facing toward the player whenever aggro'd (knights block with it).
    if (this.aggro) {
      this.facingX = dirX;
      this.facingY = dirY;
    }

    // Dormant mimic: wait for the ambush.
    if (this.dormant) {
      if (dist < this.config.aggroRange) this.wake(ctx);
      this.applyKnockbackStep(dt, ctx.map);
      return;
    }

    // Aggro check — needs proximity, chasers also need line of sight once.
    // Wraiths sense through walls: proximity alone wakes them.
    if (!this.aggro && !ctx.playerHidden && dist < this.config.aggroRange) {
      if (
        this.config.behavior === 'wraith' ||
        ctx.map.hasLineOfSight(this.x, this.y, ctx.playerX, ctx.playerY)
      ) {
        this.aggro = true;
      }
    }

    let moveX = 0;
    let moveY = 0;
    const behavior = this.config.behavior;

    if (behavior === 'wander' || (!this.aggro && behavior !== 'ranged')) {
      // Amble in a random direction, re-rolling every couple seconds.
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = ctx.rng.range(1.2, 2.6);
        if (ctx.rng.chance(0.35)) {
          this.wanderDirX = 0;
          this.wanderDirY = 0;
        } else {
          const angle = ctx.rng.range(0, Math.PI * 2);
          this.wanderDirX = Math.cos(angle);
          this.wanderDirY = Math.sin(angle);
        }
      }
      moveX = this.wanderDirX;
      moveY = this.wanderDirY;
      // Aggro'd slimes still lurch toward the player.
      if (this.aggro && behavior === 'wander') {
        moveX = moveX * 0.4 + dirX * 0.6;
        moveY = moveY * 0.4 + dirY * 0.6;
      }
    } else if (behavior === 'chase' || behavior === 'armored' || behavior === 'mimic' || behavior === 'wraith') {
      if (this.aggro) {
        moveX = dirX;
        moveY = dirY;
      }
    } else if (behavior === 'flit') {
      if (this.aggro) {
        // Erratic weave: chase vector plus a perpendicular sine wobble.
        this.flitPhase += dt * 7;
        const wobble = Math.sin(this.flitPhase) * 0.9;
        moveX = dirX + -dirY * wobble;
        moveY = dirY + dirX * wobble;
      }
    } else if (behavior === 'ranged') {
      if (this.aggro) {
        // Hold the preferred band; back off when crowded.
        if (dist < SORCERER.PREFERRED_MIN) {
          moveX = -dirX;
          moveY = -dirY;
        } else if (dist > SORCERER.PREFERRED_MAX) {
          moveX = dirX;
          moveY = dirY;
        }
        // Fire cycle with a visible windup.
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.windup <= 0) {
          if (ctx.map.hasLineOfSight(this.x, this.y, ctx.playerX, ctx.playerY)) {
            this.windup = SORCERER.WINDUP;
            this.fireTimer = SORCERER.FIRE_INTERVAL;
          } else {
            this.fireTimer = 0.4; // reposition and retry soon
          }
        }
        if (this.windup > 0 && this.windup - dt <= 0) {
          ctx.fireBolt(this.x, this.y, dirX, dirY, SORCERER.BOLT_SPEED, this.config.boltCause);
        }
      } else if (!ctx.playerHidden && dist < this.config.aggroRange) {
        this.aggro = ctx.map.hasLineOfSight(this.x, this.y, ctx.playerX, ctx.playerY);
      }
    } else if (behavior === 'bomber') {
      if (this.aggro) {
        // Hold the lob band, backing off when crowded.
        if (dist < BOMBER.PREFERRED_MIN) {
          moveX = -dirX;
          moveY = -dirY;
        } else if (dist > BOMBER.PREFERRED_MAX) {
          moveX = dirX;
          moveY = dirY;
        }
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.windup <= 0) {
          this.windup = BOMBER.WINDUP;
          this.fireTimer = BOMBER.THROW_INTERVAL;
        }
        if (this.windup > 0 && this.windup - dt <= 0) {
          // Lead the throw a touch past the player so walking away still risks it.
          const lead = dist * BOMBER.LEAD;
          ctx.throwBomb(
            this.x,
            this.y,
            ctx.playerX + dirX * lead + ctx.rng.range(-14, 14),
            ctx.playerY + dirY * lead + ctx.rng.range(-14, 14),
          );
        }
      }
    }

    const len = Math.hypot(moveX, moveY);
    if (len > 0.001) {
      const speed = this.moveSpeed;
      if (behavior === 'wraith') {
        // Wraiths drift straight through walls (their whole identity).
        this.x += (moveX / len) * speed * dt;
        this.y += (moveY / len) * speed * dt;
      } else {
        const moved = ctx.map.moveWithCollision(
          this.x,
          this.y,
          this.size,
          (moveX / len) * speed * dt,
          (moveY / len) * speed * dt,
        );
        this.x = moved.x;
        this.y = moved.y;
        // Wanderers bounce off walls instead of hugging them.
        if ((moved.hitX || moved.hitY) && !this.aggro) this.wanderTimer = 0;
      }
    }

    this.applyKnockbackStep(dt, ctx.map);
  }

  private applyKnockbackStep(dt: number, map: TileMap): void {
    if (Math.abs(this.kbX) < 1 && Math.abs(this.kbY) < 1) {
      this.kbX = 0;
      this.kbY = 0;
      return;
    }
    const moved = map.moveWithCollision(this.x, this.y, this.size, this.kbX * dt, this.kbY * dt);
    this.x = moved.x;
    this.y = moved.y;
    const decay = Math.pow(0.0001, dt); // ~fully gone in a third of a second
    this.kbX *= decay;
    this.kbY *= decay;
  }
}
