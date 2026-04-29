// Speed Racer — Section definitions.
// Each section is a themed stretch of road with its own palette,
// scenery style, and spawner difficulty. Sections cycle in order;
// after the last one, progression loops back to the first.

import type { SpawnerOptions } from '../systems/EnemySpawner';
import type { RoadGeometry } from '../systems/RoadProfile';
import { WidthChangeGeometry } from '../systems/RoadGeometries';

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
    // Penultimate stretch. Patrol identity preserved (still patrol-heavy
    // weight). Spawn cadence used to be 1.5s in v4 — slower than §5's 1.05
    // — which broke the curve. Now tightened to 1.05 with stronger burst
    // + formation rolls so water genuinely raises the bar. Enforcer cruisers
    // take most of the "armored slot"; SWAT gunship stays rare.
    spawnInterval: 1.05,
    enemyTypes: ['ram', 'shooter', 'enforcer', 'armored', 'patrol'],
    enemyTypeWeights: [4, 3, 2, 1, 5],
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
