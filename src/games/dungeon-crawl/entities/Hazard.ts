// ===== src/games/dungeon-crawl/entities/Hazard.ts =====
// v2 — cycling floor hazards: spike traps and ember vents. Same state machine,
// biome-specific visuals (drawn by TileRenderer). Damage only lands during the
// 'up' phase; the telegraph phase is the player's cue to step off.

import { HAZARDS, HazardStyle, TILE } from '../data/constants';

export type HazardPhase = 'down' | 'telegraph' | 'up';

export class Hazard {
  readonly tx: number;
  readonly ty: number;
  readonly x: number; // world px center
  readonly y: number;
  readonly style: HazardStyle;
  phase: HazardPhase = 'down';
  private timer: number;

  constructor(tx: number, ty: number, style: HazardStyle, phaseOffset = 0) {
    this.tx = tx;
    this.ty = ty;
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE / 2;
    this.style = style;
    // Desynchronize cycles so hazard fields ripple instead of pulsing as one.
    this.timer = HAZARDS.DOWN_TIME * (0.3 + phaseOffset);
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    switch (this.phase) {
      case 'down':
        this.phase = 'telegraph';
        this.timer = HAZARDS.TELEGRAPH_TIME;
        break;
      case 'telegraph':
        this.phase = 'up';
        this.timer = HAZARDS.UP_TIME;
        break;
      case 'up':
        this.phase = 'down';
        this.timer = HAZARDS.DOWN_TIME;
        break;
    }
  }

  get dangerous(): boolean {
    return this.phase === 'up';
  }

  /** 0..1 progress within the current phase (drives the sprite animation). */
  phaseProgress(): number {
    const total =
      this.phase === 'down'
        ? HAZARDS.DOWN_TIME
        : this.phase === 'telegraph'
          ? HAZARDS.TELEGRAPH_TIME
          : HAZARDS.UP_TIME;
    return Math.max(0, Math.min(1, 1 - this.timer / total));
  }
}
