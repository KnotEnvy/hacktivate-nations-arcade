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
  // dynamic profile (width change, forks, etc.) returns false.
  isUniform(): boolean;
}

// Trivial geometry — returns the v5 straight-rectangle road regardless of
// worldY. Used as the default for every section until per-section profiles
// are introduced in Step 2.
export class StraightRoadGeometry implements RoadGeometry {
  shapeAt(): RoadShape {
    return { xMin: ROAD.X_MIN, xMax: ROAD.X_MAX };
  }
  laneCount(): number {
    return ROAD.LANE_COUNT;
  }
  laneCenterAt(_worldY: number, lane: number): number {
    void _worldY;
    const laneWidth = ROAD.WIDTH / ROAD.LANE_COUNT;
    return ROAD.X_MIN + laneWidth * (lane + 0.5);
  }
  isOnRoad(_worldY: number, x: number): boolean {
    void _worldY;
    return x >= ROAD.X_MIN && x <= ROAD.X_MAX;
  }
  isUniform(): boolean {
    return true;
  }
}

// Live profile consumers query during update/render. Owns the active geometry
// plus the scroll/section snapshot, and exposes screen-Y-aware helpers so
// callers don't have to thread worldScroll/sectionStartScroll themselves.
export class RoadProfile {
  private geometry: RoadGeometry = new StraightRoadGeometry();
  private sectionStartScroll = 0;
  private currentScroll = 0;

  reset(): void {
    this.geometry = new StraightRoadGeometry();
    this.sectionStartScroll = 0;
    this.currentScroll = 0;
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

  getGeometry(): RoadGeometry {
    return this.geometry;
  }

  // Section-relative worldY for the player's row.
  playerWorldY(): number {
    return this.currentScroll - this.sectionStartScroll;
  }

  // Section-relative worldY for an entity at the given screen Y.
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
