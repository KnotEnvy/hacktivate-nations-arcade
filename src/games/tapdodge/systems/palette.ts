// ===== src/games/tapdodge/systems/palette.ts =====
//
// Tap Dodge's own colours. The platform owns exactly two meanings — amber is
// currency, red is a problem — so neither appears here as decoration. The
// zones run cool (cyan, periwinkle, mint, ice) and the hazards run hot pink,
// which is also the colour a RUSH floods the rails with: in this game pink
// means heat.

export type SceneryKind = 'clouds' | 'towers' | 'canyon' | 'storm';

export interface ZoneStyle {
  /** Display name, painted on the road and flipped onto the gantry. */
  name: string;
  scenery: SceneryKind;
  /** Rails, gantry strip, zone chip. */
  accent: string;
  /** Top and bottom of the deep background gradient. */
  skyTop: string;
  skyBottom: string;
  /** The road surface laid over the gradient. */
  road: string;
  /** Scenery silhouettes, far and near tone. */
  far: string;
  near: string;
  /** Tiny detail on the scenery (window lights, rain, strata). */
  detail: string;
}

export const ZONES: readonly ZoneStyle[] = [
  {
    name: 'CLOUD DECK',
    scenery: 'clouds',
    accent: '#45e3ff',
    skyTop: '#06142b',
    skyBottom: '#0c2447',
    road: '#0a1428',
    far: '#12294b',
    near: '#1a3a66',
    detail: '#8fc7f0',
  },
  {
    name: 'TOWER ROW',
    scenery: 'towers',
    accent: '#8894ff',
    skyTop: '#0a0a22',
    skyBottom: '#15133a',
    road: '#0d0c24',
    far: '#1c1a45',
    near: '#2a2760',
    detail: '#b9c6ff',
  },
  {
    name: 'DEEP CANYON',
    scenery: 'canyon',
    accent: '#5ef0b0',
    skyTop: '#06161a',
    skyBottom: '#0d2627',
    road: '#081618',
    far: '#153633',
    near: '#214a44',
    detail: '#6fae9a',
  },
  {
    name: 'STORMWALL',
    scenery: 'storm',
    accent: '#d6e2ff',
    skyTop: '#07090f',
    skyBottom: '#121724',
    road: '#0a0d15',
    far: '#1a2030',
    near: '#262e44',
    detail: '#8793b3',
  },
];

/** Hazards: dark bodies, one hot-pink signal colour. */
export const HAZARD = {
  body: '#1c1226',
  bodyLight: '#2c1c3a',
  signal: '#ff4fa0',
  signalSoft: '#ff8cc6',
  steel: '#262b3d',
  steelLight: '#3a415a',
} as const;

/** The colour the rails turn during a RUSH. */
export const RUSH_HOT = '#ff4fa0';

/** The ship: a pale hull with an ice cockpit, constant across zones. */
export const SHIP = {
  hull: '#e9f0ff',
  hullShade: '#9aa8c8',
  outline: '#ffffff',
  cockpit: '#62e6ff',
  flame: '#8cf5ff',
  glow: '#62e6ff',
} as const;

/** Gems are the only violet thing on the road. */
export const GEM = {
  base: '#9b6bff',
  light: '#d2bcff',
  dark: '#5b33b8',
} as const;

/** Fever heat ramp: steel, cyan, violet, pink, hot pink. */
export const FEVER_COLORS = [
  '#8fa3c7',
  '#6fe8ff',
  '#a38bff',
  '#ff8ad0',
  '#ff4fa0',
] as const;
