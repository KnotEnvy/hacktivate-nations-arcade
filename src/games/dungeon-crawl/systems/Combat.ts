// ===== src/games/dungeon-crawl/systems/Combat.ts =====
// v3 — combat resolution extracted from DungeonCrawlGame: enemy/boss damage,
// deaths and drops, urn loot, bombs in flight, staged explosions and shockwave
// rings. Stateful system that reaches the run only through the narrow
// CombatHost the game builds once; score/stat/state bookkeeping stays in the
// orchestrator behind the host callbacks.

import { SoundName } from '@/services/AudioManager';
import { AbilityId, CLASS_TUNING } from '../data/classes';
import { rollDice } from '../data/dice';
import { EXPLOSIONS, HAZARDS, JUICE, PALETTE, PICKUPS, PLAYER, PotionBuff, SHOCKWAVE, TILE } from '../data/constants';
import { ALL_SCROLL_IDS, SCROLL_TUNING, ScrollId, SCROLLS } from '../data/scrolls';
import { SPELL_TUNING, SpellId } from '../data/spells';
import { STAT_TUNING } from '../data/stats';
import { BOSS, MORALE, moraleBreakChance } from '../data/enemies';
import { ALL_RELIC_IDS, RELIC_TUNING, RelicId } from '../data/relics';
import type { ShopProduct } from '../dungeon/DungeonGenerator';
import { Rng } from '../dungeon/rng';
import { Tile, TileMap } from '../dungeon/TileMap';
import { Boss } from '../entities/Boss';
import { Enemy, EnemyUpdateContext } from '../entities/Enemy';
import { Hazard } from '../entities/Hazard';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Urn } from '../entities/Urn';
import { FloatingTextSystem } from './FloatingText';
import { Juice } from './Juice';
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
  // v4 Wave D — Monstrous Manual additions
  | 'salamander'
  | 'bone_arrow'
  | 'drowned'
  | 'wight'
  | 'gargoyle'
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
    case 'salamander':
      return 'salamander';
    case 'bone-archer':
      return 'bone_arrow';
    case 'drowned-one':
      return 'drowned';
    case 'ember-wight':
      return 'wight';
    case 'gargoyle':
      return 'gargoyle';
  }
}

/** Live view of the run — accessors because the game reassigns these per floor. */
export interface CombatHost {
  player(): Player;
  rng(): Rng;
  map(): TileMap;
  enemies(): Enemy[];
  urns(): Urn[];
  projectiles(): Projectile[]; // Wave M valve — flight resolution lives here
  boss(): Boss | null;
  particles: ParticleSystem;
  shake: ScreenShake;
  juice: Juice; // Wave K — hit-stop + flash-lights
  floatingText: FloatingTextSystem; // Wave L — combat numbers
  addEnemy(enemy: Enemy): void;
  addPickup(pickup: Pickup): void;
  addProjectile(projectile: Projectile): void;
  findOpenSpotNear(x: number, y: number): { x: number; y: number };
  hazards(): Hazard[]; // v4 Wave D — trap damage resolves here too
  showBanner(text: string, sub: string): void; // v4 Wave D — shop scroll flavor
  grantRelic(id: RelicId): void; // v4 Wave D — shop relic purchases
  levelPressure(): number; // v4 — hero-level hp multiplier for spawned monsters
  floor(): number; // Wave N — morale weighs the hero's level against the floor
  heroLevel(): number; // Wave N — the living hero's level (1 when none)
  floorSpawnBaseline(): number; // Wave N — the floor's seeded pack size
  onFoeRouted(): void; // Wave N — a foe broke for the first time (metric hook)
  revealMap(): void; // Scroll of Revelation — fog-of-war lifts
  crackWall(tx: number, ty: number): void; // v4 Wave C — a CrackedWall gives way
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

  /**
   * Wave L — heal + show the ACTUAL hp gained (the clamp can eat a roll). The
   * CANONICAL heal path: every heal (pickups, scrolls, spells, Wave N's stairs
   * camp) lands here so the green floating number always reads the true gain.
   */
  healPlayer(amount: number): void {
    const player = this.host.player();
    const before = player.hp;
    player.heal(amount);
    const gained = player.hp - before;
    if (gained > 0) {
      this.host.floatingText.push(player.x, player.y - 16, `+${gained}`, '#7fd764');
    }
  }

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
      this.host.shake.kick(0, 1, JUICE.KICK_BOSS); // Wave K — the slam lands
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
    // Wave L — the number lands with the blow (pale, small).
    this.host.floatingText.push(enemy.x, enemy.y - enemy.radius - 6, `${dealt}`, '#fff2e4', 0.85);
    this.host.playSound('hit', 0.35);
    this.host.particles.spray(enemy.x, enemy.y, dirX, dirY, enemy.config.color, 6);
    this.host.particles.sparks(enemy.x, enemy.y, dirX, dirY, '#ffd9a0', 4); // Wave K
    this.host.shake.kick(dirX, dirY, JUICE.KICK_MELEE); // Wave K — follow-through

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
    this.host.juice.hitStop(JUICE.HITSTOP_KILL); // Wave K — the blow bites
    this.host.particles.burst(enemy.x, enemy.y, enemy.config.color, 14, 130, 0.6);
    this.host.particles.ring(enemy.x, enemy.y, enemy.config.color, 26, 0.28); // Wave K
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
    // Wave N — a WANDERING pack left its lair (and its coin) behind: no gold
    // scatters, so the campfire never becomes a mint (XP/score still count).
    const lucky = player.relicCount('lucky-charm');
    if (!enemy.wandering) {
      const [min, max] = enemy.config.goldDrop;
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
        mini.wandering = enemy.wandering; // Wave N — a wanderer's minis stay goldless
        this.host.addEnemy(mini);
      }
    }

    // Wave N — THE LIVING DEPTHS: the fall rattles the pack. Every OTHER
    // living, non-dormant, non-elite, morale-flagged foe within PACK_RADIUS
    // rolls ONCE on the live rng to BREAK and run. The undead/mindless/mimic
    // carry no flag, so they hold the line by construction; elites never break.
    // Chance is designed once (moraleBreakChance) against the floor's seeded
    // strength — a thinned or overmatched pack breaks more readily.
    const enemies = this.host.enemies();
    let aliveNonDormant = 0;
    for (const other of enemies) if (other.alive && !other.dormant) aliveNonDormant++;
    const chance = moraleBreakChance(
      this.host.heroLevel(),
      this.host.floor(),
      aliveNonDormant,
      this.host.floorSpawnBaseline(),
    );
    let firstBreaker = true;
    for (const other of enemies) {
      if (other === enemy || !other.alive || other.dormant) continue;
      if (!other.config.morale || other.elite !== null) continue;
      if (Math.hypot(other.x - enemy.x, other.y - enemy.y) > MORALE.PACK_RADIUS) continue;
      if (rng.next() >= chance) continue;
      if (other.breakAndFlee()) this.host.onFoeRouted();
      if (firstBreaker) {
        firstBreaker = false;
        // One pale cry per sweep, at the first foe to lose its nerve.
        this.host.floatingText.push(other.x, other.y - other.radius - 6, 'THEY BREAK!', '#c9cfd8');
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
    const wasEnraged = boss.enraged;
    boss.hp -= damage;
    boss.flash = 0.15;
    this.host.floatingText.push(boss.x, boss.y - boss.radius - 8, `${damage}`, '#fff2e4', 0.85);
    this.host.juice.hitStop(JUICE.HITSTOP_BOSS_HIT); // Wave K
    this.host.playSound('hit', 0.4);
    this.host.particles.burst(boss.x, boss.y, boss.kit.crackColor, 8, 120, 0.4);
    this.host.particles.sparks(boss.x, boss.y, 0, -1, '#ffd9a0', 5); // Wave K
    if (boss.hp <= 0) {
      this.killBoss(boss);
      return;
    }
    // Wave K — the 35% crossing gets its MOMENT: flare, roar, heave, freeze.
    if (!wasEnraged && boss.enraged) {
      boss.enrageFlash = 1.0;
      this.host.juice.hitStop(JUICE.HITSTOP_ENRAGE);
      this.host.juice.flashLight(boss.x, boss.y, JUICE.FLASH_BOSS_DEATH_RADIUS, 0.5);
      this.host.shake.add(0.5);
      this.host.shake.kick(0, -1, JUICE.KICK_BOSS);
      this.host.particles.ring(boss.x, boss.y, PALETTE.blood, 70, 0.5);
      this.host.particles.burst(boss.x, boss.y, PALETTE.blood, 18, 170, 0.6);
      this.host.playSound('death_cry', 0.35);
    }
  }

  private killBoss(boss: Boss): void {
    const rng = this.host.rng();
    boss.alive = false;
    this.host.shake.add(0.8);
    this.host.shake.kick(0, -1, JUICE.KICK_BOSS); // Wave K — the arena heaves
    // Wave K — the Guardian's fall stops the world and lights the arena.
    this.host.juice.hitStop(JUICE.HITSTOP_BOSS_KILL);
    this.host.juice.flashLight(boss.x, boss.y, JUICE.FLASH_BOSS_DEATH_RADIUS, JUICE.FLASH_BOSS_DEATH_LIFE);
    this.host.particles.burst(boss.x, boss.y, PALETTE.emberBright, 40, 220, 1.0, 120);
    this.host.particles.burst(boss.x, boss.y, boss.kit.crackColor, 24, 160, 0.8);
    this.host.particles.ring(boss.x, boss.y, PALETTE.emberBright, 90, 0.55); // Wave K
    this.host.particles.ring(boss.x, boss.y, boss.kit.crackColor, 55, 0.4);
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
        this.healPlayer(Math.ceil(rollDice(this.host.rng(), SCROLL_TUNING.HEAL_HP) * scholarMult));
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
        damage: CLASS_TUNING.FIREBALL_DAMAGE + player.statMods.int * STAT_TUNING.INT_SPELL_DAMAGE,
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

  /**
   * v3 — Scroll of Frost (and v4 Frost Ray): monsters in range freeze
   * mid-step. v6 Wave J generalizes the center + color so WEB roots the pack
   * AHEAD of the player and other root effects can ride the same verb.
   */
  frostNova(
    radius: number = SCROLL_TUNING.FROST_RADIUS,
    stun: number = SCROLL_TUNING.FROST_STUN,
    centerX?: number,
    centerY?: number,
    color = '#9ad8ff',
    sparkColor = '#d8ecff',
  ): void {
    const player = this.host.player();
    const cx = centerX ?? player.x;
    const cy = centerY ?? player.y;
    this.host.playSound('whoosh', 0.55);
    this.host.shake.add(0.2);
    this.host.particles.burst(cx, cy, color, 30, 220, 0.7);
    for (const enemy of this.host.enemies()) {
      if (!enemy.alive || enemy.dormant) continue;
      if (Math.hypot(enemy.x - cx, enemy.y - cy) > radius) continue;
      enemy.stunned = Math.max(enemy.stunned, stun);
      this.host.particles.burst(enemy.x, enemy.y, sparkColor, 6, 70, 0.4);
    }
  }

  /** v3 — signature class ability effects (the game gates cooldown + stats). */
  castAbility(id: AbilityId): void {
    const player = this.host.player();
    switch (id) {
      case 'cleave':
        player.swingAnim = 0.22; // visual swing tail for the spin
        this.cleave();
        break;
      case 'shadow-hide':
        player.startHide();
        this.host.playSound('whoosh', 0.5);
        this.host.particles.burst(player.x, player.y, '#9a7bff', 16, 120, 0.5);
        break;
      case 'turn-undead':
        this.turnUndead();
        break;
      case 'fireball':
        this.spawnFireball();
        break;
    }
  }

  /** v2 — cycling trap damage (the game already gates state to 'playing'). */
  updateHazards(dt: number): void {
    const player = this.host.player();
    for (const hazard of this.host.hazards()) {
      hazard.update(dt);
      if (!hazard.dangerous) continue;
      const reach = HAZARDS.RADIUS + player.size / 2;
      if (Math.hypot(hazard.x - player.x, hazard.y - player.y) < reach) {
        this.host.damagePlayer(rollDice(this.host.rng(), HAZARDS.DAMAGE), 'hazard');
      }
    }
  }

  /** Closest living, non-dormant monster (boss as fallback) — mana bolt target. */
  nearestEnemyTo(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const enemy of this.host.enemies()) {
      if (!enemy.alive || enemy.dormant) continue;
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: enemy.x, y: enemy.y };
      }
    }
    const boss = this.host.boss();
    if (!best && boss?.alive) best = { x: boss.x, y: boss.y };
    return best;
  }

  /** v2/v3 — dungeon-merchant product effects (the game owns the gold ledger). */
  applyShopPurchase(product: ShopProduct): void {
    const player = this.host.player();
    switch (product) {
      case 'heart':
        this.healPlayer(rollDice(this.host.rng(), PICKUPS.HEART_HEAL) + player.heartHealBonus());
        break;
      case 'daggers':
        player.daggers = Math.min(player.daggerCap(), player.daggers + PICKUPS.DAGGER_BUNDLE + 2);
        break;
      case 'potion': {
        const buffs: PotionBuff[] = ['haste', 'strength', 'stoneskin'];
        player.addBuff(this.host.rng().pick(buffs));
        break;
      }
      case 'relic':
        this.host.grantRelic(this.host.rng().pick(ALL_RELIC_IDS));
        break;
      case 'scroll': {
        // v3 — you paid for it: a bought scroll replaces whatever was held.
        const id = this.host.rng().pick(ALL_SCROLL_IDS);
        player.scroll = id;
        this.host.showBanner(SCROLLS[id].name, `${SCROLLS[id].blurb} — press F`);
        break;
      }
    }
  }

  /** v3 — scroll pickup: identity rolls at collection; a full satchel passes. */
  collectScroll(pickup: Pickup): void {
    const player = this.host.player();
    if (player.scroll) {
      pickup.alive = true; // the satchel holds one; leave the find in place
      return;
    }
    const id = this.host.rng().pick(ALL_SCROLL_IDS);
    player.scroll = id;
    this.host.playSound('unlock', 0.5);
    this.host.particles.burst(pickup.x, pickup.y, SCROLLS[id].color, 10, 90, 0.5);
    this.host.showBanner(SCROLLS[id].name, `${SCROLLS[id].blurb} — press F`);
  }

  /** v4 Wave D — grimoire effects: the scroll library, parameterized by spell. */
  castSpell(id: SpellId, scholarMult: number): void {
    const player = this.host.player();
    switch (id) {
      case 'burning-hands':
        this.bombs.push({
          fromX: player.x,
          fromY: player.y,
          toX: player.x + player.faceX * SPELL_TUNING.BURNING_HANDS_LOB_DIST,
          toY: player.y + player.faceY * SPELL_TUNING.BURNING_HANDS_LOB_DIST,
          t: 0,
          flight: SPELL_TUNING.BURNING_HANDS_FLIGHT,
          source: 'player',
          boom: {
            fuse: SPELL_TUNING.BURNING_HANDS_FUSE,
            radius: SPELL_TUNING.BURNING_HANDS_RADIUS,
            damage:
              SPELL_TUNING.BURNING_HANDS_DAMAGE +
              player.statMods.int * STAT_TUNING.INT_SPELL_DAMAGE,
          },
        });
        this.host.playSound('whoosh', 0.5);
        break;
      case 'frost-ray':
        this.frostNova(SPELL_TUNING.FROST_RAY_RADIUS, SPELL_TUNING.FROST_RAY_STUN);
        break;
      case 'blink': {
        // A short step between heartbeats — lands on the nearest open tile.
        this.host.particles.burst(player.x, player.y, '#c99aff', 12, 100, 0.5);
        const spot = this.host.findOpenSpotNear(
          player.x + player.faceX * SPELL_TUNING.BLINK_DIST,
          player.y + player.faceY * SPELL_TUNING.BLINK_DIST,
        );
        player.placeAt(spot.x, spot.y);
        player.invuln = Math.max(player.invuln, SPELL_TUNING.BLINK_INVULN);
        this.host.particles.burst(spot.x, spot.y, '#c99aff', 12, 100, 0.5);
        this.host.playSound('whoosh', 0.55);
        break;
      }
      case 'cure-wounds':
        this.healPlayer(
          Math.ceil(
            (rollDice(this.host.rng(), SPELL_TUNING.CURE_HP) +
              player.statMods.wis * STAT_TUNING.WIS_HEAL) *
              scholarMult,
          ),
        );
        this.host.playSound('extraLife', 0.5);
        this.host.particles.burst(player.x, player.y, PALETTE.heart, 14, 110, 0.6);
        break;
      case 'bless':
        player.addBuff('haste');
        this.healPlayer(SPELL_TUNING.BLESS_HP + player.statMods.wis * STAT_TUNING.WIS_HEAL);
        this.host.playSound('powerup', 0.5);
        this.host.particles.burst(player.x, player.y, '#ffe08a', 14, 110, 0.6);
        break;
      case 'sanctuary':
        player.addBuff('stoneskin');
        player.invuln = Math.max(player.invuln, SPELL_TUNING.SANCTUARY_INVULN * scholarMult);
        this.host.playSound('powerup', 0.5);
        this.host.particles.burst(player.x, player.y, '#9aa5b5', 14, 110, 0.6);
        break;

      // ---- v6 Wave J: the deeper grimoire (mage) ----
      case 'magic-missile': {
        // Three unerring darts — homing player daggers fanned about facing.
        const base = Math.atan2(player.faceY, player.faceX);
        const dmg =
          SPELL_TUNING.MAGIC_MISSILE_DAMAGE + player.statMods.int * STAT_TUNING.INT_SPELL_DAMAGE;
        for (let i = 0; i < SPELL_TUNING.MAGIC_MISSILE_COUNT; i++) {
          const a =
            base + (i - (SPELL_TUNING.MAGIC_MISSILE_COUNT - 1) / 2) * SPELL_TUNING.MAGIC_MISSILE_SPREAD;
          this.host.addProjectile(
            new Projectile(
              'dagger',
              player.x,
              player.y,
              Math.cos(a) * SPELL_TUNING.MAGIC_MISSILE_SPEED,
              Math.sin(a) * SPELL_TUNING.MAGIC_MISSILE_SPEED,
              dmg,
              false,
              SPELL_TUNING.MAGIC_MISSILE_HOMING,
            ),
          );
        }
        this.host.playSound('whoosh', 0.5);
        this.host.particles.burst(player.x, player.y, '#d29aff', 10, 90, 0.4);
        break;
      }
      case 'web':
        // Sticky strands root the pack AHEAD — the nova verb, re-centered.
        this.frostNova(
          SPELL_TUNING.WEB_RADIUS,
          SPELL_TUNING.WEB_STUN,
          player.x + player.faceX * SPELL_TUNING.WEB_DIST,
          player.y + player.faceY * SPELL_TUNING.WEB_DIST,
          '#e8e3d0',
          '#f5f2e4',
        );
        break;
      case 'lightning': {
        // A crooked bolt lashes the nearest foe in range (boss as fallback).
        const dmg =
          SPELL_TUNING.LIGHTNING_DAMAGE + player.statMods.int * STAT_TUNING.INT_SPELL_DAMAGE;
        let target: Enemy | null = null;
        let bestDist: number = SPELL_TUNING.LIGHTNING_RANGE;
        for (const enemy of this.host.enemies()) {
          if (!enemy.alive || enemy.dormant) continue;
          const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (dist < bestDist) {
            bestDist = dist;
            target = enemy;
          }
        }
        const boss = this.host.boss();
        if (target) {
          this.host.particles.burst(target.x, target.y, '#ffe95e', 18, 160, 0.5);
          this.woundEnemy(target, dmg);
        } else if (
          boss?.alive &&
          Math.hypot(boss.x - player.x, boss.y - player.y) < SPELL_TUNING.LIGHTNING_RANGE
        ) {
          this.host.particles.burst(boss.x, boss.y, '#ffe95e', 18, 160, 0.5);
          this.hitBoss(dmg);
        }
        this.host.shake.add(0.25);
        this.host.juice.hitStop(JUICE.HITSTOP_SPELL_IMPACT); // Wave K
        if (target) {
          this.host.juice.flashLight(target.x, target.y, JUICE.FLASH_SPELL_RADIUS, JUICE.FLASH_SPELL_LIFE);
        }
        this.host.playSound('explosion', 0.35);
        this.host.particles.burst(player.x, player.y, '#ffe95e', 10, 120, 0.4);
        break;
      }

      // ---- v6 Wave J: the deeper prayer book (cleric) ----
      case 'spirit-hammer': {
        // A hammer of faith — one strong homing player projectile.
        this.host.addProjectile(
          new Projectile(
            'dagger',
            player.x,
            player.y,
            player.faceX * SPELL_TUNING.SPIRIT_HAMMER_SPEED,
            player.faceY * SPELL_TUNING.SPIRIT_HAMMER_SPEED,
            SPELL_TUNING.SPIRIT_HAMMER_DAMAGE,
            false,
            SPELL_TUNING.SPIRIT_HAMMER_HOMING,
          ),
        );
        this.host.playSound('whoosh', 0.5);
        this.host.particles.burst(player.x, player.y, '#ffd27a', 10, 90, 0.4);
        break;
      }
      case 'prayer':
        // The war-litany: hard skin, heavy hands.
        player.addBuff('strength');
        player.addBuff('stoneskin');
        this.host.playSound('powerup', 0.5);
        this.host.particles.burst(player.x, player.y, '#f5efdc', 16, 120, 0.6);
        break;
      case 'flame-strike': {
        // A column of holy fire falls on the nearest foe (short fall ahead
        // when none is near) — the player-sourced boom verb.
        const target = this.nearestEnemyTo(player.x, player.y) ?? {
          x: player.x + player.faceX * SPELL_TUNING.FLAME_STRIKE_FALLBACK_DIST,
          y: player.y + player.faceY * SPELL_TUNING.FLAME_STRIKE_FALLBACK_DIST,
        };
        this.bombs.push({
          fromX: target.x,
          fromY: target.y,
          toX: target.x,
          toY: target.y,
          t: 0,
          flight: 0.1, // falls where it lands — no lob arc
          source: 'player',
          boom: {
            fuse: SPELL_TUNING.FLAME_STRIKE_FUSE,
            radius: SPELL_TUNING.FLAME_STRIKE_RADIUS,
            damage:
              SPELL_TUNING.FLAME_STRIKE_DAMAGE +
              player.statMods.int * STAT_TUNING.INT_SPELL_DAMAGE,
          },
        });
        this.host.playSound('whoosh', 0.55);
        break;
      }

      // ---- v6 Wave J: fighter techniques ----
      case 'war-cry':
        // A roar staggers the room: brief stun + shove all around.
        this.host.playSound('powerup', 0.5);
        this.host.shake.add(0.35);
        this.host.juice.hitStop(JUICE.HITSTOP_SPELL_IMPACT); // Wave K
        this.host.particles.burst(player.x, player.y, '#ff6a4d', 22, 190, 0.55);
        for (const enemy of this.host.enemies()) {
          if (!enemy.alive || enemy.dormant) continue;
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist > SPELL_TUNING.WAR_CRY_RADIUS + enemy.radius) continue;
          enemy.stunned = Math.max(enemy.stunned, SPELL_TUNING.WAR_CRY_STUN);
          enemy.applyKnockback(dx / dist, dy / dist, SPELL_TUNING.WAR_CRY_PUSH);
        }
        break;
      case 'second-wind':
        // Martial grit — a flat heal, no WIS fold.
        this.healPlayer(rollDice(this.host.rng(), SPELL_TUNING.SECOND_WIND_HP));
        this.host.playSound('extraLife', 0.5);
        this.host.particles.burst(player.x, player.y, '#8fe08a', 14, 110, 0.6);
        break;
      case 'sunder':
        // The blade flies through everything in its path (STR rides
        // swordDamage for free).
        this.host.addProjectile(
          new Projectile(
            'dagger',
            player.x,
            player.y,
            player.faceX * SPELL_TUNING.SUNDER_SPEED,
            player.faceY * SPELL_TUNING.SUNDER_SPEED,
            player.swordDamage() + SPELL_TUNING.SUNDER_BONUS_DAMAGE,
            true,
          ),
        );
        this.host.playSound('sword_swing', 0.55);
        this.host.particles.burst(player.x, player.y, '#d8dee8', 10, 100, 0.4);
        break;

      // ---- v6 Wave J: thief techniques ----
      case 'smoke-bomb':
        // Vanish in a grey bloom — the hide verb plus a beat of confusion.
        player.startHide();
        this.frostNova(
          SPELL_TUNING.SMOKE_RADIUS,
          SPELL_TUNING.SMOKE_STUN,
          player.x,
          player.y,
          '#8d97a8',
          '#b8c0cc',
        );
        break;
      case 'fan-of-knives': {
        // Eight blades leave your hands at once (no ammo cost).
        for (let i = 0; i < SPELL_TUNING.FAN_KNIVES_COUNT; i++) {
          const a = (i / SPELL_TUNING.FAN_KNIVES_COUNT) * Math.PI * 2;
          this.host.addProjectile(
            new Projectile(
              'dagger',
              player.x,
              player.y,
              Math.cos(a) * PLAYER.DAGGER_SPEED,
              Math.sin(a) * PLAYER.DAGGER_SPEED,
              player.daggerDamage(),
              player.daggersPierce(),
            ),
          );
        }
        this.host.playSound('whoosh', 0.5);
        this.host.particles.burst(player.x, player.y, '#c9d2e0', 12, 110, 0.4);
        break;
      }
      case 'venom-edge':
        // Black oil on the blade — your cuts bite deep for a while.
        player.addBuff('strength');
        this.host.playSound('powerup', 0.5);
        this.host.particles.burst(player.x, player.y, '#7ddb6a', 14, 110, 0.6);
        break;
    }
  }

  update(dt: number): void {
    this.updateBombsAndExplosions(dt);
    this.updateShockwaves(dt);
  }

  // ------------------------------------------- Wave M valve: entity resolution
  // The sword-swing / enemy / projectile turns, extracted verbatim from the
  // orchestrator for guardrail headroom (the updateBoss precedent). Arrays are
  // compacted IN PLACE so the game's per-floor references stay live.

  /** Sword swing resolution (enemies, boss, urns). */
  updateSwing(): void {
    const player = this.host.player();
    if (!player.swing) return;
    for (const enemy of this.host.enemies()) {
      if (!enemy.alive || player.swing.hitIds.has(enemy.id)) continue;
      if (!player.swingHits(enemy.x, enemy.y, enemy.radius)) continue;
      player.swing.hitIds.add(enemy.id);
      this.hitEnemy(enemy, player.swordDamage(), 'sword');
    }
    const boss = this.host.boss();
    if (boss?.alive && !player.swing.hitIds.has(-1)) {
      if (player.swingHits(boss.x, boss.y, boss.radius)) {
        player.swing.hitIds.add(-1);
        this.hitBoss(player.swordDamage());
      }
    }
    for (const urn of this.host.urns()) {
      if (urn.alive && player.swingHits(urn.x, urn.y, urn.radius)) this.breakUrn(urn);
    }
  }

  /** Enemy AI turns + touch damage; the dead are compacted away. */
  updateEnemies(dt: number): void {
    const player = this.host.player();
    const enemies = this.host.enemies();
    const enemyCtx: EnemyUpdateContext = {
      playerX: player.x,
      playerY: player.y,
      map: this.host.map(),
      rng: this.host.rng(),
      fireBolt: (x, y, dirX, dirY, speed, cause, damage) => {
        // Wave L — the shooter rolled its dice; 1 only if none were passed.
        const bolt = new Projectile('bolt', x, y, dirX * speed, dirY * speed, damage ?? 1);
        bolt.cause = cause;
        this.host.addProjectile(bolt);
      },
      throwBomb: (x, y, targetX, targetY) => this.throwBomb(x, y, targetX, targetY),
      onMimicWake: enemy => this.host.onMimicWake(enemy),
      playerHidden: player.hiddenTimer > 0,
    };
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, enemyCtx);
      // Touch damage (stunned monsters are safe to brush past).
      const reach = enemy.radius + player.size / 2;
      if (
        !enemy.dormant &&
        enemy.stunned <= 0 &&
        Math.hypot(enemy.x - player.x, enemy.y - player.y) < reach
      ) {
        // Wave L — the blow lands as dice, rolled on the live run rng.
        this.host.damagePlayer(rollDice(this.host.rng(), enemy.config.touchDamage), causeForEnemy(enemy));
      }
    }
    let write = 0;
    for (const enemy of enemies) if (enemy.alive) enemies[write++] = enemy;
    enemies.length = write;
  }

  /** Projectile flight + hits. Hostile bolts home on the player; mage mana
   *  bolts home on the nearest living monster instead. */
  updateProjectiles(dt: number): void {
    const player = this.host.player();
    const projectiles = this.host.projectiles();
    for (const proj of projectiles) {
      if (proj.kind === 'dagger' && proj.homing > 0) {
        const target = this.nearestEnemyTo(proj.x, proj.y);
        proj.update(dt, this.host.map(), target?.x, target?.y);
      } else {
        proj.update(dt, this.host.map(), player.x, player.y);
      }
      if (!proj.alive) continue;
      if (proj.kind === 'bolt') {
        const reach = proj.radius + player.size / 2;
        if (Math.hypot(proj.x - player.x, proj.y - player.y) < reach) {
          proj.alive = false;
          this.host.damagePlayer(
            proj.damage,
            proj.cause ?? (this.host.boss()?.alive ? 'boss_bolt' : 'sorcerer_bolt'),
          );
        }
      } else {
        // Player dagger vs monsters, urns and boss. Daggers ignore knight armor.
        for (const enemy of this.host.enemies()) {
          if (!enemy.alive || proj.hitIds.has(enemy.id)) continue;
          if (Math.hypot(proj.x - enemy.x, proj.y - enemy.y) < proj.radius + enemy.radius) {
            proj.hitIds.add(enemy.id);
            this.hitEnemy(enemy, proj.damage, 'dagger');
            if (!proj.pierce) {
              proj.alive = false;
              break;
            }
          }
        }
        if (proj.alive) {
          for (const urn of this.host.urns()) {
            if (!urn.alive) continue;
            if (Math.hypot(proj.x - urn.x, proj.y - urn.y) < proj.radius + urn.radius) {
              this.breakUrn(urn);
              if (!proj.pierce) {
                proj.alive = false;
                break;
              }
            }
          }
        }
        const boss = this.host.boss();
        if (proj.alive && boss?.alive && !proj.hitIds.has(-1)) {
          if (Math.hypot(proj.x - boss.x, proj.y - boss.y) < proj.radius + boss.radius) {
            proj.hitIds.add(-1);
            this.hitBoss(proj.damage);
            if (!proj.pierce) proj.alive = false;
          }
        }
      }
    }
    let write = 0;
    for (const proj of projectiles) if (proj.alive) projectiles[write++] = proj;
    projectiles.length = write;
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
        // Wave L — Guardian bolts roll their dice at fire time.
        const damage = rollDice(this.host.rng(), BOSS.BOLT_DAMAGE);
        this.host.addProjectile(new Projectile('bolt', x, y, dirX * speed, dirY * speed, damage));
      },
      fireHomingBolt: (x, y, dirX, dirY, speed) => {
        const damage = rollDice(this.host.rng(), BOSS.BOLT_DAMAGE);
        this.host.addProjectile(
          new Projectile('bolt', x, y, dirX * speed, dirY * speed, damage, false, 2.2),
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
      // Wave L — the Guardian's blow lands as dice.
      this.host.damagePlayer(
        rollDice(this.host.rng(), boss.isCharging ? BOSS.CHARGE_DAMAGE : BOSS.TOUCH_DAMAGE),
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
        // Boom: player inside the radius. Wave L — the blast rolls its dice
        // against the HERO; the staged number stays the monster-side economy.
        const reach = explosion.radius + player.size / 2;
        if (Math.hypot(explosion.x - player.x, explosion.y - player.y) < reach) {
          this.host.damagePlayer(rollDice(this.host.rng(), EXPLOSIONS.PLAYER_DAMAGE), 'explosion');
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
        // v4 Wave C — only the PLAYER's blasts break open cracked walls
        // (bomber bombs stay 'enemy' and never reveal a secret).
        this.crackWallsInBlast(explosion.x, explosion.y, explosion.radius);
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
      this.host.juice.flashLight(explosion.x, explosion.y, JUICE.FLASH_EXPLOSION_RADIUS, JUICE.FLASH_EXPLOSION_LIFE);
      this.host.particles.burst(explosion.x, explosion.y, PALETTE.ember, 22, 190, 0.6, 140);
      this.host.particles.burst(explosion.x, explosion.y, PALETTE.emberBright, 10, 120, 0.4);
      this.host.particles.ring(explosion.x, explosion.y, PALETTE.emberBright, explosion.radius + 14, 0.35); // Wave K
      this.host.particles.sparks(explosion.x, explosion.y, 0, -1, PALETTE.emberBright, 8, 320);
      this.host.playSound('explosion', 0.4);
    }
  }

  /** v4 Wave C — every CrackedWall whose tile center the blast reaches gives way. */
  private crackWallsInBlast(x: number, y: number, radius: number): void {
    const map = this.host.map();
    const reach = radius + TILE / 2;
    const tx0 = Math.max(0, Math.floor((x - reach) / TILE));
    const tx1 = Math.min(map.cols - 1, Math.floor((x + reach) / TILE));
    const ty0 = Math.max(0, Math.floor((y - reach) / TILE));
    const ty1 = Math.min(map.rows - 1, Math.floor((y + reach) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (map.get(tx, ty) !== Tile.CrackedWall) continue;
        const cx = (tx + 0.5) * TILE;
        const cy = (ty + 0.5) * TILE;
        if (Math.hypot(x - cx, y - cy) < reach) this.host.crackWall(tx, ty);
      }
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
          this.host.damagePlayer(rollDice(this.host.rng(), SHOCKWAVE.DAMAGE), 'shockwave');
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
