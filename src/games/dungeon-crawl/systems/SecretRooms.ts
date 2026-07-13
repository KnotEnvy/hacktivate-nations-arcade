// ===== src/games/dungeon-crawl/systems/SecretRooms.ts =====
// v4 Wave C — runtime state for the floor's secret rooms: a room is REVEALED
// when a player blast breaks its cracked-wall seal (secrets_found), and a
// revealed nest STIRS when the hero steps inside — the game spawns the pack
// (level pressure applies at construction there) and the hoard pays out into
// the run wallet when the last of it falls. Reaches the run only through the
// narrow SecretRoomsHost.

import { SoundName } from '@/services/AudioManager';
import { TILE } from '../data/constants';
import { EnemySpawnPlan, SecretRoomPlan } from '../dungeon/DungeonGenerator';
import { Enemy } from '../entities/Enemy';

export interface SecretRoomsHost {
  /** Construct + register the pack; returns the live enemies for kill tracking. */
  spawnNest(spawns: readonly EnemySpawnPlan[]): Enemy[];
  showBanner(text: string, sub: string): void;
  playSound(name: SoundName, volume: number): void;
  grantNestReward(gold: number): void;
  /** v5 Wave F — the revealed room's rect rides along for loot placement. */
  onSecretFound(room: SecretRoomPlan['room']): void;
  onNestCleared(): void;
}

interface SecretState {
  plan: SecretRoomPlan;
  revealed: boolean;
  nestTriggered: boolean;
  nestCleared: boolean;
  nestEnemies: Enemy[];
}

export class SecretRooms {
  private states: SecretState[] = [];

  constructor(private host: SecretRoomsHost) {}

  /** New floor (or the town, with no secrets): forget the old rooms. */
  resetFor(secrets: readonly SecretRoomPlan[]): void {
    this.states = secrets.map(plan => ({
      plan,
      revealed: false,
      nestTriggered: false,
      nestCleared: false,
      nestEnemies: [],
    }));
  }

  /** The game broke a CrackedWall at (tx, ty) — was it a secret room's seal? */
  onWallCracked(tx: number, ty: number): void {
    for (const s of this.states) {
      if (s.revealed || s.plan.seal.tx !== tx || s.plan.seal.ty !== ty) continue;
      s.revealed = true;
      this.host.onSecretFound(s.plan.room);
      this.host.showBanner(
        'A SECRET ROOM',
        s.plan.nest ? 'SOMETHING STIRS IN THE DARK' : 'ITS HOARD LIES UNGUARDED',
      );
      this.host.playSound('unlock', 0.5);
    }
  }

  /** Per-frame while playing: nest triggers on entry, clears on last kill. */
  update(playerX: number, playerY: number): void {
    const ptx = Math.floor(playerX / TILE);
    const pty = Math.floor(playerY / TILE);
    for (const s of this.states) {
      if (!s.revealed || !s.plan.nest || s.nestCleared) continue;
      if (!s.nestTriggered) {
        const r = s.plan.room;
        const inside = ptx >= r.tx && ptx < r.tx + r.w && pty >= r.ty && pty < r.ty + r.h;
        if (inside) {
          s.nestTriggered = true;
          s.nestEnemies = this.host.spawnNest(s.plan.nest.spawns);
          this.host.showBanner('A NEST STIRS', 'CLEAR IT AND CLAIM THE HOARD');
          this.host.playSound('whoosh', 0.5);
        }
      } else if (s.nestEnemies.every(e => !e.alive)) {
        s.nestCleared = true;
        this.host.grantNestReward(s.plan.nest.rewardGold);
        this.host.onNestCleared();
        this.host.showBanner('THE NEST IS CLEARED', `THE HOARD IS YOURS — +${s.plan.nest.rewardGold} GOLD`);
        this.host.playSound('success', 0.55);
      }
    }
  }
}
