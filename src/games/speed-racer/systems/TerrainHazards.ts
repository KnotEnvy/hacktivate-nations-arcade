// Terrain-specific road hazards that aren't secondary-weapon deployed.
//   - ice_patch: briefly zeros out steering friction when the player rolls over it
//     (frost pass). Cosmetic plus cracked-ice visual.
//   - wake: lateral foam streak on water sections. Nudges the player sideways
//     on contact — not lethal, but can shove you toward traffic.
//
// Both types scroll with world-frame like ground hazards. Spawned by the
// system based on the active terrain.

import type { RoadProfile } from './RoadProfile';
import type { Terrain } from '../data/sections';

export type TerrainHazardType = 'ice_patch' | 'wake';

export interface TerrainHazardImpact {
  slip: boolean;     // ice — zero decel while over the patch
  nudgeX: number;    // wake — add to player vx (one-shot on contact)
}

export class TerrainHazard {
  x: number;
  y: number;
  alive = true;
  type: TerrainHazardType;
  readonly width: number;
  readonly height: number;
  private direction: 1 | -1;
  // Wake only: was the player already overlapping last frame? Used to make
  // the nudge a one-shot instead of a continuous push.
  private nudgedThisPass = false;

  constructor(type: TerrainHazardType, x: number, y: number) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.direction = Math.random() < 0.5 ? 1 : -1;
    if (type === 'ice_patch') {
      this.width = 90;
      this.height = 60;
    } else {
      this.width = 140;
      this.height = 24;
    }
  }

  update(dt: number, playerSpeed: number): void {
    this.y += playerSpeed * dt;
    if (this.y > 720) this.alive = false;
  }

  // Returns the effect the player should receive while/when overlapping.
  // slip is continuous; nudgeX fires once per contact.
  contact(playerOverlaps: boolean): TerrainHazardImpact {
    if (!playerOverlaps) {
      this.nudgedThisPass = false;
      return { slip: false, nudgeX: 0 };
    }
    if (this.type === 'ice_patch') {
      return { slip: true, nudgeX: 0 };
    }
    // wake
    if (this.nudgedThisPass) return { slip: false, nudgeX: 0 };
    this.nudgedThisPass = true;
    return { slip: false, nudgeX: this.direction * 180 };
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.type === 'ice_patch') {
      // Cracked ice patch
      ctx.fillStyle = 'rgba(200,230,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(
        this.x - 12,
        this.y - 8,
        this.width / 4,
        this.height / 5,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Crack lines
      ctx.strokeStyle = 'rgba(100,140,180,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(this.x - 20, this.y - 10);
      ctx.lineTo(this.x + 10, this.y + 4);
      ctx.lineTo(this.x + 22, this.y - 6);
      ctx.stroke();
    } else {
      // Foam streak
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(this.x - this.width / 2, this.y - 2, this.width, 2);
      ctx.fillStyle = 'rgba(180,230,255,0.55)';
      for (let i = 0; i < 6; i++) {
        const fx = this.x - this.width / 2 + (i / 6) * this.width;
        ctx.fillRect(fx, this.y - 8 + (i % 2) * 4, this.width / 8, 3);
      }
      // Direction arrow hint
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      const tip = this.direction > 0 ? this.x + this.width / 2 - 6 : this.x - this.width / 2 + 6;
      ctx.beginPath();
      ctx.moveTo(tip, this.y);
      ctx.lineTo(tip - this.direction * 12, this.y - 6);
      ctx.lineTo(tip - this.direction * 12, this.y + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export class TerrainHazardSystem {
  private hazards: TerrainHazard[] = [];
  private spawnTimer = 3;
  private terrain: Terrain = 'road';
  private roadProfile: RoadProfile;

  constructor(roadProfile: RoadProfile) {
    this.roadProfile = roadProfile;
  }

  reset(): void {
    this.hazards = [];
    this.spawnTimer = 3;
    this.terrain = 'road';
  }

  setTerrain(terrain: Terrain): void {
    this.terrain = terrain;
    // Clear any lingering hazards from the previous terrain so they don't
    // visually contradict the new section.
    this.hazards = [];
    this.spawnTimer = terrain === 'road' ? 999 : 2.2;
  }

  update(dt: number, playerSpeed: number): void {
    if (this.terrain !== 'road') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.trySpawn();
        this.spawnTimer = 2.0 + Math.random() * 2.6;
      }
    }
    for (const h of this.hazards) h.update(dt, playerSpeed);
    this.hazards = this.hazards.filter((h) => h.alive);
  }

  private trySpawn(): void {
    // Spawn slightly inset from each road edge so the hazard reads as
    // "on the road" rather than peeking off the shoulder.
    const HAZARD_SPAWN_SCREEN_Y = -60;
    const shape = this.roadProfile.shapeAtScreen(HAZARD_SPAWN_SCREEN_Y);
    const inset = 30;
    const span = Math.max(0, shape.xMax - shape.xMin - inset * 2);
    const x = shape.xMin + inset + Math.random() * span;
    const type: TerrainHazardType = this.terrain === 'ice' ? 'ice_patch' : 'wake';
    this.hazards.push(new TerrainHazard(type, x, HAZARD_SPAWN_SCREEN_Y));
  }

  getHazards(): TerrainHazard[] {
    return this.hazards;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const h of this.hazards) h.render(ctx);
  }
}
