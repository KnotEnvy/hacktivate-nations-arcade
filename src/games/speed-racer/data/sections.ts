// Speed Racer — Section definitions.
// Each section is a themed stretch of road with its own palette,
// scenery style, and spawner difficulty. Sections cycle in order;
// after the last one, progression loops back to the first.

import type { SpawnerOptions } from '../systems/EnemySpawner';
import type { RoadGeometry } from '../systems/RoadProfile';
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
};

// === Section 6 — harbor run on water. Lighter steering, jet-boat enemies. ===
const HARBOR_RUN: SectionDef = {
  id: 'harbor-run',
  name: 'HARBOR RUN',
  subtitle: 'Jet-boat lanes · Floaty handling',
  lengthMeters: 7000,
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
    // Penultimate stretch. Patrol identity preserved. v7 introduces the
    // aquatic-specific threats — droppers (depth charges) and strafers
    // (weaving shooters) — that lean into the section's water identity
    // instead of just reskinning road enemies. Patrol weight dropped to
    // make room; ram weight trimmed slightly so the section feels more
    // distinctly aquatic vs §5/§7's car mixes. SWAT gunship stays rare.
    spawnInterval: 1.05,
    enemyTypes: ['ram', 'shooter', 'enforcer', 'armored', 'patrol', 'dropper', 'strafer'],
    enemyTypeWeights: [3, 2, 2, 1, 4, 3, 3],
    civilianChance: 0.55,
    civilianSpawnInterval: 2.1,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
    enemyVisual: 'jetboat',
    shooterBurstChance: 0.32,
    formationChance: 0.22,
  },
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
};

// Section order. Difficulty ramps monotonically §1 → §7. Game loops back to
// index 0 after the last; lap scaling in SpeedRacerGame.applyLapScaling()
// tightens spawnInterval and burst/formation chances each wraparound.
export const SECTIONS: readonly SectionDef[] = [
  NEON_HIGHWAY,
  NEON_CITY,
  STEEL_SPAN,
  ALPINE_PASS,
  SUNSET_COAST,
  HARBOR_RUN,
  FROST_PASS,
];

export function getSection(index: number): SectionDef {
  const i = ((index % SECTIONS.length) + SECTIONS.length) % SECTIONS.length;
  return SECTIONS[i];
}
