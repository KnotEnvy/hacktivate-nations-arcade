// ===== src/games/runner/systems/EnvironmentSystem.ts =====

export type EnvironmentTheme = 'day' | 'sunset' | 'night' | 'desert' | 'forest';

/** What sits in the sky, and how the far layers are lit. */
export type CelestialKind = 'sun' | 'setting-sun' | 'moon' | 'white-sun' | 'shafts';

/** The drifting motes that give each theme its air. */
export type AmbientKind = 'pollen' | 'embers' | 'fireflies' | 'sand' | 'leaves';

/** The silhouette family the far layer draws. */
export type SkylineKind = 'peaks' | 'crags' | 'city' | 'dunes' | 'canopy';

export interface GradientStop {
  at: number;
  color: string;
}

export interface ThemePalette {
  id: EnvironmentTheme;
  /** Shown to the player on the stage banner. */
  name: string;
  /** Sky gradient, top to horizon. */
  sky: GradientStop[];
  /** The horizon colour distant geometry fades into — the depth cue. */
  haze: string;
  celestial: CelestialKind;
  skyline: SkylineKind;
  /** Far → near silhouette bands. Each should be darker than the last. */
  ridgeFar: string;
  ridgeMid: string;
  ridgeNear: string;
  /** Vegetation / structure colours for the mid and near layers. */
  foliageDark: string;
  foliageMid: string;
  foliageLight: string;
  trunk: string;
  /** The playfield floor. */
  groundTop: string;
  groundBody: string;
  groundDeep: string;
  groundLine: string;
  grass: string;
  grassDry: string;
  /** Cloud body and underside. */
  cloudLight: string;
  cloudShadow: string;
  cloudAlpha: number;
  ambient: AmbientKind;
  /** A wash laid over the world so entities sit in the same light. */
  ambientLight: string;
  ambientLightAlpha: number;
  /** Drives HUD tints and stage banners. */
  accent: string;
  accentDim: string;
}

const PALETTES: Record<EnvironmentTheme, ThemePalette> = {
  day: {
    id: 'day',
    name: 'Meadow Run',
    sky: [
      { at: 0, color: '#2E7FC4' },
      { at: 0.45, color: '#6FBBE8' },
      { at: 0.8, color: '#A9DCF5' },
      { at: 1, color: '#D8F0FB' },
    ],
    haze: 'rgba(216, 240, 251, 1)',
    celestial: 'sun',
    skyline: 'peaks',
    ridgeFar: '#9FC3DA',
    ridgeMid: '#7FA8C4',
    ridgeNear: '#5E86A4',
    foliageDark: '#2F7A45',
    foliageMid: '#48A05A',
    foliageLight: '#6FC46F',
    trunk: '#7A5537',
    groundTop: '#5EA84F',
    groundBody: '#8A6742',
    groundDeep: '#5F462C',
    groundLine: '#3E7E38',
    grass: '#66BE55',
    grassDry: '#9FBF52',
    cloudLight: '#FFFFFF',
    cloudShadow: '#C9DEEC',
    cloudAlpha: 0.9,
    ambient: 'pollen',
    ambientLight: '#FFF3C4',
    ambientLightAlpha: 0.05,
    accent: '#38BDF8',
    accentDim: '#0E7490',
  },
  sunset: {
    id: 'sunset',
    name: 'Ember Coast',
    sky: [
      { at: 0, color: '#1E1246' },
      { at: 0.35, color: '#6C2C67' },
      { at: 0.62, color: '#C4485C' },
      { at: 0.84, color: '#EE7F45' },
      { at: 1, color: '#FFC46B' },
    ],
    haze: 'rgba(255, 196, 107, 1)',
    celestial: 'setting-sun',
    skyline: 'crags',
    ridgeFar: '#A8607A',
    ridgeMid: '#6E3A5E',
    ridgeNear: '#3E2143',
    foliageDark: '#2A1430',
    foliageMid: '#5B2C43',
    foliageLight: '#8E4753',
    trunk: '#2E1726',
    groundTop: '#7C4438',
    groundBody: '#50292A',
    groundDeep: '#33191D',
    groundLine: '#9A5740',
    grass: '#8A5540',
    grassDry: '#B0714A',
    cloudLight: '#FFC08A',
    cloudShadow: '#A85273',
    cloudAlpha: 0.85,
    ambient: 'embers',
    ambientLight: '#FF9A4D',
    ambientLightAlpha: 0.1,
    accent: '#FB923C',
    accentDim: '#9A3412',
  },
  night: {
    id: 'night',
    name: 'Neon Skyline',
    sky: [
      { at: 0, color: '#05071A' },
      { at: 0.4, color: '#0D1738' },
      { at: 0.72, color: '#1C2C5A' },
      { at: 1, color: '#33477E' },
    ],
    haze: 'rgba(51, 71, 126, 1)',
    celestial: 'moon',
    skyline: 'city',
    ridgeFar: '#1E2A52',
    ridgeMid: '#141D3C',
    ridgeNear: '#0B1129',
    foliageDark: '#0A1226',
    foliageMid: '#16234A',
    foliageLight: '#27386B',
    trunk: '#10172E',
    groundTop: '#2A3560',
    groundBody: '#181F3C',
    groundDeep: '#0A0E20',
    groundLine: '#5C7BD6',
    grass: '#2C4A6B',
    grassDry: '#3A4E78',
    cloudLight: '#3A4A7C',
    cloudShadow: '#1B2547',
    cloudAlpha: 0.55,
    ambient: 'fireflies',
    ambientLight: '#4C6BD6',
    ambientLightAlpha: 0.14,
    accent: '#A78BFA',
    accentDim: '#5B21B6',
  },
  desert: {
    id: 'desert',
    name: 'Dune Sea',
    sky: [
      { at: 0, color: '#3E86B8' },
      { at: 0.42, color: '#8CB4C4' },
      { at: 0.74, color: '#D7C79A' },
      { at: 1, color: '#F3DDA8' },
    ],
    haze: 'rgba(243, 221, 168, 1)',
    celestial: 'white-sun',
    skyline: 'dunes',
    ridgeFar: '#E6CE9C',
    ridgeMid: '#D4AF74',
    ridgeNear: '#BC8D53',
    foliageDark: '#7A8A3E',
    foliageMid: '#9CAA53',
    foliageLight: '#C8CE7A',
    trunk: '#9A7A4A',
    groundTop: '#D3A059',
    groundBody: '#A9763F',
    groundDeep: '#734E28',
    groundLine: '#F4D89A',
    grass: '#C2A35E',
    grassDry: '#D9BE7C',
    cloudLight: '#F6E7C4',
    cloudShadow: '#D3B98D',
    cloudAlpha: 0.6,
    ambient: 'sand',
    ambientLight: '#FFD98A',
    ambientLightAlpha: 0.08,
    accent: '#F59E0B',
    accentDim: '#B45309',
  },
  forest: {
    id: 'forest',
    name: 'Deep Canopy',
    sky: [
      { at: 0, color: '#0E2019' },
      { at: 0.38, color: '#1C3A28' },
      { at: 0.7, color: '#3A6640' },
      { at: 1, color: '#7FA765' },
    ],
    haze: 'rgba(127, 167, 101, 1)',
    celestial: 'shafts',
    skyline: 'canopy',
    ridgeFar: '#77A268',
    ridgeMid: '#3E6844',
    ridgeNear: '#1B3323',
    foliageDark: '#16301F',
    foliageMid: '#25512F',
    foliageLight: '#3E7A3F',
    trunk: '#3D2C1E',
    groundTop: '#4E6B37',
    groundBody: '#4A3823',
    groundDeep: '#291D12',
    groundLine: '#7FB554',
    grass: '#49803C',
    grassDry: '#6E8A3C',
    cloudLight: '#B9D3A0',
    cloudShadow: '#6E8F63',
    cloudAlpha: 0.5,
    ambient: 'leaves',
    ambientLight: '#8FE07A',
    ambientLightAlpha: 0.07,
    accent: '#34D399',
    accentDim: '#047857',
  },
};

export const THEME_ORDER: EnvironmentTheme[] = [
  'day',
  'sunset',
  'night',
  'desert',
  'forest',
];

export class EnvironmentSystem {
  private currentTheme: EnvironmentTheme = 'day';

  /** Set theme directly by index; wraps so endless mode keeps cycling. */
  setTheme(themeIndex: number): void {
    const index =
      ((themeIndex % THEME_ORDER.length) + THEME_ORDER.length) %
      THEME_ORDER.length;
    this.currentTheme = THEME_ORDER[index];
  }

  getCurrentTheme(): EnvironmentTheme {
    return this.currentTheme;
  }

  getPalette(): ThemePalette {
    return PALETTES[this.currentTheme];
  }

  static paletteFor(theme: EnvironmentTheme): ThemePalette {
    return PALETTES[theme];
  }

  static paletteForIndex(themeIndex: number): ThemePalette {
    const index =
      ((themeIndex % THEME_ORDER.length) + THEME_ORDER.length) %
      THEME_ORDER.length;
    return PALETTES[THEME_ORDER[index]];
  }

  getStageName(): string {
    return PALETTES[this.currentTheme].name;
  }

  getSkyColors(): { top: string; bottom: string } {
    const sky = PALETTES[this.currentTheme].sky;
    return { top: sky[0].color, bottom: sky[sky.length - 1].color };
  }

  getGroundColor(): string {
    return PALETTES[this.currentTheme].groundBody;
  }

  getGrassColor(): string {
    return PALETTES[this.currentTheme].groundTop;
  }

  getAccentColor(): string {
    return PALETTES[this.currentTheme].accent;
  }
}
