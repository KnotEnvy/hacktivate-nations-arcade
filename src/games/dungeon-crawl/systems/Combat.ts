// ===== src/games/dungeon-crawl/systems/Combat.ts =====
// v3 — combat resolution extracted from DungeonCrawlGame: enemy/boss damage,
// deaths and drops, urn loot, bombs in flight, staged explosions and shockwave
// rings. Stateful system that reaches the run only through the narrow
// CombatHost the game builds once; score/stat/state bookkeeping stays in the
// orchestrator behind the host callbacks.

import { SoundName } from '@/services/AudioManager';
import { CLASS_TUNING } from '../data/classes';
import { EXPLOSIONS, PALETTE, SHOCKWAVE, TILE } from '../data/constants';
import { SCROLL_TUNING, ScrollId } from '../data/scrolls';
import { BOSS } from '../data/enemies';
import { RELIC_TUNING } from '../data/relics';
import { Rng } from '../dungeon/rng';
import { TileMap } from '../dungeon/TileMap';
import { Boss } from '../entities/Boss';
import { Enemy, EnemyUpdateContext } from '../entities/Enemy';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Urn } from '../entities/Urn';
import { ParticleSystem } from './ParticleSystem';
import { ScreenShake } from './ScreenShake';

export type DeathCause =
  | 'slime'
  | 'skeleton'
  | 'bat'
  | 'sorcerer_bolt'
  | 'knight'
  | 'mimic'
  | 'bomber'
  | 'wraith'
  | 'beetle'
  | 'zombie'
  | 'ghoul'
  | 'ooze'
  | 'lizardman'
  | 'shade'
  | 'hound'
  | 'hazard'
  | 'explosion'
  | 'shockwave'
  | 'boss_touch'
  | 'boss_charge'
  | 'boss_bolt';

export type HitSource = 'sword' | 'dagger' | 'ability';

/** Who spawned an explosion/bomb — player-sourced booms never hurt the player. */
export type BlastSource = 'enemy' | 'player';

// v2 — staged explosion (bomber payloads + volatile elite deaths).
export interface StagedExplosion {
  x: number;
  y: number;
  fuse: number;
  radius: number;
  source: BlastSource;
  damage: number;
}

// v2 — bomb arcing toward its landing spot (pure visual until it lands).
// v3 — each bomb carries its own boom payload (bomber / fireball / scroll).
export interface BombInFlight {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number; // 0..1 flight progress
  flight: number; // seconds for the full arc
  source: BlastSource;
  boom: { fuse: number; radius: number; damage: number };
}

// v2 — Bone Colossus shockwave ring.
export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  delay: number;
  hitPlayer: boolean;
}

export function causeForEnemy(enemy: Enemy): DeathCause {
  switch (enemy.config.id) {
    case 'slime':
    case 'slime-mini':
      return 'slime';
    case 'skeleton':
      return 'skeleton';
    case 'bat':
      return 'bat';
    case 'sorcerer':
      return 'sorcerer_bolt';
    case 'knight':
      return 'knight';
    case 'mimic':
      return 'mimic';
    case 'bomber':
      return 'bomber';
    case 'wraith':
      return 'wraith';
    case 'fire-beetle':
      return 'beetle';
    case 'zombie':
      return 'zombie';
    case 'ghoul':
      return 'ghoul';
    case 'deep-ooze':
    case 'ooze-mini':
      return 'ooze';
    case 'lizardman':
      return 'lizardman';
    case 'shade':
      return 'shade';
    case 'cinder-hound':
      return 'hound';
  }
}

/** Live view of the run — accessors because the game reassigns these per floor. */
export interface CombatHost {
  player(): Player;
  rng(): Rng;
  map(): TileMap;
  enemies(): Enemy[];
  urns(): Urn[];
  boss(): Boss | null;
  particles: ParticleSystem;
  shake: ScreenShake;
  addEnemy(enemy: Enemy): void;
  addPickup(pickup: Pickup): void;
  addProjectile(projectile: Projectile): void;
  findOpenSpotNear(x: number, y: number): { x: number; y: number };
  levelPressure(): number; // v4 — hero-level hp multiplier for spawned monsters
  revealMap(): void; // Scroll of Revelation — fog-of-war lifts
  playSound(name: SoundName, volume: number): void;
  damagePlayer(amount: number, cause: DeathCause): void;
  registerKill(baseScore: number): void;
  onEnemySlain(enemy: Enemy): void;
  onBossSlain(boss: Boss): void;
  onMimicWake(enemy: Enemy): void;
}

export class Combat {
  explosions: StagedExplosion[] = [];
  bombs: BombInFlight[] = [];
  shockwaves: Shockwave[] = [];

  constructor(private host: CombatHost) {}

  reset(): void {
    this.explosions = [];
    this.bombs = [];
    this.shockwaves = [];
  }

  throwBomb(x: number, y: number, targetX: number, targetY: number): void {
    this.bombs.push({
      fromX: x,
      fromY: y,
      toX: targetX,
      toY: targetY,
      t: 0,
      flight: EXPLOSIONS.BOMB_FLIGHT,
      source: 'enemy',
      boom: { fuse: EXPLOSIONS.BOMB_FUSE, radius: EXPLOSIONS.BOMB_RADIUS, damage: EXPLOSIONS.DAMAGE },
    });
    this.host.playSound('whoosh', 0.25);
  }

  spawnShockwave(x: number, y: number, delay: number): void {
    this.shockwaves.push({ x, y, radius: 0, delay, hitPlayer: false });
    if (delay === 0) {
      this.host.shake.add(0.45);
      this.host.playSound('explosion', 0.45);
    }
  }

  /** Minimal context for waking a dormant mimic hit before its ambush. */
  private wakeCtx(): EnemyUpdateContext {
    const player = this.host.player();
    return {
      playerX: player.x,
      playerY: player.y,
      map: this.host.map(),
      rng: this.host.rng(),
      fireBolt: () => {},
      throwBomb: () => {},
      onMimicWake: e => this.host.onMimicWake(e),
    };
  }

  hitEnemy(enemy: Enemy, damage: number, source: HitSource): void {
    if (enemy.dormant) enemy.wake(this.wakeCtx());

    const player = this.host.player();
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Knight armor blocks frontal sword hits — daggers punch through.
    if (source === 'sword' && enemy.blocksFrontalHit(dirX, dirY)) {
      this.host.playSound('sword_clash', 0.5);
      this.host.particles.spray(
        enemy.x - dirX * enemy.radius,
        enemy.y - dirY * enemy.radius,
        -dirX,
        -dirY,
        '#cfd6e0',
        5,
      );
      enemy.applyKnockback(dirX, dirY, player.meleeKnockback() * 0.4);
      return;
    }

    // v3 — thief backstab: strikes from behind (or from the shadows) cut deep.
    let dealt = damage;
    if (source === 'sword' && player.kit.backstabMult > 1) {
      const fromBehind =
        dirX * enemy.facingX + dirY * enemy.facingY > CLASS_TUNING.BACKSTAB_DOT;
      if (fromBehind || player.hiddenTimer > 0) {
        dealt = damage * player.kit.backstabMult;
        player.hiddenTimer = 0; // the strike breaks stealth
        this.host.particles.spray(enemy.x, enemy.y, dirX, dirY, '#9a7bff', 10);
      }
    }

    // v3 — Grave Ward: consecrated blows bite deeper into the undead.
    if (enemy.config.undead) {
      dealt += player.relicCount('grave-ward') * RELIC_TUNING.GRAVE_WARD_DAMAGE;
    }

    enemy.hp -= dealt;
    enemy.flash = 0.15;
    enemy.aggro = true;
    enemy.applyKnockback(dirX, dirY, player.meleeKnockback());
    this.host.playSound('hit', 0.35);
    this.host.particles.spray(enemy.x, enemy.y, dirX, dirY, enemy.config.color, 6);

    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  /** Direct wound with no knockback/sound spam — Thorn Mail retaliation. */
  woundEnemy(enemy: Enemy, damage: number): void {
    if (!enemy.alive || enemy.dormant) return;
    enemy.hp -= damage;
    enemy.flash = 0.15;
    enemy.aggro = true;
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy: Enemy): void {
    const player = this.host.player();
    const rng = this.host.rng();
    enemy.alive = false;
    this.host.registerKill(enemy.config.score * (enemy.elite?.scoreMult ?? 1));
    this.host.particles.burst(enemy.x, enemy.y, enemy.config.color, 14, 130, 0.6);
    this.host.playSound('explosion', 0.2);

    // v2 — volatile elite death fuse (elite stat bookkeeping is host-side).
    if (enemy.elite?.trait === 'volatile') {
      this.explosions.push({
        x: enemy.x,
        y: enemy.y,
        fuse: EXPLOSIONS.VOLATILE_FUSE,
        radius: EXPLOSIONS.VOLATILE_RADIUS,
        source: 'enemy',
        damage: EXPLOSIONS.DAMAGE,
      });
    }

    // Gold drops (elite/thief multipliers + Lucky Charm bonus). Multiplies the
    // drop COUNT only — the arcade `pickups` counter is untouched here.
    const [min, max] = enemy.config.goldDrop;
    const lucky = player.relicCount('lucky-charm');
    const drops =
      Math.round(rng.int(min, max) * (enemy.elite?.goldMult ?? 1) * player.kit.goldDropMult) +
      lucky * RELIC_TUNING.LUCKY_GOLD_BONUS;
    for (let i = 0; i < drops; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const spot = this.host.findOpenSpotNear(
        enemy.x + Math.cos(angle) * 14,
        enemy.y + Math.sin(angle) * 14,
      );
      this.host.addPickup(new Pickup('gold', spot.x, spot.y));
    }
    if (lucky > 0 && rng.chance(lucky * RELIC_TUNING.LUCKY_HEART_CHANCE)) {
      const spot = this.host.findOpenSpotNear(enemy.x, enemy.y);
      this.host.addPickup(new Pickup('heart', spot.x, spot.y));
    }

    // v3 — splitters (slimes, deep oozes) divide on death.
    if (enemy.config.splitsInto) {
      for (const offset of [-10, 10]) {
        const spot = this.host.findOpenSpotNear(enemy.x + offset, enemy.y + offset / 2);
        const mini = new Enemy(
          enemy.config.splitsInto,
          spot.x,
          spot.y,
          null,
          this.host.levelPressure(),
        );
        mini.aggro = true;
        this.host.addEnemy(mini);
      }
    }

    this.host.onEnemySlain(enemy);
  }

  breakUrn(urn: Urn): void {
    if (!urn.alive) return;
    const player = this.host.player();
    const rng = this.host.rng();
    urn.alive = false;
    this.host.playSound('collision', 0.25);
    this.host.particles.burst(urn.x, urn.y, '#8a6244', 10, 110, 0.5, 220);

    // Loot roll — modest, but urns are everywhere.
    const lucky = player.relicCount('lucky-charm');
    const roll = rng.next();
    if (roll < 0.12 + lucky * RELIC_TUNING.LUCKY_HEART_CHANCE) {
      this.host.addPickup(new Pickup('heart', urn.x, urn.y));
    } else if (roll < 0.24) {
      this.host.addPickup(new Pickup('dagger', urn.x, urn.y));
    } else if (roll < 0.8) {
      const count = rng.int(1, 2 + lucky);
      for (let i = 0; i < count; i++) {
        const spot = this.host.findOpenSpotNear(
          urn.x + rng.range(-10, 10),
          urn.y + rng.range(-10, 10),
        );
        this.host.addPickup(new Pickup('gold', spot.x, spot.y));
      }
    }
  }

  hitBoss(damage: number): void {
    const boss = this.host.boss();
    if (!boss?.alive) return;
    boss.hp -= damage;
    boss.flash = 0.15;
    this.host.playSound('hit', 0.4);
    this.host.particles.burst(boss.x, boss.y, boss.kit.crackColor, 8, 120, 0.4);
    if (boss.hp <= 0) this.killBoss(boss);
  }

  private killBoss(boss: Boss): void {
    const rng = this.host.rng();
    boss.alive = false;
    this.host.shake.add(0.8);
    this.host.particles.burst(boss.x, boss.y, PALETTE.emberBright, 40, 220, 1.0, 120);
    this.host.particles.burst(boss.x, boss.y, boss.kit.crackColor, 24, 160, 0.8);
    this.host.playSound('death_cry', 0.7);

    // Gold shower + a heart for the road.
    for (let i = 0; i < BOSS.GOLD_SHOWER; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(20, 70);
      const spot = this.host.findOpenSpotNear(
        boss.x + Math.cos(angle) * radius,
        boss.y + Math.sin(angle) * radius,
      );
      this.host.addPickup(new Pickup('gold', spot.x, spot.y));
    }
    const heartSpot = this.host.findOpenSpotNear(boss.x, boss.y + 40);
    this.host.addPickup(new Pickup('heart', heartSpot.x, heartSpot.y));

    this.host.onBossSlain(boss);
  }

  // ---------------------------------------------------------------- v3 abilities

  /** Fighter CLEAVE: unblockable full-circle strike around the player. */
  cleave(): void {
    const player = this.host.player();
    const reach = player.meleeRange() + CLASS_TUNING.CLEAVE_RANGE_PAD;
    this.host.playSound('sword_swing', 0.5);
    this.host.playSound('collision', 0.3);
    this.host.shake.add(0.25);
    this.host.particles.burst(player.x, player.y, '#ffe8c8', 18, 170, 0.45);
    for (const enemy of this.host.enemies()) {
      if (!enemy.alive) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > reach + enemy.radius) continue;
      if (enemy.dormant) enemy.wake(this.wakeCtx());
      enemy.applyKnockback(dx / dist, dy / dist, CLASS_TUNING.CLEAVE_KNOCKBACK);
      this.host.particles.spray(enemy.x, enemy.y, dx / dist, dy / dist, enemy.config.color, 5);
      this.woundEnemy(enemy, player.swordDamage());
    }
    const boss = this.host.boss();
    if (boss?.alive && Math.hypot(boss.x - player.x, boss.y - player.y) < reach + boss.radius) {
      this.hitBoss(player.swordDamage());
    }
    for (const urn of this.host.urns()) {
      if (urn.alive && Math.hypot(urn.x - player.x, urn.y - player.y) < reach + urn.radius) {
        this.breakUrn(urn);
      }
    }
  }

  /** Cleric TURN UNDEAD: sears + stuns the undead, shoves everything else. */
  turnUndead(): void {
    const player = this.host.player();
    this.host.playSound('unlock', 0.6);
    this.host.shake.add(0.2);
    this.host.particles.burst(player.x, player.y, '#ffe08a', 26, 200, 0.6);
    for (const enemy of this.host.enemies()) {
      if (!enemy.alive || enemy.dormant) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > CLASS_TUNING.TURN_UNDEAD_RADIUS + enemy.radius) continue;
      if (enemy.config.undead) {
        enemy.stunned = CLASS_TUNING.TURN_UNDEAD_STUN;
        this.host.particles.burst(enemy.x, enemy.y, '#ffe08a', 8, 90, 0.4);
        this.woundEnemy(enemy, CLASS_TUNING.TURN_UNDEAD_DAMAGE);
      } else {
        enemy.applyKnockback(dx / dist, dy / dist, CLASS_TUNING.TURN_UNDEAD_PUSH);
      }
    }
  }

  /** v3/v4 — one-shot scroll effects (the game banners; effects land here). */
  castScroll(id: ScrollId, scholarMult: number): void {
    const player = this.host.player();
    switch (id) {
      case 'flame':
        this.castFlameBurst();
        break;
      case 'frost':
        this.frostNova();
        break;
      case 'healing':
        player.heal(Math.ceil(SCROLL_TUNING.HEAL_HP * scholarMult));
        this.host.playSound('extraLife', 0.5);
        this.host.particles.burst(player.x, player.y, PALETTE.heart, 14, 110, 0.6);
        break;
      case 'shielding':
        player.addBuff('stoneskin');
        player.invuln = Math.max(player.invuln, SCROLL_TUNING.SHIELD_INVULN * scholarMult);
        this.host.playSound('powerup', 0.5);
        this.host.particles.burst(player.x, player.y, '#9aa5b5', 14, 110, 0.6);
        break;
      case 'revelation':
        this.host.revealMap();
        this.host.playSound('unlock', 0.55);
        this.host.particles.burst(player.x, player.y, PALETTE.keyGold, 18, 140, 0.7);
        break;
    }
  }

  /** Mage FIREBALL: lob a player-sourced bomb toward the facing direction. */
  spawnFireball(): void {
    const player = this.host.player();
    this.bombs.push({
      fromX: player.x,
      fromY: player.y,
      toX: player.x + player.faceX * CLASS_TUNING.FIREBALL_LOB_DIST,
      toY: player.y + player.faceY * CLASS_TUNING.FIREBALL_LOB_DIST,
      t: 0,
      flight: CLASS_TUNING.FIREBALL_FLIGHT,
      source: 'player',
      boom: {
        fuse: CLASS_TUNING.FIREBALL_FUSE,
        radius: CLASS_TUNING.FIREBALL_RADIUS,
        damage: CLASS_TUNING.FIREBALL_DAMAGE,
      },
    });
    this.host.playSound('whoosh', 0.5);
  }

  /** v3 — Scroll of Flame: a heavier, shorter-thrown player blast. */
  castFlameBurst(): void {
    const player = this.host.player();
    this.bombs.push({
      fromX: player.x,
      fromY: player.y,
      toX: player.x + player.faceX * SCROLL_TUNING.FLAME_LOB_DIST,
      toY: player.y + player.faceY * SCROLL_TUNING.FLAME_LOB_DIST,
      t: 0,
      flight: SCROLL_TUNING.FLAME_FLIGHT,
      source: 'player',
      boom: {
        fuse: SCROLL_TUNING.FLAME_FUSE,
        radius: SCROLL_TUNING.FLAME_RADIUS,
        damage: SCROLL_TUNING.FLAME_DAMAGE,
      },
    });
    this.host.playSound('whoosh', 0.5);
  }

  /** v3 — Scroll of Frost: every living monster in sight freezes mid-step. */
  frostNova(): void {
    const player = this.host.player();
    this.host.playSound('whoosh', 0.55);
    this.host.shake.add(0.2);
    this.host.particles.burst(player.x, player.y, '#9ad8ff', 30, 220, 0.7);
    for (const enemy of this.host.enemies()) {
      if (!enemy.alive || enemy.dormant) continue;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > SCROLL_TUNING.FROST_RADIUS) continue;
      enemy.stunned = Math.max(enemy.stunned, SCROLL_TUNING.FROST_STUN);
      this.host.particles.burst(enemy.x, enemy.y, '#d8ecff', 6, 70, 0.4);
    }
  }

  update(dt: number): void {
    this.updateBombsAndExplosions(dt);
    this.updateShockwaves(dt);
  }

  // ---------------------------------------------------------------- boss

  /** v4 — the Guardian's whole turn: kit AI, summons, touch damage. */
  updateBoss(dt: number): void {
    const boss = this.host.boss();
    if (!boss?.alive) return;
    const player = this.host.player();
    boss.update(dt, {
      playerX: player.x,
      playerY: player.y,
      map: this.host.map(),
      rng: this.host.rng(),
      fireBolt: (x, y, dirX, dirY, speed) => {
        this.host.addProjectile(new Projectile('bolt', x, y, dirX * speed, dirY * speed, 1));
      },
      fireHomingBolt: (x, y, dirX, dirY, speed) => {
        this.host.addProjectile(
          new Projectile('bolt', x, y, dirX * speed, dirY * speed, 1, false, 2.2),
        );
      },
      spawnShockwave: (x, y, delay) => this.spawnShockwave(x, y, delay),
      requestTeleportSpot: () => this.pickTeleportSpot(),
      summonMinion: (x, y, type) => {
        const spawn = this.host.findOpenSpotNear(x, y);
        const minion = new Enemy(type, spawn.x, spawn.y, null, this.host.levelPressure());
        minion.aggro = true;
        this.host.addEnemy(minion);
        this.host.particles.burst(spawn.x, spawn.y, PALETTE.ember, 8, 90, 0.4);
      },
      minionCount: () => this.host.enemies().filter(e => e.alive).length,
      onChargeSlam: (x, y) => {
        this.host.shake.add(0.5);
        this.host.particles.burst(x, y, PALETTE.emberBright, 16, 180, 0.6, 200);
        this.host.playSound('explosion', 0.4);
      },
      onTeleport: (fromX, fromY, toX, toY) => {
        this.host.particles.burst(fromX, fromY, boss.kit.crackColor, 14, 120, 0.5);
        this.host.particles.burst(toX, toY, boss.kit.crackColor, 14, 120, 0.5);
        this.host.playSound('whoosh', 0.5);
      },
    });
    const touchReach = boss.radius + player.size / 2;
    if (Math.hypot(boss.x - player.x, boss.y - player.y) < touchReach) {
      this.host.damagePlayer(
        boss.isCharging ? BOSS.CHARGE_DAMAGE : BOSS.TOUCH_DAMAGE,
        boss.isCharging ? 'boss_charge' : 'boss_touch',
      );
    }
  }

  /** Random open tile 3-6 tiles away from the player (Hollow King teleport). */
  private pickTeleportSpot(): { x: number; y: number } {
    const player = this.host.player();
    const map = this.host.map();
    const rng = this.host.rng();
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(TILE * 3, TILE * 6);
      const x = player.x + Math.cos(angle) * dist;
      const y = player.y + Math.sin(angle) * dist;
      const { tx, ty } = map.tileAtWorld(x, y);
      if (!map.isSolidAt(tx, ty)) return map.tileCenter(tx, ty);
    }
    const boss = this.host.boss();
    return { x: boss?.x ?? player.x, y: boss?.y ?? player.y };
  }

  private updateBombsAndExplosions(dt: number): void {
    // Bombs arc toward their landing spot, then become a fused explosion.
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.t += dt / bomb.flight;
      if (bomb.t >= 1) {
        this.bombs.splice(i, 1);
        this.explosions.push({
          x: bomb.toX,
          y: bomb.toY,
          fuse: bomb.boom.fuse,
          radius: bomb.boom.radius,
          source: bomb.source,
          damage: bomb.boom.damage,
        });
      }
    }

    const player = this.host.player();
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.fuse -= dt;
      if (explosion.fuse > 0) continue;
      this.explosions.splice(i, 1);
      if (explosion.source === 'enemy') {
        // Boom: player inside the radius.
        const reach = explosion.radius + player.size / 2;
        if (Math.hypot(explosion.x - player.x, explosion.y - player.y) < reach) {
          this.host.damagePlayer(explosion.damage, 'explosion');
        }
      } else {
        // Player-sourced boom: monsters and the boss, never the player.
        for (const enemy of this.host.enemies()) {
          if (!enemy.alive) continue;
          if (
            Math.hypot(explosion.x - enemy.x, explosion.y - enemy.y) <
            explosion.radius + enemy.radius
          ) {
            this.hitEnemy(enemy, explosion.damage, 'ability');
          }
        }
        const boss = this.host.boss();
        if (
          boss?.alive &&
          Math.hypot(explosion.x - boss.x, explosion.y - boss.y) < explosion.radius + boss.radius
        ) {
          this.hitBoss(explosion.damage);
        }
      }
      for (const urn of this.host.urns()) {
        if (
          urn.alive &&
          Math.hypot(explosion.x - urn.x, explosion.y - urn.y) < explosion.radius + urn.radius
        ) {
          this.breakUrn(urn);
        }
      }
      this.host.shake.add(0.35);
      this.host.particles.burst(explosion.x, explosion.y, PALETTE.ember, 22, 190, 0.6, 140);
      this.host.particles.burst(explosion.x, explosion.y, PALETTE.emberBright, 10, 120, 0.4);
      this.host.playSound('explosion', 0.4);
    }
  }

  private updateShockwaves(dt: number): void {
    const player = this.host.player();
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      if (wave.delay > 0) {
        wave.delay -= dt;
        if (wave.delay <= 0) {
          this.host.shake.add(0.3);
          this.host.playSound('explosion', 0.3);
        }
        continue;
      }
      wave.radius += SHOCKWAVE.SPEED * dt;
      if (!wave.hitPlayer) {
        const dist = Math.hypot(wave.x - player.x, wave.y - player.y);
        if (Math.abs(dist - wave.radius) < SHOCKWAVE.THICKNESS + player.size / 2) {
          wave.hitPlayer = true;
          this.host.damagePlayer(SHOCKWAVE.DAMAGE, 'shockwave');
        }
      }
      if (wave.radius > SHOCKWAVE.MAX_RADIUS) this.shockwaves.splice(i, 1);
    }
  }

  /** World-space FX for combat state this system owns (not projectiles). */
  renderEffects(ctx: CanvasRenderingContext2D, gameTime: number): void {
    // Bombs arc with a fake-height hop; landing spot marked from launch.
    for (const bomb of this.bombs) {
      const t = Math.min(1, bomb.t);
      const x = bomb.fromX + (bomb.toX - bomb.fromX) * t;
      const y = bomb.fromY + (bomb.toY - bomb.fromY) * t - Math.sin(t * Math.PI) * 46;
      ctx.strokeStyle =
        bomb.source === 'player' ? 'rgba(122, 224, 255, 0.5)' : 'rgba(255, 122, 26, 0.5)';
      ctx.beginPath();
      ctx.arc(bomb.toX, bomb.toY, bomb.boom.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = bomb.source === 'player' ? '#7a4a1a' : '#22242b';
      ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
      const spark = Math.floor(gameTime * 18) % 2 === 0;
      ctx.fillStyle = spark ? '#ffd24a' : '#ff7a1a';
      ctx.fillRect(Math.round(x) + 2, Math.round(y) - 7, 3, 3);
    }

    // Fused explosions: blinking danger circle that tightens as the fuse burns.
    for (const explosion of this.explosions) {
      const urgency = Math.max(
        0,
        Math.min(1, 1 - explosion.fuse / Math.max(EXPLOSIONS.BOMB_FUSE, EXPLOSIONS.VOLATILE_FUSE)),
      );
      const blink = Math.floor(gameTime * (8 + urgency * 16)) % 2 === 0;
      ctx.strokeStyle = blink ? 'rgba(255, 80, 40, 0.9)' : 'rgba(255, 160, 60, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Shockwave rings.
    for (const wave of this.shockwaves) {
      if (wave.delay > 0 || wave.radius <= 0) continue;
      const fade = 1 - wave.radius / SHOCKWAVE.MAX_RADIUS;
      ctx.strokeStyle = `rgba(232, 220, 188, ${0.35 + 0.55 * fade})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}
