// Speed Racer — Section definitions.
// Each section is a themed stretch of road with its own palette,
// scenery style, and spawner difficulty. Sections cycle in order;
// after the last one, progression loops back to the first.

import type { SpawnerOptions } from '../systems/EnemySpawner';

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
    spawnInterval: 1.6,
    enemyTypes: ['ram', 'shooter', 'armored'],
    enemyTypeWeights: [6, 2, 0], // no armored in intro
    civilianChance: 0.55,
    civilianSpawnInterval: 2.6,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
  },
};

// === Section 2 — urban shooters, occasional armored. ===
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
    spawnInterval: 1.4,
    enemyTypes: ['ram', 'shooter', 'armored'],
    enemyTypeWeights: [5, 4, 1],
    civilianChance: 0.65,
    civilianSpawnInterval: 2.3,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
  },
};

// === Section 3 — armored gauntlet over open water. Use missiles. ===
const STEEL_SPAN: SectionDef = {
  id: 'steel-span',
  name: 'STEEL SPAN',
  subtitle: 'Suspension bridge · Bring missiles',
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
    spawnInterval: 1.3,
    enemyTypes: ['ram', 'shooter', 'armored'],
    enemyTypeWeights: [4, 3, 5], // armored-heavy
    civilianChance: 0.45, // sparse traffic on the bridge
    civilianSpawnInterval: 2.7,
    vanIntervalMin: 14, // generous van cadence — you need missiles
    vanIntervalMax: 20,
  },
};

// === Section 4 — alpine pass, dodge focus, civilian-heavy. ===
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
    spawnInterval: 1.2,
    enemyTypes: ['ram', 'shooter', 'armored'],
    enemyTypeWeights: [7, 2, 1], // ram-focused, fewer ranged
    civilianChance: 0.85, // dodge city
    civilianSpawnInterval: 1.7,
    vanIntervalMin: 18,
    vanIntervalMax: 26,
  },
};

// === Section 5 — finale: sunset coast, mixed maximum threat. ===
const SUNSET_COAST: SectionDef = {
  id: 'sunset-coast',
  name: 'SUNSET COAST',
  subtitle: 'Final stretch · No mercy',
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
    spawnInterval: 1.05,
    enemyTypes: ['ram', 'shooter', 'armored'],
    enemyTypeWeights: [6, 5, 3],
    civilianChance: 0.65,
    civilianSpawnInterval: 2.0,
    vanIntervalMin: 16,
    vanIntervalMax: 22,
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
    spawnInterval: 1.5,
    enemyTypes: ['ram', 'shooter', 'armored', 'patrol'],
    enemyTypeWeights: [4, 2, 1, 5], // patrol-heavy on water
    civilianChance: 0.5,
    civilianSpawnInterval: 2.4,
    vanIntervalMin: 17,
    vanIntervalMax: 24,
    enemyVisual: 'jetboat',
  },
};

// === Section 7 — frost pass. Slippy ice, reduced traction, snowfall. ===
const FROST_PASS: SectionDef = {
  id: 'frost-pass',
  name: 'FROST PASS',
  subtitle: 'Black ice · Brake gently',
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
    spawnInterval: 1.5,
    enemyTypes: ['ram', 'shooter', 'armored'],
    enemyTypeWeights: [7, 2, 1],
    civilianChance: 0.6,
    civilianSpawnInterval: 2.2,
    vanIntervalMin: 18,
    vanIntervalMax: 26,
  },
};

// Section order. Game loops back to index 0 after the last (with same difficulty).
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
