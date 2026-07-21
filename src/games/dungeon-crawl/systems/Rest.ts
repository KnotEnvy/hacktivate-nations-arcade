// ===== src/games/dungeon-crawl/systems/Rest.ts =====
// Wave N — THE LIVING DEPTHS: the stairs camp (ThiefSkills/SecretRooms
// conventions — mechanics live here, the run's side-effects reach it only
// through the narrow RestHost). On a CLEARED floor, standing near the stairs
// (but NOT on the tile that descends) the hero may make camp to heal. Every
// TICK_TIME rolls the heal dice down the CANONICAL heal path (Combat.healPlayer,
// so the green number reads the true gain) AND a wandering-monster die whose
// odds CLIMB the longer the fire burns — time feeds the roll. Camp breaks on a
// step, a wound, or the dark answering; it ends itself at full HP.
//
// Lastlight can never camp for free: the game calls update() ONLY from its
// 'playing' update path (updatePlaying), never from the town loop — so the
// gate below is a courtesy, the state machine is the guarantee.

import { SoundName } from '@/services/AudioManager';
import { REST } from '../data/constants';
import { rollDice } from '../data/dice';
import type { EnemyTypeId, SpawnWeightRow } from '../data/enemies';
import type { Room } from '../dungeon/DungeonGenerator';
import { Rng } from '../dungeon/rng';
import type { TileMap } from '../dungeon/TileMap';
import { Player } from '../entities/Player';
import { ParticleSystem } from './ParticleSystem';

export interface RestHost {
  player(): Player;
  rng(): Rng;
  /** World-space center of the stairs tile (the descent point). */
  stairsCenter(): { x: number; y: number };
  /** True when the hero stands ON the stairs tile itself (that tile descends). */
  onStairsTile(): boolean;
  /** No live boss and every enemy dead-or-dormant (a dormant mimic is furniture). */
  floorCleared(): boolean;
  /** The canonical heal path — Combat.healPlayer (shows the ACTUAL hp gained). */
  heal(amount: number): void;
  /** The dark answers: the game builds + registers one wandering pack. */
  spawnWanderingPack(): void;
  particles: ParticleSystem;
  playSound(name: SoundName, volume: number): void;
  floatText(x: number, y: number, text: string, color: string): void;
}

/**
 * Odds the dark answers on a single rest tick — designed ONCE here (a pure
 * helper so the sweep and the tests read the same law). `ticks` is how many
 * ticks have already burned this camp: the first tick sits at the floor odds,
 * each later one climbs by WANDER_RAMP up to WANDER_CAP.
 */
export function wanderChance(ticks: number): number {
  return Math.min(REST.WANDER_CAP, REST.WANDER_BASE + REST.WANDER_RAMP * ticks);
}

// The wandering-pack roll + placement — pure helpers the game's
// spawnWanderingPack composes (the pack is still built at GAME level with level
// pressure; the generator is never touched).

/** Weighted pick over the (mimic-free) spawn rows on the live run rng. */
export function pickWanderType(rng: Rng, rows: readonly SpawnWeightRow[]): EnemyTypeId {
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  let roll = rng.next() * total;
  for (const r of rows) {
    roll -= r.weight;
    if (roll < 0) return r.type;
  }
  return rows[rows.length - 1].type;
}

/** An open spot around a random room center, at least SPAWN_MIN_DIST from the
 *  hero; after a handful of dry rooms, the farthest candidate found (never on
 *  top of the player). */
export function wanderSpawnSpot(
  rng: Rng,
  rooms: readonly Room[],
  map: TileMap,
  px: number,
  py: number,
): { x: number; y: number } {
  // The player anchor is only the degenerate fallback: a real floor always has
  // >= 1 room (generator invariant), so the loop below always overwrites it.
  let farthest = { x: px, y: py };
  let farDist = -1;
  for (let attempt = 0; attempt < 8 && rooms.length > 0; attempt++) {
    const room = rooms[rng.int(0, rooms.length - 1)];
    const c = map.tileCenter(room.tx + Math.floor(room.w / 2), room.ty + Math.floor(room.h / 2));
    const spot = map.findOpenSpotNear(c.x, c.y) ?? c;
    const dist = Math.hypot(spot.x - px, spot.y - py);
    if (dist >= REST.SPAWN_MIN_DIST) return spot;
    if (dist > farDist) {
      farDist = dist;
      farthest = spot;
    }
  }
  return farthest;
}

export class Rest {
  private camping = false;
  private tickTimer = 0; // seconds until the next heal + wander roll
  private ticks = 0; // ticks burned THIS camp (feeds the wander ramp)

  constructor(private host: RestHost) {}

  /** New floor or the town: forget the fire (game calls beside thiefSkills.reset). */
  reset(): void {
    this.camping = false;
    this.tickTimer = 0;
    this.ticks = 0;
  }

  /** The HUD prompt for the campfire (null = nothing to offer here). */
  prompt(): { text: string; ok: boolean } | null {
    if (this.camping) return { text: 'RESTING — THE EMBERS KEEP WATCH', ok: true };
    return this.available() ? { text: 'MAKE CAMP — press E', ok: true } : null;
  }

  /** A wound anywhere breaks the rest (the game's damagePlayer funnel calls in). */
  onPlayerDamaged(): void {
    if (this.camping) this.camping = false;
  }

  /**
   * interactDown/interactWas are the E edge (the game suppresses them while a
   * shop pedestal or a chest/trap outranks the camp); moveHeld is the live
   * movement-input read. A step, a wound or the dark ends the fire.
   */
  update(dt: number, interactDown: boolean, interactWas: boolean, moveHeld: boolean): void {
    if (this.camping) {
      if (moveHeld) {
        this.camping = false; // a step abandons the fire (no fanfare)
        return;
      }
      this.emberDrift();
      this.tickTimer -= dt;
      if (this.tickTimer <= 0) {
        this.tickTimer += REST.TICK_TIME;
        this.tick();
      }
      return;
    }
    if (this.available() && interactDown && !interactWas) this.startCamp();
  }

  /** Camp may be pitched: cleared floor, near the stairs but off the descent
   *  tile, below full HP, not already camping. */
  private available(): boolean {
    if (this.camping) return false;
    const player = this.host.player();
    if (player.hp >= player.maxHp) return false; // nothing to rest off
    if (!this.host.floorCleared()) return false; // a live foe (or arrival) blocks it
    if (this.host.onStairsTile()) return false; // that tile descends via checkStairs
    const c = this.host.stairsCenter();
    return Math.hypot(player.x - c.x, player.y - c.y) <= REST.STAIRS_RADIUS;
  }

  private startCamp(): void {
    this.camping = true;
    this.tickTimer = REST.TICK_TIME;
    this.ticks = 0;
    const player = this.host.player();
    this.host.floatText(player.x, player.y - 20, 'MAKING CAMP', '#ffd9a0');
    this.host.playSound('click', 0.3);
  }

  /** One heal + wander beat. Heal first; a completing tick ends the rest before
   *  the dark gets its roll (you're leaving anyway) — otherwise the die falls. */
  private tick(): void {
    const player = this.host.player();
    const rng = this.host.rng();
    this.host.heal(rollDice(rng, REST.HEAL_DICE));
    if (player.hp >= player.maxHp) {
      this.host.floatText(player.x, player.y - 22, 'RESTED', '#7fd764');
      this.host.playSound('success', 0.35);
      this.camping = false;
      return;
    }
    const chance = wanderChance(this.ticks);
    this.ticks++;
    if (rng.next() < chance) {
      this.host.spawnWanderingPack(); // the game banners + re-blocks the floor
      this.camping = false;
    }
  }

  /** Motes rising off the campfire — view-only ambience at the hero's feet. */
  private emberDrift(): void {
    if (Math.random() < 0.3) {
      const player = this.host.player();
      this.host.particles.ember(player.x, player.y + 4, '#ff9a3d');
    }
  }
}
