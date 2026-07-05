// ===== src/games/dungeon-crawl/entities/Player.ts =====
// The hero: smooth tile-collided movement, sword arc melee, dagger throwing,
// hearts, i-frames, and relic/potion stat stacking. DungeonCrawlGame owns
// damage bookkeeping; this class owns the body.

import { PLAYER, PICKUPS, PotionBuff } from '../data/constants';
import { RelicId, RELIC_TUNING } from '../data/relics';
import { TileMap } from '../dungeon/TileMap';

export interface SwordSwing {
  timer: number; // counts down from SWORD_ACTIVE while damage window is live
  dirX: number;
  dirY: number;
  hitIds: Set<number>; // enemies already damaged by this swing
}

export class Player {
  x = 0;
  y = 0;
  readonly size = PLAYER.HITBOX;

  hp: number = PLAYER.MAX_HP;
  maxHp: number = PLAYER.MAX_HP;
  invuln = 0; // i-frame seconds remaining
  hitFlash = 0;

  // Facing — unit-ish vector of last movement (defaults to "down" for the sprite).
  faceX = 0;
  faceY = 1;
  moving = false;

  daggers: number = PLAYER.START_DAGGERS;
  keys = 0;

  swing: SwordSwing | null = null;
  private swordCooldown = 0;
  private daggerCooldown = 0;
  swingAnim = 0; // longer visual tail than the damage window

  // v2 — dodge dash.
  dashTimer = 0; // > 0 while mid-dash
  dashCooldown = 0;
  private dashDirX = 0;
  private dashDirY = 1;

  // Relic stacks + potion buffs.
  relics = new Map<RelicId, number>();
  buffs = new Map<PotionBuff, number>(); // buff -> seconds remaining
  killsSinceHeal = 0; // vampire fang counter
  phoenixUsed = 0; // consumed Phoenix Feather stacks

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.hp = PLAYER.MAX_HP;
    this.maxHp = PLAYER.MAX_HP;
    this.invuln = 0;
    this.hitFlash = 0;
    this.faceX = 0;
    this.faceY = 1;
    this.daggers = PLAYER.START_DAGGERS;
    this.keys = 0;
    this.swing = null;
    this.swordCooldown = 0;
    this.daggerCooldown = 0;
    this.swingAnim = 0;
    this.relics.clear();
    this.buffs.clear();
    this.killsSinceHeal = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.phoenixUsed = 0;
  }

  /** Move to a new floor: position resets, run state (relics, hp) persists. */
  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.swing = null;
    this.swingAnim = 0;
    this.dashTimer = 0;
  }

  relicCount(id: RelicId): number {
    return this.relics.get(id) ?? 0;
  }

  addRelic(id: RelicId): void {
    this.relics.set(id, this.relicCount(id) + 1);
    if (id === 'tower-shield') {
      this.maxHp = Math.min(PLAYER.HP_CAP, this.maxHp + RELIC_TUNING.TOWER_SHIELD_HP);
      this.hp = Math.min(this.maxHp, this.hp + RELIC_TUNING.TOWER_SHIELD_HP);
    }
    if (id === 'dagger-sage') {
      this.daggers = Math.min(this.daggerCap(), this.daggers + 2);
    }
  }

  daggerCap(): number {
    return PLAYER.DAGGER_CAP + this.relicCount('dagger-sage') * RELIC_TUNING.DAGGER_SAGE_CAP_BONUS;
  }

  daggersPierce(): boolean {
    return this.relicCount('dagger-sage') > 0;
  }

  speed(): number {
    let mult = 1 + this.relicCount('swift-boots') * RELIC_TUNING.SWIFT_BOOTS_SPEED_MULT;
    if (this.buffs.has('haste')) mult *= 1.35;
    return PLAYER.SPEED * mult;
  }

  swordDamage(): number {
    let dmg = 1 + this.relicCount('ember-blade') * RELIC_TUNING.EMBER_BLADE_DAMAGE;
    if (this.buffs.has('strength')) dmg += 1;
    if (
      this.relicCount('berserker-rage') > 0 &&
      this.hp <= RELIC_TUNING.BERSERKER_THRESHOLD_HP
    ) {
      dmg += RELIC_TUNING.BERSERKER_DAMAGE * this.relicCount('berserker-rage');
    }
    return dmg;
  }

  daggerDamage(): number {
    return this.swordDamage(); // daggers ride the same stat stack
  }

  torchBonus(): number {
    return this.relicCount('keen-eye');
  }

  hasCoinMagnet(): boolean {
    return this.relicCount('coin-magnet') > 0;
  }

  addBuff(buff: PotionBuff): void {
    this.buffs.set(buff, PICKUPS.POTION_DURATION);
  }

  /** Returns true if damage was applied (not absorbed / i-framed). */
  takeDamage(amount: number): boolean {
    if (this.invuln > 0) return false;
    if (this.buffs.has('stoneskin')) {
      this.buffs.delete('stoneskin'); // absorbs one hit, then shatters
      this.invuln = PLAYER.HIT_INVULN * 0.5;
      return false;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = PLAYER.HIT_INVULN;
    this.hitFlash = 0.4;
    return true;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * v2 — Phoenix Feather: consume an unspent stack to cheat death.
   * Returns true when the revive fired (caller restores the run).
   */
  tryConsumePhoenix(): boolean {
    if (this.relicCount('phoenix-feather') <= this.phoenixUsed) return false;
    this.phoenixUsed++;
    this.hp = RELIC_TUNING.PHOENIX_REVIVE_HP;
    this.invuln = RELIC_TUNING.PHOENIX_INVULN;
    this.hitFlash = 0;
    return true;
  }

  /** Vampire Fang bookkeeping — call once per kill; returns true when it heals. */
  onKill(): boolean {
    if (this.relicCount('vampire-fang') === 0) return false;
    this.killsSinceHeal++;
    const needed = Math.max(
      3,
      Math.ceil(RELIC_TUNING.VAMPIRE_KILLS_PER_HEAL / this.relicCount('vampire-fang')),
    );
    if (this.killsSinceHeal >= needed) {
      this.killsSinceHeal = 0;
      this.heal(1);
      return true;
    }
    return false;
  }

  update(dt: number, moveX: number, moveY: number, map: TileMap): void {
    // Timers.
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.swordCooldown > 0) this.swordCooldown = Math.max(0, this.swordCooldown - dt);
    if (this.daggerCooldown > 0) this.daggerCooldown = Math.max(0, this.daggerCooldown - dt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.swingAnim > 0) this.swingAnim = Math.max(0, this.swingAnim - dt);
    if (this.swing) {
      this.swing.timer -= dt;
      if (this.swing.timer <= 0) this.swing = null;
    }
    for (const [buff, remaining] of this.buffs) {
      const next = remaining - dt;
      if (next <= 0) this.buffs.delete(buff);
      else this.buffs.set(buff, next);
    }

    // Mid-dash: locked into the dash vector, normal steering suspended.
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      const moved = map.moveWithCollision(
        this.x,
        this.y,
        this.size,
        this.dashDirX * PLAYER.DASH_SPEED * dt,
        this.dashDirY * PLAYER.DASH_SPEED * dt,
      );
      this.x = moved.x;
      this.y = moved.y;
      this.moving = true;
      return;
    }

    // Movement (normalized diagonals).
    this.moving = moveX !== 0 || moveY !== 0;
    if (this.moving) {
      const len = Math.hypot(moveX, moveY);
      const nx = moveX / len;
      const ny = moveY / len;
      this.faceX = nx;
      this.faceY = ny;
      const speed = this.speed();
      const moved = map.moveWithCollision(this.x, this.y, this.size, nx * speed * dt, ny * speed * dt);
      this.x = moved.x;
      this.y = moved.y;
    }
  }

  /**
   * v2 — attempt a dash toward the held movement direction (facing when
   * standing still). Returns true when the dash started.
   */
  tryDash(moveX: number, moveY: number): boolean {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return false;
    let dx = moveX;
    let dy = moveY;
    if (dx === 0 && dy === 0) {
      dx = this.faceX;
      dy = this.faceY;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirX = dx / len;
    this.dashDirY = dy / len;
    this.faceX = this.dashDirX;
    this.faceY = this.dashDirY;
    this.dashTimer = PLAYER.DASH_DURATION;
    const cloak = this.relicCount('shadow-cloak');
    this.dashCooldown =
      PLAYER.DASH_COOLDOWN * Math.pow(RELIC_TUNING.SHADOW_CLOAK_COOLDOWN_MULT, cloak);
    // Dash grants i-frames through the burst plus a small tail.
    const iframes =
      PLAYER.DASH_DURATION +
      PLAYER.DASH_IFRAME_TAIL +
      cloak * RELIC_TUNING.SHADOW_CLOAK_IFRAME_BONUS;
    this.invuln = Math.max(this.invuln, iframes);
    return true;
  }

  /** Fraction of dash cooldown remaining (1 = just used, 0 = ready). */
  dashCooldownFrac(): number {
    const cloak = this.relicCount('shadow-cloak');
    const full = PLAYER.DASH_COOLDOWN * Math.pow(RELIC_TUNING.SHADOW_CLOAK_COOLDOWN_MULT, cloak);
    return full > 0 ? this.dashCooldown / full : 0;
  }

  /** Attempt a sword swing. Returns true if it started (cooldown ready). */
  trySwing(): boolean {
    if (this.swordCooldown > 0) return false;
    this.swordCooldown = PLAYER.SWORD_COOLDOWN;
    this.swing = {
      timer: PLAYER.SWORD_ACTIVE,
      dirX: this.faceX,
      dirY: this.faceY,
      hitIds: new Set(),
    };
    this.swingAnim = 0.22;
    return true;
  }

  /** Attempt a dagger throw. Returns the direction if thrown, else null. */
  tryThrowDagger(): { dirX: number; dirY: number } | null {
    if (this.daggerCooldown > 0 || this.daggers <= 0) return null;
    this.daggerCooldown = PLAYER.DAGGER_COOLDOWN;
    this.daggers--;
    return { dirX: this.faceX, dirY: this.faceY };
  }

  /** Whether a world point is inside the live sword arc. */
  swingHits(targetX: number, targetY: number, targetRadius: number): boolean {
    if (!this.swing) return false;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.SWORD_RANGE + targetRadius) return false;
    if (dist < 0.001) return true;
    const dot = (dx / dist) * this.swing.dirX + (dy / dist) * this.swing.dirY;
    const halfArcCos = Math.cos(((PLAYER.SWORD_ARC_DEG / 2) * Math.PI) / 180);
    return dot >= halfArcCos;
  }
}
