// Concrete RoadGeometry implementations for v6.
//
// Step 2 introduces WidthChangeGeometry — keyframe-driven xMin/xMax that
// linearly interpolates between authored anchor points. Lane count snaps to
// the previous keyframe's value (so it stays stable through each "stretch"
// and changes at deliberate worldY boundaries rather than mid-taper).
//
// Future Step 3 / 4 geometries (forks, bridges) live alongside in this file.

import type { RoadGeometry, RoadShape } from './RoadProfile';

export interface WidthKeyframe {
  // Section-relative worldY (0 = section start). Keyframes must be authored in
  // ascending order; the geometry does not sort them.
  worldY: number;
  xMin: number;
  xMax: number;
  // Number of lanes during the stretch starting at this keyframe (until the
  // next keyframe). Snapping rather than interpolating keeps the spawner and
  // armored-AI lane queries stable inside a stretch.
  laneCount: number;
}

export class WidthChangeGeometry implements RoadGeometry {
  private readonly keyframes: ReadonlyArray<WidthKeyframe>;

  constructor(keyframes: ReadonlyArray<WidthKeyframe>) {
    if (keyframes.length === 0) {
      throw new Error('WidthChangeGeometry requires at least one keyframe');
    }
    this.keyframes = keyframes;
  }

  shapeAt(worldY: number): RoadShape {
    const { prev, next, t } = this.findInterp(worldY);
    return {
      xMin: prev.xMin + (next.xMin - prev.xMin) * t,
      xMax: prev.xMax + (next.xMax - prev.xMax) * t,
    };
  }

  laneCount(worldY: number): number {
    return this.findInterp(worldY).prev.laneCount;
  }

  laneCenterAt(worldY: number, lane: number): number {
    const shape = this.shapeAt(worldY);
    const count = this.laneCount(worldY);
    const laneWidth = (shape.xMax - shape.xMin) / count;
    return shape.xMin + laneWidth * (lane + 0.5);
  }

  isOnRoad(worldY: number, x: number): boolean {
    const shape = this.shapeAt(worldY);
    return x >= shape.xMin && x <= shape.xMax;
  }

  isUniform(): boolean {
    return false;
  }

  // Locate the bracketing keyframes for the given worldY. Outside the
  // authored range, both bounds collapse to the nearest endpoint so the
  // geometry returns a sensible shape (matching the boundary keyframe).
  private findInterp(worldY: number): {
    prev: WidthKeyframe;
    next: WidthKeyframe;
    t: number;
  } {
    const first = this.keyframes[0];
    const last = this.keyframes[this.keyframes.length - 1];
    if (worldY <= first.worldY) {
      return { prev: first, next: first, t: 0 };
    }
    if (worldY >= last.worldY) {
      return { prev: last, next: last, t: 0 };
    }
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const a = this.keyframes[i];
      const b = this.keyframes[i + 1];
      if (worldY >= a.worldY && worldY <= b.worldY) {
        const span = b.worldY - a.worldY;
        const t = span > 0 ? (worldY - a.worldY) / span : 0;
        return { prev: a, next: b, t };
      }
    }
    // Unreachable given the boundary checks above, but the type system needs a
    // return — fall back to the first keyframe defensively.
    return { prev: first, next: first, t: 0 };
  }
}
