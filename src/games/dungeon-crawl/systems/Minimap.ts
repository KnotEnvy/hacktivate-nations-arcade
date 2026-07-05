// ===== src/games/dungeon-crawl/systems/Minimap.ts =====
// Fog-of-war minimap: tiles the player's torch has revealed, plus the player
// dot, discovered stairs, and (if seen) the boss. Drawn in screen space.

import { PALETTE, TILE } from '../data/constants';
import { Tile, TileMap } from '../dungeon/TileMap';

export class Minimap {
  private explored: Uint8Array = new Uint8Array(0);
  private cols = 0;
  private rows = 0;

  resetFor(map: TileMap): void {
    this.cols = map.cols;
    this.rows = map.rows;
    this.explored = new Uint8Array(map.cols * map.rows);
  }

  /** Reveal tiles within the torch radius around a world point. */
  reveal(map: TileMap, wx: number, wy: number, radiusPx: number): void {
    const radiusTiles = Math.ceil(radiusPx / TILE);
    const { tx: ctx0, ty: cty0 } = map.tileAtWorld(wx, wy);
    for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
      for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
        if (dx * dx + dy * dy > radiusTiles * radiusTiles) continue;
        const tx = ctx0 + dx;
        const ty = cty0 + dy;
        if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) continue;
        this.explored[ty * this.cols + tx] = 1;
      }
    }
  }

  isExplored(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.explored[ty * this.cols + tx] === 1;
  }

  /** Fraction of walkable tiles revealed (used for rooms_explored credit). */
  render(
    ctx: CanvasRenderingContext2D,
    map: TileMap,
    canvasWidth: number,
    playerX: number,
    playerY: number,
    bossPos: { x: number; y: number } | null,
  ): void {
    if (this.cols === 0) return;
    const scale = Math.max(2, Math.min(3, Math.floor(150 / this.cols)));
    const w = this.cols * scale;
    const h = this.rows * scale;
    const ox = canvasWidth - w - 14;
    const oy = 14;

    ctx.fillStyle = 'rgba(5, 3, 8, 0.72)';
    ctx.fillRect(ox - 4, oy - 4, w + 8, h + 8);
    ctx.strokeStyle = PALETTE.hudBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 4.5, oy - 4.5, w + 9, h + 9);

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (!this.explored[ty * this.cols + tx]) continue;
        const tile = map.get(tx, ty);
        if (tile === Tile.Void) continue;
        if (TileMap.isSolidTile(tile)) {
          ctx.fillStyle = tile === Tile.LockedDoor ? PALETTE.doorLocked : '#4d4238';
        } else if (tile === Tile.Stairs) {
          ctx.fillStyle = PALETTE.stairsGlow;
        } else {
          ctx.fillStyle = '#241d16';
        }
        ctx.fillRect(ox + tx * scale, oy + ty * scale, scale, scale);
      }
    }

    // Player blip.
    const ptx = Math.floor(playerX / TILE);
    const pty = Math.floor(playerY / TILE);
    ctx.fillStyle = PALETTE.emberBright;
    ctx.fillRect(ox + ptx * scale - 1, oy + pty * scale - 1, scale + 2, scale + 2);

    // Boss blip once its tile has been revealed.
    if (bossPos) {
      const btx = Math.floor(bossPos.x / TILE);
      const bty = Math.floor(bossPos.y / TILE);
      if (this.isExplored(btx, bty)) {
        ctx.fillStyle = PALETTE.blood;
        ctx.fillRect(ox + btx * scale - 1, oy + bty * scale - 1, scale + 2, scale + 2);
      }
    }
  }
}
