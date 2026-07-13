// ===== src/games/dungeon-crawl/systems/PickupResolver.ts =====
// v5 Wave F — floor-loot resolution, extracted from the orchestrator for
// guardrail headroom: the collect-pickup switch, relic granting, and the
// keyed treasure-room doors. Mechanics live here; the run's counters and
// metric bookkeeping stay in the game behind the narrow host callbacks.

import { SoundName } from '@/services/AudioManager';
import { PALETTE, PICKUPS, PotionBuff, TILE } from '../data/constants';
import { ALL_RELIC_IDS, RELICS, RelicId } from '../data/relics';
import { Rng } from '../dungeon/rng';
import { Tile, TileMap } from '../dungeon/TileMap';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { ParticleSystem } from './ParticleSystem';

export interface PickupResolverHost {
  player(): Player;
  rng(): Rng;
  map(): TileMap;
  particles: ParticleSystem;
  playSound(name: SoundName, volume: number): void;
  showBanner(text: string, sub: string): void;
  shake(amount: number): void;
  /** Scroll intake lives with Combat (satchel + identify). */
  collectScroll(pickup: Pickup): void;
  /** v5 Wave F — equipment intake lives with Inventory (may leave it lying). */
  collectItem(pickup: Pickup): void;
  // Counter/metric bookkeeping stays in the game:
  onGold(): void;
  onPotionUsed(): void;
  onKeyUsed(): void;
  onRelicCollected(): void;
}

export class PickupResolver {
  constructor(private host: PickupResolverHost) {}

  collectPickup(pickup: Pickup): void {
    pickup.alive = false;
    switch (pickup.kind) {
      case 'gold': {
        this.host.onGold();
        this.host.playSound('coin', 0.25);
        this.host.particles.burst(pickup.x, pickup.y, PALETTE.gold, 5, 70, 0.35);
        break;
      }
      case 'heart': {
        const player = this.host.player();
        player.heal(PICKUPS.HEART_HEAL + player.heartHealBonus());
        this.host.playSound('extraLife', 0.4);
        this.host.particles.burst(pickup.x, pickup.y, PALETTE.heart, 8, 80, 0.5);
        break;
      }
      case 'dagger': {
        const player = this.host.player();
        player.daggers = Math.min(player.daggerCap(), player.daggers + PICKUPS.DAGGER_BUNDLE);
        this.host.playSound('click', 0.4);
        break;
      }
      case 'potion': {
        const buffs: PotionBuff[] = ['haste', 'strength', 'stoneskin'];
        this.host.player().addBuff(this.host.rng().pick(buffs));
        this.host.onPotionUsed();
        this.host.playSound('powerup', 0.45);
        this.host.particles.burst(pickup.x, pickup.y, PALETTE.potion, 10, 90, 0.5);
        break;
      }
      case 'key': {
        this.host.player().keys++;
        this.host.playSound('unlock', 0.5);
        this.host.particles.burst(pickup.x, pickup.y, PALETTE.keyGold, 8, 80, 0.5);
        break;
      }
      case 'scroll':
        this.host.collectScroll(pickup);
        break;
      case 'item':
        this.host.collectItem(pickup);
        break;
      case 'relic-shrine': {
        this.grantRelic(this.host.rng().pick(ALL_RELIC_IDS));
        break;
      }
    }
  }

  grantRelic(id: RelicId): void {
    const player = this.host.player();
    player.addRelic(id);
    this.host.onRelicCollected();
    this.host.playSound('unlock', 0.6);
    this.host.particles.burst(player.x, player.y, RELICS[id].color, 16, 120, 0.8);
    this.host.showBanner(RELICS[id].name, RELICS[id].blurb);
  }

  /** Locked doors open on contact when the player holds a key. */
  tryOpenDoors(): void {
    const player = this.host.player();
    const map = this.host.map();
    if (player.keys <= 0) return;
    const { tx, ty } = map.tileAtWorld(player.x, player.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (map.get(tx + dx, ty + dy) !== Tile.LockedDoor) continue;
        const center = map.tileCenter(tx + dx, ty + dy);
        if (Math.hypot(center.x - player.x, center.y - player.y) > TILE * 1.2) continue;
        // One key opens every door of the treasure room ring (they're one lock).
        this.openConnectedLockedDoors(tx + dx, ty + dy);
        player.keys--;
        this.host.onKeyUsed();
        this.host.playSound('gate_open', 0.6);
        this.host.shake(0.15);
        return;
      }
    }
  }

  private openConnectedLockedDoors(tx: number, ty: number): void {
    const map = this.host.map();
    // Flood over the contiguous locked-door ring so one key = one room.
    const queue = [{ tx, ty }];
    while (queue.length > 0) {
      const pos = queue.pop()!;
      if (map.get(pos.tx, pos.ty) !== Tile.LockedDoor) continue;
      map.set(pos.tx, pos.ty, Tile.Door);
      const center = map.tileCenter(pos.tx, pos.ty);
      this.host.particles.burst(center.x, center.y, PALETTE.keyGold, 6, 60, 0.4);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        queue.push({ tx: pos.tx + dx, ty: pos.ty + dy });
      }
    }
  }
}
