// ===== src/games/dungeon-crawl/systems/ThiefSkills.ts =====
// Wave M — THE ROGUE'S TRADE: locked chests and trap disarming behind a
// narrow host (PickupResolver conventions: mechanics live here, the run's
// counters/metrics stay in the game's callbacks). Every roll lands on the
// LIVE run rng; both skills derive fresh from hero level + DEX delta, so
// nothing is saved and milestones/trinkets fold in for free. The HUD may
// show the skill PERCENT — a readied chance, never dice notation.

import { SoundName } from '@/services/AudioManager';
import { openLocksChance, removeTrapsChance, THIEF_SKILLS } from '../data/classes';
import { CHESTS, HAZARDS, PALETTE } from '../data/constants';
import { Rng } from '../dungeon/rng';
import { Chest } from '../entities/Chest';
import { Hazard } from '../entities/Hazard';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { ParticleSystem } from './ParticleSystem';

type ActiveWork = { kind: 'chest'; chest: Chest } | { kind: 'trap'; hazard: Hazard };

export interface ThiefSkillsHost {
  player(): Player;
  rng(): Rng;
  chests(): Chest[];
  hazards(): Hazard[];
  isThief(): boolean;
  heroLevel(): number;
  /** The LIVE DEX delta (milestone bumps + trinkets included). */
  dexDelta(): number;
  particles: ParticleSystem;
  playSound(name: SoundName, volume: number): void;
  floatText(x: number, y: number, text: string, color: string): void;
  addPickup(pickup: Pickup): void;
  findOpenSpotNear(x: number, y: number): { x: number; y: number };
  /** An equipment find rolled + dropped by the game (live rng, Wave F path). */
  dropItemAt(x: number, y: number): void;
  // Counter/metric bookkeeping stays in the game:
  onChestOpened(viaKey: boolean): void;
  onTrapDisarmed(): void;
}

export class ThiefSkills {
  private active: ActiveWork | null = null;
  private retryTimer = 0; // the pick steadies between attempts
  private deniedFlash = 0; // keyless-lock feedback tint

  constructor(private host: ThiefSkillsHost) {}

  reset(): void {
    this.active = null;
    this.retryTimer = 0;
    this.deniedFlash = 0;
  }

  update(dt: number, interactDown: boolean, interactWas: boolean): void {
    this.retryTimer = Math.max(0, this.retryTimer - dt);
    this.deniedFlash = Math.max(0, this.deniedFlash - dt);
    for (const chest of this.host.chests()) chest.jiggle = Math.max(0, chest.jiggle - dt);

    this.active = this.findActive();
    if (!this.active || !interactDown || interactWas) return;
    if (this.active.kind === 'chest') this.tryChest(this.active.chest);
    else this.tryDisarm(this.active.hazard);
  }

  /** The HUD prompt for whatever the hero stands before (null = nothing). */
  prompt(): { text: string; ok: boolean } | null {
    if (!this.active) return null;
    if (this.active.kind === 'chest') {
      if (this.host.isThief()) {
        if (this.retryTimer > 0) return { text: 'THE PICK NEEDS A BREATH…', ok: false };
        const chance = openLocksChance(this.host.heroLevel(), this.host.dexDelta());
        return { text: `PICK THE LOCK · ${chance}% — press E`, ok: true };
      }
      return this.host.player().keys > 0
        ? { text: 'TURN THE KEY — press E', ok: true }
        : { text: 'LOCKED FAST — A KEY WOULD TURN IT', ok: false };
    }
    const chance = removeTrapsChance(this.host.heroLevel(), this.host.dexDelta());
    return { text: `DISARM THE TRAP · ${chance}% — press E`, ok: true };
  }

  denied(): number {
    return this.deniedFlash;
  }

  /**
   * Nearest closed chest in reach wins the E; otherwise (thief only) the
   * nearest live trap that is not mid-bite. Shop pedestals outrank both —
   * the game suppresses interactDown while one is active.
   */
  private findActive(): ActiveWork | null {
    const player = this.host.player();
    let best: ActiveWork | null = null;
    let bestDist = CHESTS.INTERACT_RADIUS + player.size / 2;
    for (const chest of this.host.chests()) {
      if (chest.opened) continue;
      const dist = Math.hypot(chest.x - player.x, chest.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { kind: 'chest', chest };
      }
    }
    if (best) return best;
    if (!this.host.isThief()) return null;
    bestDist = HAZARDS.DISARM_RADIUS + player.size / 2;
    for (const hazard of this.host.hazards()) {
      if (hazard.disarmed || hazard.phase === 'up') continue;
      const dist = Math.hypot(hazard.x - player.x, hazard.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { kind: 'trap', hazard };
      }
    }
    return best;
  }

  private tryChest(chest: Chest): void {
    if (this.host.isThief()) {
      if (this.retryTimer > 0) return;
      const chance = openLocksChance(this.host.heroLevel(), this.host.dexDelta());
      if (this.host.rng().next() * 100 < chance) {
        this.openChest(chest, false);
      } else {
        this.retryTimer = THIEF_SKILLS.PICK_RETRY;
        chest.jiggle = 0.4;
        this.host.floatText(chest.x, chest.y - 18, 'THE LOCK HOLDS', '#c9cfd8');
        this.host.playSound('click', 0.3);
      }
      return;
    }
    const player = this.host.player();
    if (player.keys > 0) {
      player.keys--;
      this.openChest(chest, true);
      return;
    }
    this.deniedFlash = 0.8;
    this.host.playSound('error', 0.3);
  }

  /** Contents roll HERE, on the live rng, the moment the lid lifts. */
  private openChest(chest: Chest, viaKey: boolean): void {
    const rng = this.host.rng();
    chest.opened = true;
    chest.jiggle = 0;
    this.host.playSound('unlock', 0.6);
    this.host.particles.burst(chest.x, chest.y, PALETTE.gold, 14, 110, 0.6);
    this.host.particles.ring(chest.x, chest.y, PALETTE.gold, 30, 0.35);

    const scatter = (kind: 'gold' | 'potion' | 'scroll') => {
      const spot = this.host.findOpenSpotNear(
        chest.x + rng.range(-14, 14),
        chest.y + rng.range(-14, 14),
      );
      this.host.addPickup(new Pickup(kind, spot.x, spot.y));
    };
    for (let i = 0, n = rng.int(CHESTS.GOLD_MIN, CHESTS.GOLD_MAX); i < n; i++) scatter('gold');
    // One bonus roll — a strongbox always keeps something beyond coin.
    const roll = rng.next();
    if (roll < CHESTS.BONUS_SCROLL) {
      scatter('scroll');
    } else if (roll < CHESTS.BONUS_SCROLL + CHESTS.BONUS_POTION) {
      scatter('potion');
    } else if (roll < CHESTS.BONUS_SCROLL + CHESTS.BONUS_POTION + CHESTS.BONUS_ITEM) {
      this.host.dropItemAt(chest.x, chest.y);
    } else {
      for (let i = 0, n = rng.int(CHESTS.GOLD_EXTRA_MIN, CHESTS.GOLD_EXTRA_MAX); i < n; i++) {
        scatter('gold');
      }
    }
    this.host.onChestOpened(viaKey);
  }

  private tryDisarm(hazard: Hazard): void {
    const chance = removeTrapsChance(this.host.heroLevel(), this.host.dexDelta());
    if (this.host.rng().next() * 100 < chance) {
      hazard.disarmed = true;
      this.host.playSound('unlock', 0.5);
      this.host.particles.burst(hazard.x, hazard.y, '#c9cfd8', 8, 80, 0.4);
      this.host.floatText(hazard.x, hazard.y - 14, 'DISARMED', '#7fd764');
      this.host.onTrapDisarmed();
    } else {
      // The 2e failure: the trap springs under the thief's hands. The bite
      // itself lands through the existing updateHazards path (cause 'hazard').
      hazard.spring();
      this.host.floatText(hazard.x, hazard.y - 14, 'SPRUNG!', PALETTE.blood);
      this.host.playSound('collision', 0.35);
    }
  }
}
