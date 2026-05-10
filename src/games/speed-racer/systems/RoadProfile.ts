// Road geometry pipeline. v6 introduces per-row dynamic geometry — width
// changes, splits/forks, bridges. This module defines the interface every
// consumer (player clamp, enemy clamp, spawner lane math, renderer, off-road
// kill scan) goes through, plus the trivial straight-rectangle implementation
// that preserves v5 behavior.
//
// Coordinate system:
//   worldScroll  = total distance traveled (RoadRenderer.update accumulates).
//   sectionStart = scroll value captured when the active section began.
//   sectionWorldY (worldY) = currentScroll - sectionStart, i.e. distance into
//     the active section. Geometry is keyed on this so profiles are reusable
//     across loops and define their features section-locally.
//   For an entity at screen Y `s`, its worldY = sectionWorldY + (PLAYER.Y - s)
//     — the player sits at fixed screen Y so player worldY == sectionWorldY.

import { PLAYER, ROAD } from '../data/constants';

// One drivable strip within a forked road. Each segment owns its lane count
// so the spawner / armored AI / renderer can reason about the side they're on
// independently (e.g., a 2-lane left side and a 2-lane right side after a
// 4-lane road splits in half).
export interface RoadSegment {
  xMin: number;
  xMax: number;
  laneCount: number;
}

export interface RoadShape {
  // Outer drivable bounds. For forks (Step 3) these are the outer hull;
  // simple consumers (missile despawn, off-road kill outer-edge check,
  // roadside posts) can use these directly.
  xMin: number;
  xMax: number;
  // Optional: when present, the road is split into multiple drivable strips
  // (forks). xMin/xMax above remain the outer hull bounds. Fork-aware
  // consumers (player segment clamp, spawner, divider visual) walk this
  // array; fork-unaware consumers fall back to outer xMin/xMax.
  segments?: ReadonlyArray<RoadSegment>;
  // Optional: drivable shoulders just outside the main pavement. xMin/xMax
  // remain the pavement bounds; shoulder.xMin <= xMin and shoulder.xMax >=
  // xMax. Players can drive on shoulders with a handling penalty; enemies
  // stay clamped to pavement (bumping them past pavement still credits
  // off-road kill — shoulders are a player-tactical zone only).
  shoulder?: { xMin: number; xMax: number };
}

// Pure geometry function — section-relative worldY in, road shape out.
// Implementations are stateless w.r.t. scroll; the live RoadProfile wrapper
// owns scroll/section bookkeeping.
export interface RoadGeometry {
  shapeAt(worldY: number): RoadShape;
  laneCount(worldY: number): number;
  laneCenterAt(worldY: number, lane: number): number;
  isOnRoad(worldY: number, x: number): boolean;
  // Renderer fast-path hint: when true, every visible row of the section
  // returns the same shape, so the renderer can fall back to single-fillRect
  // draws instead of per-row strips. StraightRoadGeometry returns true; any
  // dynamic profile (width change, forks, etc.) returns false. Geometries
  // also drop to non-uniform once a curve is attached via setCurve.
  isUniform(): boolean;
  // v10 — attach an optional lateral curve schedule. shapeAt applies the
  // schedule's offset to xMin/xMax/segments/shoulder bounds. Pass null to
  // detach. Geometries with no curve match v9 behavior exactly.
  setCurve(curve: CurveSchedule | null): void;
}

// v10 — curve schedule. Authored per section in SectionDef.roadCurve and
// installed on the geometry by SpeedRacerGame.applyRoadProfile via setCurve.
// Keyframes are smoothstep-interpolated (curves are visually prominent;
// linear-interp would feel kinked). Outside the authored range, offset is
// clamped to the nearest endpoint — but every authored schedule starts and
// ends at offset 0, so that clamp degenerates to "no curve."
export interface CurveKeyframe {
  worldY: number;   // section-relative, ascending order
  offset: number;   // lateral pixels (positive = right, negative = left)
}

export class CurveSchedule {
  constructor(private readonly keyframes: ReadonlyArray<CurveKeyframe>) {}

  offsetAt(worldY: number): number {
    if (this.keyframes.length === 0) return 0;
    const first = this.keyframes[0];
    const last = this.keyframes[this.keyframes.length - 1];
    if (worldY <= first.worldY) return first.offset;
    if (worldY >= last.worldY) return last.offset;
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const a = this.keyframes[i];
      const b = this.keyframes[i + 1];
      if (worldY >= a.worldY && worldY <= b.worldY) {
        const span = b.worldY - a.worldY;
        if (span <= 0) return a.offset;
        const t = (worldY - a.worldY) / span;
        // Smoothstep — natural-feeling acceleration in/out of bends without
        // authoring extra keyframes for ease curves.
        const eased = t * t * (3 - 2 * t);
        return a.offset + (b.offset - a.offset) * eased;
      }
    }
    return 0;
  }
}

// Trivial geometry — returns the v5 straight-rectangle road regardless of
// worldY. Used as the default for every section until per-section profiles
// are introduced in Step 2. v10 — accepts an optional curve schedule that
// shifts the rectangle laterally per row.
export class StraightRoadGeometry implements RoadGeometry {
  private curve: CurveSchedule | null = null;

  setCurve(curve: CurveSchedule | null): void {
    this.curve = curve;
  }

  shapeAt(worldY: number): RoadShape {
    if (!this.curve) {
      return { xMin: ROAD.X_MIN, xMax: ROAD.X_MAX };
    }
    const offset = this.curve.offsetAt(worldY);
    return { xMin: ROAD.X_MIN + offset, xMax: ROAD.X_MAX + offset };
  }
  laneCount(): number {
    return ROAD.LANE_COUNT;
  }
  laneCenterAt(worldY: number, lane: number): number {
    const laneWidth = ROAD.WIDTH / ROAD.LANE_COUNT;
    const offset = this.curve ? this.curve.offsetAt(worldY) : 0;
    return ROAD.X_MIN + offset + laneWidth * (lane + 0.5);
  }
  isOnRoad(worldY: number, x: number): boolean {
    const offset = this.curve ? this.curve.offsetAt(worldY) : 0;
    return x >= ROAD.X_MIN + offset && x <= ROAD.X_MAX + offset;
  }
  isUniform(): boolean {
    return this.curve === null;
  }
}

// Live profile consumers query during update/render. Owns the active geometry
// plus the scroll/section snapshot, and exposes screen-Y-aware helpers so
// callers don't have to thread worldScroll/sectionStartScroll themselves.
export class RoadProfile {
  private geometry: RoadGeometry = new StraightRoadGeometry();
  private sectionStartScroll = 0;
  private currentScroll = 0;
  // v9 — dynamic player screen Y. The road coordinate system anchors at
  // PLAYER.Y (worldY = currentScroll-sectionStartScroll there); but the
  // PLAYER's own worldY follows their actual screen position so shape queries
  // / palette zones / lane math at the player track them up and down.
  private playerScreenY: number = PLAYER.Y;

  reset(): void {
    this.geometry = new StraightRoadGeometry();
    this.sectionStartScroll = 0;
    this.currentScroll = 0;
    this.playerScreenY = PLAYER.Y;
  }

  // Swap geometry at a section boundary. Pass the worldScroll value at which
  // the new section began so geometry queries see distance-into-section.
  setGeometry(geometry: RoadGeometry, sectionStartScroll: number): void {
    this.geometry = geometry;
    this.sectionStartScroll = sectionStartScroll;
  }

  // Tick once per frame from SpeedRacerGame.onUpdate after road.update().
  setScroll(scroll: number): void {
    this.currentScroll = scroll;
  }

  // v9 — call once per frame after player.update so playerWorldY / shapeAtPlayer
  // see the player's actual screen position. Defaults to PLAYER.Y if never
  // called (covers harnesses / tests that don't drive the player car).
  setPlayerScreenY(y: number): void {
    this.playerScreenY = y;
  }

  getGeometry(): RoadGeometry {
    return this.geometry;
  }

  // Section-relative worldY for the player's row, accounting for dynamic Y.
  // worldYAtScreen anchors at PLAYER.Y (the canonical reference); when the
  // player visually moves up to e.g. y=380, their worldY advances by +100
  // because they're rendered over road that scrolled past PLAYER.Y already.
  playerWorldY(): number {
    return this.worldYAtScreen(this.playerScreenY);
  }

  // Section-relative worldY for an entity at the given screen Y. Anchored at
  // the canonical PLAYER.Y constant — entities at PLAYER.Y see worldY equal to
  // the scroll-derived section anchor regardless of where the player's car
  // is currently rendered.
  worldYAtScreen(screenY: number): number {
    return this.currentScroll - this.sectionStartScroll + (PLAYER.Y - screenY);
  }

  // --- Shape queries --------------------------------------------------------

  shapeAtPlayer(): RoadShape {
    return this.geometry.shapeAt(this.playerWorldY());
  }

  shapeAtScreen(screenY: number): RoadShape {
    return this.geometry.shapeAt(this.worldYAtScreen(screenY));
  }

  shapeAt(worldY: number): RoadShape {
    return this.geometry.shapeAt(worldY);
  }

  // --- Lane queries ---------------------------------------------------------

  laneCountAtScreen(screenY: number): number {
    return this.geometry.laneCount(this.worldYAtScreen(screenY));
  }

  laneCenterAtScreen(screenY: number, lane: number): number {
    return this.geometry.laneCenterAt(this.worldYAtScreen(screenY), lane);
  }

  // --- On-road check --------------------------------------------------------

  isOnRoadAtScreen(screenY: number, x: number): boolean {
    return this.geometry.isOnRoad(this.worldYAtScreen(screenY), x);
  }

  // --- Renderer hint --------------------------------------------------------

  isUniform(): boolean {
    return this.geometry.isUniform();
  }
}
