// ===== src/games/dungeon-crawl/dungeon/TileMap.ts =====
// Dense tile grid + the collision queries every entity shares. World space is
// pixels; tile space is grid indices (TILE px per tile).

import { TILE } from '../data/constants';

export enum Tile {
  Void = 0, // outside the dungeon — solid and never rendered
  Floor = 1,
  Wall = 2,
  Door = 3, // open doorway (walkable, framed)
  LockedDoor = 4, // needs a key; solid until opened
  Stairs = 5, // descend when stepped on (if unlocked)
  TorchWall = 6, // wall carrying a lit torch (solid, light source)
}

export interface TileRect {
  x: number; // world px, top-left
  y: number;
  w: number;
  h: number;
}

export class TileMap {
  readonly cols: number;
  readonly rows: number;
  private tiles: Uint8Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows); // all Void
  }

  get(tx: number, ty: number): Tile {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return Tile.Void;
    return this.tiles[ty * this.cols + tx] as Tile;
  }

  set(tx: number, ty: number, tile: Tile): void {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    this.tiles[ty * this.cols + tx] = tile;
  }

  static isSolidTile(tile: Tile): boolean {
    return (
      tile === Tile.Void ||
      tile === Tile.Wall ||
      tile === Tile.TorchWall ||
      tile === Tile.LockedDoor
    );
  }

  isSolidAt(tx: number, ty: number): boolean {
    return TileMap.isSolidTile(this.get(tx, ty));
  }

  /** True when the AABB (world px, centered coords NOT assumed) overlaps any solid tile. */
  rectCollides(rect: TileRect): boolean {
    const x0 = Math.floor(rect.x / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const x1 = Math.floor((rect.x + rect.w - 0.001) / TILE);
    const y1 = Math.floor((rect.y + rect.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolidAt(tx, ty)) return true;
      }
    }
    return false;
  }

  /**
   * Move a centered AABB by (dx, dy) with axis-separated collision so entities
   * slide along walls instead of sticking. Returns the new center.
   */
  moveWithCollision(
    cx: number,
    cy: number,
    size: number,
    dx: number,
    dy: number,
  ): { x: number; y: number; hitX: boolean; hitY: boolean } {
    const half = size / 2;
    let x = cx;
    let y = cy;
    let hitX = false;
    let hitY = false;

    if (dx !== 0) {
      const nx = x + dx;
      if (this.rectCollides({ x: nx - half, y: y - half, w: size, h: size })) {
        // Snap flush against the blocking tile column.
        const edge = dx > 0 ? Math.floor((nx + half) / TILE) * TILE - half - 0.01
                            : (Math.floor((nx - half) / TILE) + 1) * TILE + half + 0.01;
        if (!this.rectCollides({ x: edge - half, y: y - half, w: size, h: size })) x = edge;
        hitX = true;
      } else {
        x = nx;
      }
    }

    if (dy !== 0) {
      const ny = y + dy;
      if (this.rectCollides({ x: x - half, y: ny - half, w: size, h: size })) {
        const edge = dy > 0 ? Math.floor((ny + half) / TILE) * TILE - half - 0.01
                            : (Math.floor((ny - half) / TILE) + 1) * TILE + half + 0.01;
        if (!this.rectCollides({ x: x - half, y: edge - half, w: size, h: size })) y = edge;
        hitY = true;
      } else {
        y = ny;
      }
    }

    return { x, y, hitX, hitY };
  }

  /** Tile coordinates under a world-space point. */
  tileAtWorld(wx: number, wy: number): { tx: number; ty: number } {
    return { tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE) };
  }

  /** World-space center of a tile. */
  tileCenter(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  /**
   * Line-of-sight between two world points, sampled every half tile. Used by
   * ranged enemies so bolts aren't fired through walls.
   */
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / (TILE / 2)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const { tx, ty } = this.tileAtWorld(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (this.isSolidAt(tx, ty)) return false;
    }
    return true;
  }
}
