// Concrete RoadGeometry implementations for v6.
//
// Step 2 introduces WidthChangeGeometry — keyframe-driven xMin/xMax that
// linearly interpolates between authored anchor points. Lane count snaps to
// the previous keyframe's value (so it stays stable through each "stretch"
// and changes at deliberate worldY boundaries rather than mid-taper).
//
// Future Step 3 / 4 geometries (forks, bridges) live alongside in this file.

import type { RoadGeometry, RoadSegment, RoadShape } from './RoadProfile';

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

// === Step 3 — ForkGeometry ===
//
// The Spy-Hunter "road splits into two parallel lanes around an island" move.
// Each keyframe declares the segments at that worldY (just 1 segment outside
// the fork; 2 segments inside). Segment xMin/xMax interpolate linearly between
// adjacent keyframes; lane count snaps to the previous keyframe (same rule as
// WidthChangeGeometry).
//
// Constraint: every keyframe must declare the SAME number of segments. To
// open a fork smoothly, the entry keyframe should already declare 2 segments
// — they just touch (leftSeg.xMax == rightSeg.xMin), so visually the divider
// has zero width and the road still reads as one piece. As later keyframes
// pull leftSeg.xMax / rightSeg.xMin apart, the divider grows.

export interface ForkSegmentKeyframe {
  xMin: number;
  xMax: number;
  laneCount: number;
}

export interface ForkKeyframe {
  worldY: number;
  segments: ReadonlyArray<ForkSegmentKeyframe>;
}

export class ForkGeometry implements RoadGeometry {
  private readonly keyframes: ReadonlyArray<ForkKeyframe>;
  private readonly segmentCount: number;

  constructor(keyframes: ReadonlyArray<ForkKeyframe>) {
    if (keyframes.length === 0) {
      throw new Error('ForkGeometry requires at least one keyframe');
    }
    this.segmentCount = keyframes[0].segments.length;
    for (const kf of keyframes) {
      if (kf.segments.length !== this.segmentCount) {
        throw new Error(
          'ForkGeometry keyframes must all declare the same number of segments',
        );
      }
    }
    this.keyframes = keyframes;
  }

  shapeAt(worldY: number): RoadShape {
    const { prev, next, t } = this.findInterp(worldY);
    const segments: RoadSegment[] = [];
    for (let i = 0; i < this.segmentCount; i++) {
      const a = prev.segments[i];
      const b = next.segments[i];
      segments.push({
        xMin: a.xMin + (b.xMin - a.xMin) * t,
        xMax: a.xMax + (b.xMax - a.xMax) * t,
        laneCount: a.laneCount,
      });
    }
    return {
      xMin: segments[0].xMin,
      xMax: segments[segments.length - 1].xMax,
      segments,
    };
  }

  // Total lane count summed across all segments. Used by fork-unaware
  // consumers; fork-aware code reads per-segment laneCount instead.
  laneCount(worldY: number): number {
    const { prev } = this.findInterp(worldY);
    let total = 0;
    for (const seg of prev.segments) total += seg.laneCount;
    return total;
  }

  // Lane center across the WHOLE road, indexed left-to-right across all
  // segments. Spawner usually picks segment + local-lane via shape.segments,
  // but this preserves API parity for fork-unaware callers.
  laneCenterAt(worldY: number, lane: number): number {
    const shape = this.shapeAt(worldY);
    let remaining = lane;
    for (const seg of shape.segments!) {
      if (remaining < seg.laneCount) {
        const laneWidth = (seg.xMax - seg.xMin) / seg.laneCount;
        return seg.xMin + laneWidth * (remaining + 0.5);
      }
      remaining -= seg.laneCount;
    }
    // Past the last lane — clamp to last segment's last lane center.
    const last = shape.segments![shape.segments!.length - 1];
    const lw = (last.xMax - last.xMin) / last.laneCount;
    return last.xMin + lw * (last.laneCount - 0.5);
  }

  // True when x sits inside any segment. The divider gap is "off road."
  isOnRoad(worldY: number, x: number): boolean {
    const shape = this.shapeAt(worldY);
    for (const seg of shape.segments!) {
      if (x >= seg.xMin && x <= seg.xMax) return true;
    }
    return false;
  }

  isUniform(): boolean {
    return false;
  }

  private findInterp(worldY: number): {
    prev: ForkKeyframe;
    next: ForkKeyframe;
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
    return { prev: first, next: first, t: 0 };
  }
}

// === Step 5 — ShoulderedRoadGeometry ===
//
// A straight road of constant width with drivable shoulders on each side.
// Players can dip onto the shoulders to dodge traffic at the cost of slower
// handling; enemies stay clamped to the pavement and earn off-road kill
// credit if bumped past the pavement edge (shoulder counts as off-road for
// the bump knockoff loop).

export class ShoulderedRoadGeometry implements RoadGeometry {
  private readonly shape: RoadShape;
  private readonly lanes: number;

  constructor(
    pavementXMin: number,
    pavementXMax: number,
    laneCount: number,
    shoulderWidth: number,
  ) {
    this.lanes = laneCount;
    this.shape = {
      xMin: pavementXMin,
      xMax: pavementXMax,
      shoulder: {
        xMin: pavementXMin - shoulderWidth,
        xMax: pavementXMax + shoulderWidth,
      },
    };
  }

  shapeAt(): RoadShape {
    return this.shape;
  }

  laneCount(): number {
    return this.lanes;
  }

  laneCenterAt(_worldY: number, lane: number): number {
    void _worldY;
    const laneWidth = (this.shape.xMax - this.shape.xMin) / this.lanes;
    return this.shape.xMin + laneWidth * (lane + 0.5);
  }

  // True if x is on pavement OR on a shoulder. The bump-knockoff
  // off-road check in SpeedRacerGame uses the pavement bounds explicitly
  // (so bumping an enemy onto the shoulder still scores), this method is
  // for fork-style "is on any drivable surface" queries.
  isOnRoad(_worldY: number, x: number): boolean {
    void _worldY;
    return x >= this.shape.shoulder!.xMin && x <= this.shape.shoulder!.xMax;
  }

  // Uniform geometry — same shape every row. Renderer fast path applies.
  isUniform(): boolean {
    return true;
  }
}
