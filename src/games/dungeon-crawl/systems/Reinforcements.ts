// ===== src/games/dungeon-crawl/systems/Reinforcements.ts =====
// Wave Q2 guardrail valve — "the floor sends more monsters", in one place.
//
// Two callers wanted the same thing for different reasons and the orchestrator
// was hosting both: Wave N's stairs camp (the wander die — sit still long
// enough and the dark answers) and Wave Q2's THE PIT (the legion is relieved
// on schedule whatever you do). Same act, same construction rules, different
// clocks — so the act lives here and the clocks stay with whoever owns them.
//
// Follows the Rest/ThiefSkills conventions: a narrow host, no reach into the
// run. Packs are still built at GAME level in the sense that matters — level
// pressure is applied here, never inside dungeon/, so the generator keeps
// knowing nothing about the hero (the Wave N invariant, intact).

import { SoundName } from '@/services/AudioManager';
import { REST } from '../data/constants';
import { spawnWeightsForFloor } from '../data/enemies';
import { PLANE_TUNING } from '../data/planes';
import { pickWanderType, wanderSpawnSpot } from './Rest';
import { Room } from '../dungeon/DungeonGenerator';
import { Rng } from '../dungeon/rng';
import { TileMap } from '../dungeon/TileMap';
import { Enemy } from '../entities/Enemy';

export interface ReinforcementsHost {
  rng(): Rng;
  /** The live floor — map and rooms always belong to the same plan. */
  plan(): { map: TileMap; rooms: readonly Room[] };
  floor(): number;
  biomeId(): string;
  playerPos(): { x: number; y: number };
  levelPressure(): number;
  addEnemy(enemy: Enemy): void;
  showBanner(text: string, sub: string): void;
  playSound(name: SoundName, volume: number): void;
}

export class Reinforcements {
  /** THE PIT's clock. Zero on every floor that is not under its law. */
  private legionTimer = 0;

  constructor(private host: ReinforcementsHost) {}

  reset(): void {
    this.legionTimer = 0;
  }

  /**
   * Wave N — a single-type pack answers the dark: level-pressured, aggroed,
   * arriving clear across the floor, and flagged `wandering` so its kills
   * scatter no lair gold. Mimics are excluded (an ambusher does not patrol).
   */
  spawnPack(sub = 'THE FIRE DREW EYES'): void {
    const rng = this.host.rng();
    const rows = spawnWeightsForFloor(this.host.floor(), this.host.biomeId()).filter(
      r => r.weight > 0 && r.type !== 'mimic',
    );
    if (rows.length === 0) return;
    const type = pickWanderType(rng, rows);
    const count = rng.int(REST.PACK_MIN, REST.PACK_MAX);
    const pressure = this.host.levelPressure();
    const player = this.host.playerPos();
    const plan = this.host.plan();
    for (let i = 0; i < count; i++) {
      const spot = wanderSpawnSpot(rng, plan.rooms, plan.map, player.x, player.y);
      const foe = new Enemy(type, spot.x, spot.y, null, pressure);
      foe.aggro = true; // they smelled the fire
      foe.wandering = true; // no lair treasure
      this.host.addEnemy(foe);
    }
    this.host.showBanner(
      rng.chance(0.5) ? 'SOMETHING COMES' : 'THE DARK HAS FOOTSTEPS',
      sub,
    );
    this.host.playSound('whoosh', 0.5);
  }

  /**
   * Wave Q2 — THE PIT's law: the garrison is relieved on schedule for as long
   * as the expedition lasts. `underLaw` is false everywhere else, which parks
   * the clock at zero rather than letting it accrue against a later plane.
   */
  tickLegion(dt: number, underLaw: boolean): void {
    if (!underLaw) {
      this.legionTimer = 0;
      return;
    }
    this.legionTimer += dt;
    if (this.legionTimer < PLANE_TUNING.RANKS_INTERVAL) return;
    this.legionTimer = 0;
    if (!this.host.rng().chance(PLANE_TUNING.RANKS_CHANCE)) return;
    this.spawnPack('THE RANKS ARE RELIEVED');
  }
}
