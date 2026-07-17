// ===== src/games/dungeon-crawl/rendering/lights.ts =====
// Wave K — view assembly for the darkness pass: gathers every LightSource the
// frame offers (player torch, wall torches, glowing monsters, the unlocked
// stairs, merchants, Lastlight's fixtures, the boss). Pure: reads the view
// snapshot it is handed and returns a fresh array. Extracted from the
// orchestrator's onRender — the Wave C "view assembly lives with the views"
// precedent.

import { Boss } from '../entities/Boss';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Lighting, LightSource } from '../systems/Lighting';

export interface LightGatherView {
  player: Player;
  torches: ReadonlyArray<{ tx: number; ty: number }>;
  enemies: ReadonlyArray<Enemy>;
  stairsLocked: boolean;
  stairsCenter: { x: number; y: number };
  merchant: { x: number; y: number } | null;
  /** Lastlight's lit fixtures — null outside the town world. */
  townSpots: Record<'smith' | 'alchemist' | 'inn' | 'quests', { x: number; y: number }> | null;
  boss: Boss | null;
}

export function gatherLights(view: LightGatherView): LightSource[] {
  const lights: LightSource[] = [
    {
      x: view.player.x,
      y: view.player.y,
      radius: Lighting.playerTorchRadius(view.player.torchBonus()),
      flicker: 0.6,
    },
  ];
  for (const torch of view.torches) lights.push(Lighting.wallTorchLight(torch.tx, torch.ty));
  // v3 — fire beetles carry their own glow: glands bright enough to read by.
  for (const enemy of view.enemies) {
    if (enemy.alive && enemy.config.id === 'fire-beetle') {
      lights.push({ x: enemy.x, y: enemy.y, radius: 70, flicker: 0.6 });
    }
  }
  if (!view.stairsLocked) {
    lights.push({ x: view.stairsCenter.x, y: view.stairsCenter.y, radius: 80, flicker: 0.4 });
  }
  if (view.merchant) {
    lights.push({ x: view.merchant.x, y: view.merchant.y, radius: 110, flicker: 0.5 });
  }
  if (view.townSpots) {
    lights.push({ x: view.townSpots.smith.x, y: view.townSpots.smith.y, radius: 110, flicker: 0.5 });
    lights.push({ x: view.townSpots.alchemist.x, y: view.townSpots.alchemist.y, radius: 110, flicker: 0.5 });
    lights.push({ x: view.townSpots.inn.x, y: view.townSpots.inn.y, radius: 110, flicker: 0.5 });
    lights.push({ x: view.townSpots.quests.x, y: view.townSpots.quests.y, radius: 95, flicker: 0.4 });
  }
  if (view.boss?.alive) {
    lights.push({ x: view.boss.x, y: view.boss.y, radius: 130, flicker: 1 });
  }
  return lights;
}
