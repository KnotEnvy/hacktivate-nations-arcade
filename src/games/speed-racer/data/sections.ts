// Speed Racer — Section definitions.
// Each section is a themed stretch of road with its own palette,
// scenery style, and spawner difficulty. Sections cycle in order;
// after the last one, progression loops back to the first.

import type { MusicName } from '@/services/AudioManager';
import type { SpawnerOptions } from '../systems/EnemySpawner';
import type { CurveKeyframe, RoadGeometry } from '../systems/RoadProfile';
import {
  ForkGeometry,
  ShoulderedRoadGeometry,
  WidthChangeGeometry,
} from '../systems/RoadGeometries';

export type SceneryStyle = 'trees' | 'buildings' | 'bridge' | 'mountain' | 'coast' | 'water' | 'ice';

export type Terrain = 'road' | 'water' | 'ice';

export interface HandlingProfile {
  steerMul: number; // multiplies STEER_ACCEL — lower = sluggish to start a turn
  decelMul: number; // multiplies STEER_DECEL — lower = floaty / slides
}

export const TERRAIN_HANDLING: Record<Terrain, HandlingProfile> = {
  road: { steerMul: 1, decelMul: 1 },
  water: { steerMul: 0.7, decelMul: 0.55 }, // floaty boat
  ice: { steerMul: 0.55, decelMul: 0.28 }, // very slippy
};

export interface SectionPalette {
  // Road body
  roadColor: string;
  roadShadeColor: string; // subtle gradient stop near edges for depth
  edgeColor: string;
  edgeGlowColor: string;

  // Lane markings
  laneLineColor: string;
  centerLineColor: string;

  // Off-road background (top → bottom gradient)
  grassTop: string;
  grassBottom: string;

  // Atmospheric horizon glow at the top of the screen
  horizonColor: string;
  horizonAlpha: number; // 0..1

  // Scenery
  sceneryStyle: SceneryStyle;
  sceneryColor: string;
  sceneryAccent: string; // window lights, tree highlights, etc.
  sceneryRimColor: string; // optional rim/silhouette outline

  // Roadside posts (street markers / lamps)
  postColor: string;
  postAccent: string;

  // Section banner
  bannerColor: string;
  bannerGlow: string;
}

export type WeatherEffect = 'none' | 'snow';

export interface TunnelZone {
  // Section-relative worldY range where the tunnel overlay applies. The first
  // ~80 worldY at each end fade in/out so the entry/exit reads as gradual.
  startWorldY: number;
  endWorldY: number;
}

// v7 — palette override zone. Crossfades any subset of color fields on the
// section palette across a section-relative worldY range. Used to promote
// scenery-only set-pieces (e.g., the Steel Span bridge) into a true road
// body / edge transition. Reusable for future sections (e.g., a tunnel
// where the road itself goes concrete inside).
//
// Only string color fields are interpolated. sceneryStyle / numeric fields
// stay on the base palette — those describe layout, not paint.
type PaletteColorField =
  | 'roadColor' | 'roadShadeColor'
  | 'edgeColor' | 'edgeGlowColor'
  | 'laneLineColor' | 'centerLineColor'
  | 'grassTop' | 'grassBottom'
  | 'horizonColor'
  | 'sceneryColor' | 'sceneryAccent' | 'sceneryRimColor'
  | 'postColor' | 'postAccent'
  | 'bannerColor' | 'bannerGlow';

export interface PaletteOverrideZone {
  startWorldY: number;
  endWorldY: number;
  // Fade-in/fade-out length at each end (worldY units). Defaults to 200.
  fadeLength?: number;
  palette: Partial<Pick<SectionPalette, PaletteColorField>>;
}

export interface SectionDef {
  id: string;
  name: string; // banner headline
  subtitle: string; // banner subhead, flavor text
  lengthMeters: number; // distance (in pixel-units) before transition
  palette: SectionPalette;
  spawnerConfig: Partial<SpawnerOptions>;
  terrain?: Terrain; // affects player handling. Defaults to 'road'.
  weather?: WeatherEffect; // atmospheric overlay. Defaults to 'none'.
  // v6 — optional dynamic road geometry. Omitted = straight rectangle (v5
  // behavior). Per-section width-change / fork / bridge profiles plug in here.
  roadGeometry?: RoadGeometry;
  // v6 Step 4 — pure visual tunnel overlay zones. Geometry doesn't change;
  // the renderer applies a darkness overlay (with periodic light bands)
  // covering the entire visible area while the player's worldY sits inside
  // a zone. Multiple zones per section supported.
  tunnelZones?: ReadonlyArray<TunnelZone>;
  // v7 — palette override zones. Crossfade road / edge / lane colors across
  // a worldY range so a set-piece (e.g., a bridge) reshapes the surface
  // itself, not just the surrounding scenery.
  paletteOverrides?: ReadonlyArray<PaletteOverrideZone>;
  // v8 — optional procedural music track for this section. When set AND
  // different from the currently playing track, SpeedRacerGame.advanceSection
  // crossfades to it via AudioManager.playMusic. Sections that omit musicTrack
  // inherit whatever's already playing (sticky inheritance), so we only spend
  // a swap when a section genuinely needs a different vibe than its predecessor.
  // The hub starts the speed-racer primary ('action_chase') on game launch, so
  // §1 typically omits this and inherits.
  musicTrack?: MusicName;
  // v10 (Wave 4) — optional bear-left/bear-right curve schedule. Applied to
  // the section's geometry via setCurve in SpeedRacerGame.applyRoadProfile.
  // Authoring invariant: every schedule starts and ends at offset 0 so the
  // road is centered at section transitions. Smoothstep interpolation between
  // adjacent keyframes — 4 keyframes per bear is the typical pattern (entry@0,
  // ramp-end@peak, hold-end@peak, exit@0). Positive offset = bear right
  // (player must steer right to track); negative = bear left.
  roadCurve?: ReadonlyArray<CurveKeyframe>;
}

// === Palette resolution ================================================

// Hex parser supporting #RGB / #RRGGBB. Returns [r, g, b] in 0..255.
function parseHex(hex: string): [number, number, number] {
  if (hex.length === 4) {
    return [
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
      parseInt(hex[3] + hex[3], 16),
    ];
  }
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(c: number): string {
  const v = Math.max(0, Math.min(255, Math.round(c)));
  return v.toString(16).padStart(2, '0');
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = ar + (br - ar) * t;
  const g = ag + (bg - ag) * t;
  const bl = ab + (bb - ab) * t;
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

// Resolve the effective palette at a section-relative worldY by crossfading
// any active paletteOverride zones onto the base palette. Pure function —
// used each frame from SpeedRacerGame.onRender.
export function resolvePalette(
  section: SectionDef,
  sectionRelativeWorldY: number,
): SectionPalette {
  const overrides = section.paletteOverrides;
  if (!overrides || overrides.length === 0) return section.palette;

  let result: SectionPalette = section.palette;
  for (const z of overrides) {
    if (sectionRelativeWorldY < z.startWorldY || sectionRelativeWorldY > z.endWorldY) {
      continue;
    }
    const fade = z.fadeLength ?? 200;
    const distFromEdge = Math.min(
      sectionRelativeWorldY - z.startWorldY,
      z.endWorldY - sectionRelativeWorldY,
    );
    const t = Math.max(0, Math.min(1, distFromEdge / fade));
    if (t <= 0) continue;
    // Lerp each declared field from current resolved palette toward the
    // override target. Stacking zones compose left-to-right.
    const next: SectionPalette = { ...result };
    for (const key of Object.keys(z.palette) as Array<keyof typeof z.palette>) {
      const target = z.palette[key];
      if (typeof target !== 'string') continue;
      const base = result[key];
      if (typeof base !== 'string') continue;
      (next[key] as string) = lerpHex(base, target, t);
    }
    result = next;
  }
  return result;
}

// === Section 1 — gentle intro. No armored, sparse traffic. ===
const NEON_HIGHWAY: SectionDef = {
  id: 'neon-highway',
  name: 'NEON HIGHWAY',
  subtitle: 'Open road · Ease into it',
  lengthMeters: 8000,
  palette: {
    roadColor: '#1a1a2e',
    roadShadeColor: '#0f0f1f',
    edgeColor: '#FF1493',
    edgeGlowColor: '#FF1493',
    laneLineColor: '#00FFFF',
    centerLineColor: '#FFFF00',
    grassTop: '#0a001a',
    grassBottom: '#1a0033',
    horizonColor: '#FF1493',
    horizonAlpha: 0.18,
    sceneryStyle: 'trees',
    sceneryColor: '#2a0044',
    sceneryAccent: '#FF1493',
    sceneryRimColor: '#5a1a8a',
    postColor: '#FFFFFF',
    postAccent: '#FF1493',
    bannerColor: '#FF0080',
    bannerGlow: '#FF1493',
  },
  spawnerConfig: {
    // Gentle tutorial stretch: only ram-type enemies, spaced out, so new
    // players can learn steering and side-swipe ramming without being
    // sniped or walled off by armored. Civilians stay sparse for the same
    // reason — too much traffic in section 1 feels unfair before the HUD
    // is familiar. Other enemy types kick in starting in Section 2.
    spawnInterval: 2.4,
    enemyTypes: ['ram', 'shooter', 'armored'],
    enemyTypeWeights: [1, 0, 0],
    civilianChance: 0.35,
    civilianSpawnInterval: 3.4,
    vanIntervalMin: 12,
    vanIntervalMax: 18,
  },
  // v6 Step 5 — drivable paved shoulders (60px on each side). Tutorial
  // section gets a tactical "you can dodge into the shoulder if cornered"
  // option early, with the trade-off that shoulder handling is sluggish.
  // Pavement: [160, 640], shoulder envelope: [100, 700].
  roadGeometry: new ShoulderedRoadGeometry(160, 640, 4, 60),
  // v10 — gentle tutorial curves: one mild bear right, one mild bear left.
  // 50px magnitude (~half a lane); plenty of shoulder headroom if the player
  // misses the cue. Each hold is ~1500 worldY (~4.2 sec at base speed) so the
  // bend lasts long enough to feel like a sustained turn rather than a drift.
  roadCurve: [
    { worldY:    0, offset:   0 },
    { worldY: 1300, offset:   0 },
    { worldY: 1500, offset:  50 },
    { worldY: 3200, offset:  50 },
    { worldY: 3400, offset:   0 },
    { worldY: 4300, offset:   0 },
    { worldY: 4500, offset: -50 },
    { worldY: 6200, offset: -50 },
    { worldY: 6400, offset:   0 },
    { worldY: 8000, offset:   0 },
  ],
};

// === Section 2 — urban shooters, no armored yet. ===
const NEON_CITY: SectionDef = {
  id: 'neon-city',
  name: 'NEON CITY',
  subtitle: 'Downtown · Snipers on rooftops',
  lengthMeters: 8000,
  palette: {
    roadColor: '#0d0d1a',
    roadShadeColor: '#05050d',
    edgeColor: '#00D9FF',
    edgeGlowColor: '#00D9FF',
    laneLineColor: '#FFD700',
    centerLineColor: '#FFFFFF',
    grassTop: '#03000a',
    grassBottom: '#0a0028',
    horizonColor: '#00D9FF',
    horizonAlpha: 0.22,
    sceneryStyle: 'buildings',
    sceneryColor: '#10001f',
    sceneryAccent: '#FFD27A',
    sceneryRimColor: '#3a1466',
    postColor: '#FFD700',
    postAccent: '#00D9FF',
    bannerColor: '#00D9FF',
    bannerGlow: '#00D9FF',
  },
  spawnerConfig: {
    // First proper step up from the tutorial. Shooters introduced, armored
    // still deferred to section 3, and spawn cadence loosened from v4's 1.4s
    // to 1.7s so the curve ramps smoothly from §1 → §7 instead of jumping
    // hard out of the tutorial.
    spawnInterval: 1.7,
    enemyTypes: ['ram', 'shooter', 'enforcer', 'armored'],
    enemyTypeWeights: [5, 2, 0, 0],
    civilianChance: 0.55,
    civilianSpawnInterval: 2.6,
    vanIntervalMin: 14,
    vanIntervalMax: 20,
  },
  // v6 Step 4 — downtown overpass tunnel. Player drives under a building
  // mid-section. Darkness fades in, periodic ceiling lights strobe overhead,
  // visibility drops so the section's snipers feel more dangerous in the dark.
  tunnelZones: [
    { startWorldY: 3000, endWorldY: 5000 },
  ],
  // v10 — bear left before the tunnel, bear right after. Curves stay clear
  // of the dark stretch (3000–5000) where reduced visibility plus a curve
  // would compound unfairly. Each hold is ~1500 worldY (~4.2 sec).
  roadCurve: [
    { worldY:    0, offset:   0 },
    { worldY:  700, offset:   0 },
    { worldY:  900, offset: -80 },
    { worldY: 2400, offset: -80 },
    { worldY: 2600, offset:   0 },
    { worldY: 5100, offset:   0 },
    { worldY: 5300, offset:  80 },
    { worldY: 6800, offset:  80 },
    { worldY: 7000, offset:   0 },
    { worldY: 8000, offset:   0 },
  ],
};

// === Section 3 — armored introduction + first burst/formation tells. ===
const STEEL_SPAN: SectionDef = {
  id: 'steel-span',
  name: 'STEEL SPAN',
  subtitle: 'Suspension bridge · Armor incoming',
  lengthMeters: 8000,
  palette: {
    roadColor: '#1a2030',
    roadShadeColor: '#0d1018',
    edgeColor: '#FF4DC2',
    edgeGlowColor: '#FF4DC2',
    laneLineColor: '#88E5FF',
    centerLineColor: '#FFD700',
    grassTop: '#000814',
    grassBottom: '#001E3C',
    horizonColor: '#FF4DC2',
    horizonAlpha: 0.20,
    sceneryStyle: 'bridge',
    sceneryColor: '#1a2a3a',
    sceneryAccent: '#FFD700', // warning lights
    sceneryRimColor: '#4a6a8a',
    postColor: '#FFD700',
    postAccent: '#FF4DC2',
    bannerColor: '#FF4DC2',
    bannerGlow: '#FF4DC2',
  },
  spawnerConfig: {
    // Enforcer debut. Old "armored gauntlet" feel updated for v5: enforcer
    // sedans are the main armored threat here (bumpable with momentum, or
    // missile-able). SWAT trucks stay deferred to §5 to keep the ramp smooth.
    spawnInterval: 1.45,
    enemyTypes: ['ram', 'shooter', 'enforcer', 'armored'],
    enemyTypeWeights: [5, 2, 2, 0],
    civilianChance: 0.5,
    civilianSpawnInterval: 2.5,
    vanIntervalMin: 14,
    vanIntervalMax: 20,
    shooterBurstChance: 0.12,
    formationChance: 0.08,
  },
  // v7 — promote the existing scenery-bridge into a true bridge transition.
  // Mid-section, the road body crossfades to weathered concrete and the edges
  // shift to industrial steel-railing tones. The bridge towers (already drawn
  // by sceneryStyle: 'bridge') line up with this stretch so the set-piece
  // reads as one coherent crossing instead of "neon road that happens to have
  // towers next to it." 200-unit fade in/out gives a perceptible-but-not-
  // jarring transition.
  paletteOverrides: [
    {
      startWorldY: 1500,
      endWorldY: 6500,
      fadeLength: 350,
      palette: {
        // Road body: weathered concrete deck with darker expansion-joint shade
        roadColor: '#5a5a62',
        roadShadeColor: '#2e2e36',
        // Edges become steel railings — desaturated industrial silver, with a
        // faint warning-amber glow that matches the existing tower lights.
        edgeColor: '#a8b0bc',
        edgeGlowColor: '#FFB840',
        // High-contrast lane paint on concrete
        laneLineColor: '#FFFFFF',
        centerLineColor: '#FFD700',
        // Roadside posts read as bridge stanchions
        postColor: '#c8d0dc',
        postAccent: '#FFB840',
      },
    },
  ],
  // v10 — long suspension-bridge sweepers. Two large-radius bears, one each
  // direction. Magnitudes 70 / 90 — bridges curve gently in real life and
  // the steel railings (visualized via the palette override) read as
  // following the road, not opposing it.
  roadCurve: [
    { worldY:    0, offset:   0 },
    { worldY:  500, offset:   0 },
    { worldY:  700, offset:  70 },
    { worldY: 2500, offset:  70 },
    { worldY: 2700, offset:   0 },
    { worldY: 4500, offset:   0 },
    { worldY: 4700, offset: -90 },
    { worldY: 6300, offset: -90 },
    { worldY: 6500, offset:   0 },
    { worldY: 8000, offset:   0 },
  ],
};

// === Section 4 — alpine pass, dodge focus, civilian-heavy. ===
// v6 — first dynamic-width section. Two narrow chokepoints (4 lanes -> 3 lanes)
// give the mountain pass the natural "the road squeezes through a canyon"
// feel. Tapers are 200 worldY units on each side; the narrow stretches sit
// at full road width 360 (vs the 480 baseline). Lane count snaps from 4 to 3
// at the narrow keyframes and back at the wide keyframes — see
// WidthChangeGeometry for the snapping rule.
const ALPINE_PASS: SectionDef = {
  id: 'alpine-pass',
  name: 'ALPINE PASS',
  subtitle: 'Mountain road · Heavy traffic',
  lengthMeters: 8000,
  palette: {
    roadColor: '#1f1a2e',
    roadShadeColor: '#0f0a1e',
    edgeColor: '#9D7CFF',
    edgeGlowColor: '#B89DFF',
    laneLineColor: '#FFFFFF',
    centerLineColor: '#FFD700',
    grassTop: '#0a0033',
    grassBottom: '#1a1040',
    horizonColor: '#9D7CFF',
    horizonAlpha: 0.25,
    sceneryStyle: 'mountain',
    sceneryColor: '#2a1a4a',
    sceneryAccent: '#FFFFFF', // snowcaps
    sceneryRimColor: '#4a3a6a',
    postColor: '#FFFFFF',
    postAccent: '#9D7CFF',
    bannerColor: '#B89DFF',
    bannerGlow: '#9D7CFF',
  },
  spawnerConfig: {
    // Mountain dodge stretch. Still ram-leaning with thicker civilian
    // traffic so the section retains its "weave through the pack" identity,
    // but spawn rate and ranged share both step up vs §3. Enforcers thicken
    // a touch; SWAT still held back for the next section.
    spawnInterval: 1.3,
    enemyTypes: ['ram', 'shooter', 'enforcer', 'armored'],
    enemyTypeWeights: [5, 3, 2, 0],
    civilianChance: 0.75,
    civilianSpawnInterval: 2.0,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
    shooterBurstChance: 0.20,
    formationChance: 0.13,
  },
  roadGeometry: new WidthChangeGeometry([
    { worldY:    0, xMin: 160, xMax: 640, laneCount: 4 }, // wide entry
    { worldY: 2200, xMin: 160, xMax: 640, laneCount: 4 }, // first taper begins
    { worldY: 2400, xMin: 220, xMax: 580, laneCount: 3 }, // first narrow stretch
    { worldY: 3000, xMin: 220, xMax: 580, laneCount: 3 }, // first taper-out begins
    { worldY: 3200, xMin: 160, xMax: 640, laneCount: 4 }, // back to full width
    { worldY: 5500, xMin: 160, xMax: 640, laneCount: 4 }, // second taper begins
    { worldY: 5700, xMin: 220, xMax: 580, laneCount: 3 }, // second narrow stretch
    { worldY: 6300, xMin: 220, xMax: 580, laneCount: 3 }, // second taper-out begins
    { worldY: 6500, xMin: 160, xMax: 640, laneCount: 4 }, // back to full width
    { worldY: 8000, xMin: 160, xMax: 640, laneCount: 4 }, // section end
  ]),
  // v10 — sharp mountain switchbacks. Two long curves placed in the wider
  // open stretches between the chokepoints (gaps at 0–2200 and 3200–5500).
  // The 6500–8000 stretch is too short for a 4-sec hold so the third curve
  // got dropped in favor of letting the longer two breathe. Magnitudes
  // 110 / 120 — the loop's biggest bears, fitting the switchback identity.
  // Holds are ~1500 worldY (~4.2 sec).
  roadCurve: [
    { worldY:    0, offset:    0 },
    { worldY:  200, offset:    0 },
    { worldY:  400, offset: -110 },
    { worldY: 1900, offset: -110 },
    { worldY: 2100, offset:    0 }, // exit before chokepoint taper at 2200
    { worldY: 3300, offset:    0 }, // post-chokepoint at 3200
    { worldY: 3500, offset:  120 },
    { worldY: 5000, offset:  120 },
    { worldY: 5200, offset:    0 }, // exit before chokepoint taper at 5500
    { worldY: 8000, offset:    0 },
  ],
  // First explicit music swap of the loop — mountain pressure suits a tenser bed.
  musicTrack: 'epic_tension',
};

// === Section 5 — sunset coast, balanced mid-late mix. ===
// v6 — first FORK section. The road splits in half mid-section (the coastal
// road parts around an island), forcing the player to commit to a side. Each
// segment is 200px wide with 2 lanes. Touching keyframes at the entry/exit
// (divider width 0) keep the transition smooth — the divider then opens up to
// 80px wide for the sustained fork stretch. Hitting the divider chips HP
// (barrier_collision damage cause).
const SUNSET_COAST: SectionDef = {
  id: 'sunset-coast',
  name: 'SUNSET COAST',
  subtitle: 'Coastal blitz · Threats stack',
  lengthMeters: 8000,
  palette: {
    roadColor: '#2a1030',
    roadShadeColor: '#1a0820',
    edgeColor: '#FFAA00',
    edgeGlowColor: '#FF5555',
    laneLineColor: '#FFE066',
    centerLineColor: '#FFFFFF',
    grassTop: '#FF1F8F',
    grassBottom: '#3D0830',
    horizonColor: '#FFAA00',
    horizonAlpha: 0.45, // big sunset glow
    sceneryStyle: 'coast',
    sceneryColor: '#1A0628',
    sceneryAccent: '#FFAA00',
    sceneryRimColor: '#FF5555',
    postColor: '#FFAA00',
    postAccent: '#FF1F8F',
    bannerColor: '#FFAA00',
    bannerGlow: '#FF5555',
  },
  spawnerConfig: {
    // No longer the finale (v4 had this as the last "no mercy" stretch).
    // Now the late-mid step: balanced four-type mix with a clear bump in
    // burst/formation pressure. SWAT debuts here, sparingly — the unbumpable
    // missile-only threat appears once enforcers are well-established.
    spawnInterval: 1.15,
    enemyTypes: ['ram', 'shooter', 'enforcer', 'armored'],
    enemyTypeWeights: [4, 4, 3, 1],
    civilianChance: 0.6,
    civilianSpawnInterval: 2.0,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
    shooterBurstChance: 0.28,
    formationChance: 0.18,
  },
  roadGeometry: new ForkGeometry([
    // Pre-fork: single road, two segments touching at the center so geometry
    // reads as one piece. (ForkGeometry requires a constant segment count
    // across keyframes — we pretend the divider is always there with width 0
    // outside the fork.)
    { worldY:    0, segments: [
      { xMin: 160, xMax: 400, laneCount: 2 },
      { xMin: 400, xMax: 640, laneCount: 2 },
    ]},
    { worldY: 3000, segments: [
      { xMin: 160, xMax: 400, laneCount: 2 },
      { xMin: 400, xMax: 640, laneCount: 2 },
    ]},
    // Fork opens: divider grows from 0 to 80 over 200 worldY units.
    { worldY: 3200, segments: [
      { xMin: 160, xMax: 360, laneCount: 2 },
      { xMin: 440, xMax: 640, laneCount: 2 },
    ]},
    // Sustain: 2-lane sides, 80px divider.
    { worldY: 5000, segments: [
      { xMin: 160, xMax: 360, laneCount: 2 },
      { xMin: 440, xMax: 640, laneCount: 2 },
    ]},
    // Merge: divider shrinks back to 0.
    { worldY: 5200, segments: [
      { xMin: 160, xMax: 400, laneCount: 2 },
      { xMin: 400, xMax: 640, laneCount: 2 },
    ]},
    // Post-fork: single road again (touching segments).
    { worldY: 8000, segments: [
      { xMin: 160, xMax: 400, laneCount: 2 },
      { xMin: 400, xMax: 640, laneCount: 2 },
    ]},
  ]),
  // v10 — coastal sweepers framing the central fork. Curves only in pre-fork
  // (0–3000) and post-fork (5200–8000) stretches; the fork itself stays
  // straight so the "commit to a side" decision isn't muddied by lateral
  // shift. ForkGeometry would bend both segments together if asked, but
  // visually it's busier than the section needs.
  roadCurve: [
    { worldY:    0, offset:    0 },
    { worldY:  700, offset:    0 },
    { worldY:  900, offset:  100 },
    { worldY: 2700, offset:  100 },
    { worldY: 2900, offset:    0 }, // straight before fork open at 3200
    { worldY: 5300, offset:    0 }, // straight after fork close at 5200
    { worldY: 5500, offset: -100 },
    { worldY: 7300, offset: -100 },
    { worldY: 7500, offset:    0 },
    { worldY: 8000, offset:    0 },
  ],
  // Sunset coast leans into the cinematic horizon glow — heroic bed.
  musicTrack: 'epic_heroic',
};

// === Section 6 — harbor run on water. Calm aquatic intro, patrol-led. ===
// v8 — Aquatic arc expansion. Harbor Run was previously cramming all 7 enemy
// types (ram, shooter, enforcer, armored, patrol, dropper, strafer) into a
// single 7000-unit section, which read as chaotic noise once lap-scaling
// tightened spawn cadence. The aquatic stretch now spans three sections:
// HARBOR_RUN (calm patrol intro) → OPEN_SEA (strafer peak with time-of-day
// crossfade) → CHANNEL (dropper-led chokepoint finale). Each carries a focused
// 3–4 type mix and one signature feature.
const HARBOR_RUN: SectionDef = {
  id: 'harbor-run',
  name: 'HARBOR RUN',
  subtitle: 'Working harbor · Patrol lanes',
  lengthMeters: 6000,
  terrain: 'water',
  palette: {
    roadColor: '#0a3a5a',
    roadShadeColor: '#03203a',
    edgeColor: '#22F0FF',
    edgeGlowColor: '#22F0FF',
    laneLineColor: '#FFFFFF',
    centerLineColor: '#FFE066',
    grassTop: '#001428',
    grassBottom: '#003858',
    horizonColor: '#22F0FF',
    horizonAlpha: 0.30,
    sceneryStyle: 'water',
    sceneryColor: '#0a4a72',
    sceneryAccent: '#88FFFF',
    sceneryRimColor: '#1a6a92',
    postColor: '#FFE066',
    postAccent: '#22F0FF',
    bannerColor: '#22F0FF',
    bannerGlow: '#88FFFF',
  },
  spawnerConfig: {
    // Calm aquatic intro. Patrol AI is the headliner; ram + shooter give
    // continuity from §5's car mix while the player learns the floatier
    // water handling. Aggressive aquatic types (strafer, dropper) and the
    // armored gunship are deferred to OPEN_SEA / CHANNEL.
    spawnInterval: 1.15,
    enemyTypes: ['ram', 'shooter', 'patrol'],
    enemyTypeWeights: [3, 2, 5],
    civilianChance: 0.55,
    civilianSpawnInterval: 2.1,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
    enemyVisual: 'jetboat',
    shooterBurstChance: 0.20,
    formationChance: 0.14,
  },
  // 50px wooden boardwalks / floating pontoons either side. Tactical hop-out
  // option in the calm aquatic stretch; existing v6 shoulder modifier handles
  // the sluggish handling without per-section work.
  roadGeometry: new ShoulderedRoadGeometry(160, 640, 4, 50),
  // Back half of the section crossfades into a working-harbor look — concrete
  // pier walls, sodium-amber lighting. Reuses the v7 STEEL_SPAN pattern.
  paletteOverrides: [
    {
      startWorldY: 2200,
      endWorldY: 5800,
      fadeLength: 300,
      palette: {
        roadColor: '#0a3050',
        roadShadeColor: '#031a30',
        edgeColor: '#FFB840',
        edgeGlowColor: '#FFB840',
        laneLineColor: '#FFE9B0',
        sceneryColor: '#1f3a5a',
        sceneryAccent: '#FFB840',
        sceneryRimColor: '#3a5a7a',
        postColor: '#FFB840',
        postAccent: '#FFE9B0',
      },
    },
  ],
  // v10 — gentle harbor sweepers, scaled to the calmer aquatic intro. Two
  // bears (left then right), magnitudes 70 / 80. Boardwalk shoulders catch
  // the player if they miss the cue. Holds are ~1500 worldY (~4.2 sec).
  roadCurve: [
    { worldY:    0, offset:   0 },
    { worldY:  200, offset:   0 },
    { worldY:  400, offset: -70 },
    { worldY: 1900, offset: -70 },
    { worldY: 2100, offset:   0 },
    { worldY: 3000, offset:   0 },
    { worldY: 3200, offset:  80 },
    { worldY: 4700, offset:  80 },
    { worldY: 4900, offset:   0 },
    { worldY: 6000, offset:   0 },
  ],
  // Calm aquatic intro — drops the tension, leans on chill water atmosphere.
  // OPEN_SEA inherits this so the cinematic dawn→day fade plays over the same
  // chill bed; the visual carries the drama, not the music.
  musicTrack: 'casual_chill',
};

// === Section 7 — open sea. Strafer-led peak with dawn → day palette crossfade. ===
// v8 — Middle of the aquatic arc. No road geometry feature; the dramatic moment
// is a two-zone palette crossfade that takes the section from a coral/peach
// dawn to a saturated cyan high-day. Base palette is set to mid-tones so the
// crossfade midpoint lands on intentional colors instead of muddy interpolation
// (sidesteps the v7 RGB-lerp gotcha). horizonAlpha is intentionally NOT
// crossfaded — PaletteOverrideZone is string-color only by design, and the
// numeric horizon glow strength stays on the base palette.
const OPEN_SEA: SectionDef = {
  id: 'open-sea',
  name: 'OPEN SEA',
  subtitle: 'Dawn to day · Open water',
  lengthMeters: 7000,
  terrain: 'water',
  palette: {
    // Mid-tone "transition" palette — what shows between the two override
    // zones at full crossfade. Set deliberately so neither zone has to fight
    // a base color that contradicts its mood.
    roadColor: '#0a6090',
    roadShadeColor: '#053048',
    edgeColor: '#88E0FF',
    edgeGlowColor: '#88E0FF',
    laneLineColor: '#FFFFFF',
    centerLineColor: '#FFE066',
    grassTop: '#003860',
    grassBottom: '#0070A0',
    horizonColor: '#FFCC88',
    horizonAlpha: 0.30,
    sceneryStyle: 'water',
    sceneryColor: '#0a6090',
    sceneryAccent: '#88FFFF',
    sceneryRimColor: '#1a80B0',
    postColor: '#FFFFFF',
    postAccent: '#88E0FF',
    bannerColor: '#88E0FF',
    bannerGlow: '#88FFFF',
  },
  spawnerConfig: {
    // Strafer-led aquatic peak. Open water with no edges to hide behind suits
    // strafer's aim-lead bursts and patrol's sine weave. Dropper appears
    // sparingly here as foreshadowing for CHANNEL where it headlines.
    spawnInterval: 1.05,
    enemyTypes: ['patrol', 'strafer', 'shooter', 'dropper'],
    enemyTypeWeights: [3, 5, 2, 2],
    civilianChance: 0.50,
    civilianSpawnInterval: 2.2,
    vanIntervalMin: 18,
    vanIntervalMax: 24,
    enemyVisual: 'jetboat',
    shooterBurstChance: 0.30,
    formationChance: 0.20,
  },
  paletteOverrides: [
    // Zone A — dawn. Strong at section entry, fades out toward midpoint.
    {
      startWorldY: 0,
      endWorldY: 3500,
      fadeLength: 600,
      palette: {
        roadColor: '#0a4a6a',
        roadShadeColor: '#04283a',
        edgeColor: '#FFAA66',
        edgeGlowColor: '#FF8866',
        laneLineColor: '#FFE0B0',
        grassTop: '#4a1a2a',
        grassBottom: '#28284a',
        horizonColor: '#FF8866',
        sceneryColor: '#2a3a5a',
        sceneryAccent: '#FFAA66',
        sceneryRimColor: '#FF6666',
        postColor: '#FFAA66',
        postAccent: '#FFE0B0',
        bannerColor: '#FFAA66',
        bannerGlow: '#FF8866',
      },
    },
    // Zone B — high day. Fades in past midpoint, full strength at exit.
    {
      startWorldY: 3500,
      endWorldY: 7000,
      fadeLength: 600,
      palette: {
        roadColor: '#0888B8',
        roadShadeColor: '#05607F',
        edgeColor: '#FFFFFF',
        edgeGlowColor: '#88FFFF',
        laneLineColor: '#FFFFFF',
        centerLineColor: '#FFE9B0',
        grassTop: '#0070A8',
        grassBottom: '#00B0E0',
        horizonColor: '#FFFFFF',
        sceneryColor: '#0a8ac8',
        sceneryAccent: '#FFFFFF',
        sceneryRimColor: '#88FFFF',
        postColor: '#FFFFFF',
        postAccent: '#88FFFF',
        bannerColor: '#88FFFF',
        bannerGlow: '#FFFFFF',
      },
    },
  ],
  // v10 — the most "open road" feel of the loop. Two long sweepers, one
  // each direction, aligned roughly with the dawn→day palette transition at
  // 3500. Magnitude 100 over long holds (~2300 worldY each).
  roadCurve: [
    { worldY:    0, offset:    0 },
    { worldY:  600, offset:    0 },
    { worldY:  900, offset:  100 },
    { worldY: 3200, offset:  100 },
    { worldY: 3400, offset:    0 },
    { worldY: 3700, offset:    0 },
    { worldY: 4000, offset: -100 },
    { worldY: 6500, offset: -100 },
    { worldY: 6800, offset:    0 },
    { worldY: 7000, offset:    0 },
  ],
};

// === Section 8 — channel. Dropper showcase, industrial canal with chokepoints. ===
// v8 — Aquatic finale. Mirrors ALPINE_PASS's WidthChangeGeometry pattern with
// two narrow lock segments (4-lane → 2-lane). Depth charges in 4-lane water are
// dodgeable; in 2-lane water they're a real threat. That's the signature
// gameplay payoff for the aquatic arc — droppers were teased in OPEN_SEA, here
// they take center stage with the chokepoints amplifying their pressure.
const CHANNEL: SectionDef = {
  id: 'channel',
  name: 'CHANNEL',
  subtitle: 'Lock channels · Depth charges',
  lengthMeters: 6000,
  terrain: 'water',
  palette: {
    roadColor: '#2a3a48',
    roadShadeColor: '#162028',
    edgeColor: '#FFC840',
    edgeGlowColor: '#FFC840',
    laneLineColor: '#FFFFFF',
    centerLineColor: '#FFE066',
    grassTop: '#0a1418',
    grassBottom: '#1a2830',
    horizonColor: '#FFC840',
    horizonAlpha: 0.22,
    sceneryStyle: 'water',
    sceneryColor: '#3a4a58',
    sceneryAccent: '#FFC840',
    sceneryRimColor: '#5a6a78',
    postColor: '#FFC840',
    postAccent: '#FFFFFF',
    bannerColor: '#FFC840',
    bannerGlow: '#FFFFFF',
  },
  spawnerConfig: {
    // Aquatic finale. Dropper headlines — depth charges in narrow lock
    // segments are the gameplay payoff. Enforcer returns as armor pressure
    // since chokepoints make bumping mandatory. Strafer carries through from
    // OPEN_SEA. Patrol drops out to keep the cast tight.
    spawnInterval: 0.98,
    enemyTypes: ['ram', 'enforcer', 'dropper', 'strafer'],
    enemyTypeWeights: [2, 2, 5, 3],
    civilianChance: 0.55,
    civilianSpawnInterval: 2.0,
    vanIntervalMin: 14,
    vanIntervalMax: 20,
    enemyVisual: 'jetboat',
    shooterBurstChance: 0.36,
    formationChance: 0.25,
  },
  // Two narrow lock segments mirror the ALPINE_PASS chokepoint pattern. Each
  // narrow stretch is 600 worldY long — long enough that a dropper releasing a
  // depth charge inside the lock leaves the player navigating detonation while
  // still in the 2-lane corridor.
  roadGeometry: new WidthChangeGeometry([
    { worldY:    0, xMin: 160, xMax: 640, laneCount: 4 },
    { worldY: 1600, xMin: 160, xMax: 640, laneCount: 4 },
    { worldY: 1800, xMin: 240, xMax: 560, laneCount: 2 },
    { worldY: 2400, xMin: 240, xMax: 560, laneCount: 2 },
    { worldY: 2600, xMin: 160, xMax: 640, laneCount: 4 },
    { worldY: 3800, xMin: 160, xMax: 640, laneCount: 4 },
    { worldY: 4000, xMin: 240, xMax: 560, laneCount: 2 },
    { worldY: 4600, xMin: 240, xMax: 560, laneCount: 2 },
    { worldY: 4800, xMin: 160, xMax: 640, laneCount: 4 },
    { worldY: 6000, xMin: 160, xMax: 640, laneCount: 4 },
  ]),
  // v10 — two long bears in the wider open stretches around the lock
  // chokepoints. The middle stretch (2600–3800) is dropped to give the
  // remaining two room to sustain. The 0–1600 and 4800–6000 stretches are
  // each only 1200–1600 worldY long, so holds settle for ~3 sec rather than
  // the 4-sec target — chokepoint geometry dominates the section's identity
  // and the curves act as accents. Curves still clear the narrow corridors
  // (1800–2400 and 4000–4600) so depth-charge navigation isn't compounded
  // by lateral shift. Magnitudes 80 / 80.
  roadCurve: [
    { worldY:    0, offset:   0 },
    { worldY:  100, offset:   0 },
    { worldY:  300, offset: -80 },
    { worldY: 1400, offset: -80 },
    { worldY: 1500, offset:   0 }, // exit before lock taper at 1600
    { worldY: 4800, offset:   0 }, // post-lock at 4800
    { worldY: 5000, offset:  80 },
    { worldY: 5800, offset:  80 },
    { worldY: 6000, offset:   0 },
  ],
  // Aquatic finale — chokepoint pressure swaps the chill bed for intensity.
  musicTrack: 'action_intense',
};

// === Section 7 — frost pass. Slippy ice, reduced traction, snowfall. ===
const FROST_PASS: SectionDef = {
  id: 'frost-pass',
  name: 'FROST PASS',
  subtitle: 'Black ice · Final stretch',
  lengthMeters: 7000,
  terrain: 'ice',
  weather: 'snow',
  palette: {
    roadColor: '#3a4a6a',
    roadShadeColor: '#1f2a40',
    edgeColor: '#A8E6FF',
    edgeGlowColor: '#A8E6FF',
    laneLineColor: '#FFFFFF',
    centerLineColor: '#88E5FF',
    grassTop: '#0a1a2a',
    grassBottom: '#1a2a40',
    horizonColor: '#A8E6FF',
    horizonAlpha: 0.28,
    sceneryStyle: 'ice',
    sceneryColor: '#88B0E0',
    sceneryAccent: '#FFFFFF',
    sceneryRimColor: '#C0D8F0',
    postColor: '#A8E6FF',
    postAccent: '#FFFFFF',
    bannerColor: '#A8E6FF',
    bannerGlow: '#FFFFFF',
  },
  spawnerConfig: {
    // True finale of the loop. Fastest spawns, highest burst + formation
    // rolls, mixed four-type weighting. Loop scaling stacks on top: by
    // loop 3+ the burst/formation clamps engage and the spawn floor (0.6s)
    // is approached around loop 5–6, which is intentional. SWAT stays rare
    // even at peak — enforcers carry most of the armored pressure.
    spawnInterval: 0.95,
    enemyTypes: ['ram', 'shooter', 'enforcer', 'armored'],
    enemyTypeWeights: [4, 4, 3, 1],
    civilianChance: 0.65,
    civilianSpawnInterval: 1.9,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
    shooterBurstChance: 0.40,
    formationChance: 0.28,
  },
  // v10 — moderate curves, long-held. Ice already cuts steerMul to 0.55, so
  // 90px magnitudes with sustained holds (~2000 worldY each) stay challenging
  // without becoming punishing. Two bears: left then right.
  roadCurve: [
    { worldY:    0, offset:   0 },
    { worldY:  500, offset:   0 },
    { worldY:  700, offset: -90 },
    { worldY: 2700, offset: -90 },
    { worldY: 2900, offset:   0 },
    { worldY: 4500, offset:   0 },
    { worldY: 4700, offset:  90 },
    { worldY: 6500, offset:  90 },
    { worldY: 6700, offset:   0 },
    { worldY: 7000, offset:   0 },
  ],
  // Final road sprint — competitive sports bed (also speed-racer's secondary).
  musicTrack: 'sports_competitive',
};

// Section order. Difficulty ramps monotonically §1 → §9. Game loops back to
// index 0 after the last; lap scaling in SpeedRacerGame.applyLapScaling()
// tightens spawnInterval and burst/formation chances each wraparound.
// v8 — aquatic arc spans §6 → §8 (HARBOR_RUN, OPEN_SEA, CHANNEL); FROST_PASS
// shifts §7 → §9 as the road-finale of the loop.
export const SECTIONS: readonly SectionDef[] = [
  NEON_HIGHWAY,
  NEON_CITY,
  STEEL_SPAN,
  ALPINE_PASS,
  SUNSET_COAST,
  HARBOR_RUN,
  OPEN_SEA,
  CHANNEL,
  FROST_PASS,
];

export function getSection(index: number): SectionDef {
  const i = ((index % SECTIONS.length) + SECTIONS.length) % SECTIONS.length;
  return SECTIONS[i];
}
