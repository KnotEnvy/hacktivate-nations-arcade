// ===== src/services/ProceduralMusicEngine.ts =====
// Procedural Music Generation Engine for Hacktivate Nations Arcade
// Generates 40+ minutes of unique, seed-based generative music

// ============= MUSICAL DEFINITIONS =============

// Note frequencies (A4 = 440Hz based)
export const NOTE_FREQUENCIES: Record<string, number> = {
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.26, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
  'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,
};

// Musical scales defined as semitone intervals from root
export const SCALES = {
  // Standard scales
  major: [0, 2, 4, 5, 7, 9, 11],           // Ionian - bright, happy
  minor: [0, 2, 3, 5, 7, 8, 10],           // Aeolian - sad, serious
  dorian: [0, 2, 3, 5, 7, 9, 10],          // Minor with raised 6th - jazzy, sophisticated
  phrygian: [0, 1, 3, 5, 7, 8, 10],        // Spanish/Middle Eastern feel
  lydian: [0, 2, 4, 6, 7, 9, 11],          // Dreamy, floating
  mixolydian: [0, 2, 4, 5, 7, 9, 10],      // Bluesy, rock

  // Pentatonic scales (5 notes - always consonant)
  majorPentatonic: [0, 2, 4, 7, 9],        // Happy, simple
  minorPentatonic: [0, 3, 5, 7, 10],       // Bluesy, versatile

  // Special scales for game moods
  japanese: [0, 2, 5, 7, 9],               // Peaceful, zen
  hungarian: [0, 2, 3, 6, 7, 8, 11],       // Dramatic, mysterious
  blues: [0, 3, 5, 6, 7, 10],              // Soulful
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Tension/transition

  // NEW: Harmonic variations
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],   // Classical dramatic, tension
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],    // Jazz, sophisticated ascending

  // NEW: Symmetric scales
  wholeTone: [0, 2, 4, 6, 8, 10],          // Dreamy, ethereal, no resolution
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],   // Tense, mysterious, symmetrical
  augmented: [0, 3, 4, 7, 8, 11],          // Unusual, sci-fi, unstable

  // NEW: World music scales
  arabian: [0, 1, 4, 5, 7, 8, 11],         // Middle Eastern, exotic
  egyptian: [0, 2, 5, 7, 10],              // Ancient, mystical
  hirajoshi: [0, 2, 3, 7, 8],              // Japanese traditional, melancholic
  insen: [0, 1, 5, 7, 10],                 // Japanese, contemplative

  // NEW: Modern/experimental
  prometheus: [0, 2, 4, 6, 9, 10],         // Scriabin's mystic chord, ethereal
  enigmatic: [0, 1, 4, 6, 8, 10, 11],      // Mysterious, unpredictable

  // NEW: Game-specific moods
  darkSynth: [0, 1, 3, 5, 6, 8, 10],       // Cyberpunk, dark retro
  spaceAmbient: [0, 2, 4, 7, 9, 11],       // Spacey, open, expansive
};

export type ScaleName = keyof typeof SCALES;

// Chord types as intervals from root
export const CHORD_TYPES = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14],
  power: [0, 7],       // Power chord - rock/intense
  power5: [0, 7, 12],  // Power chord with octave
};

// Chord progressions by mood
export const CHORD_PROGRESSIONS = {
  // Epic/Heroic
  epic1: ['i', 'VI', 'III', 'VII'],        // Am, F, C, G (synthwave classic)
  epic2: ['i', 'iv', 'VI', 'V'],           // Powerful resolution
  epic3: ['i', 'VII', 'VI', 'VII'],        // Building tension

  // Chill/Ambient
  chill1: ['I', 'vi', 'IV', 'V'],          // Classic pop
  chill2: ['Imaj7', 'vi7', 'ii7', 'V7'],   // Jazz-chill
  chill3: ['I', 'iii', 'vi', 'IV'],        // Dreamy

  // Intense/Action
  action1: ['i', 'i', 'VI', 'VII'],        // Driving
  action2: ['i', 'VII', 'VI', 'v'],        // Descending power
  action3: ['i', 'iv', 'i', 'V'],          // Tension release

  // Puzzle/Focus
  focus1: ['vi', 'IV', 'I', 'V'],          // Contemplative
  focus2: ['I', 'V', 'vi', 'iii'],         // Thoughtful
  focus3: ['ii', 'V', 'I', 'vi'],          // Resolution

  // Retro/Arcade
  retro1: ['I', 'IV', 'V', 'I'],           // Classic rock
  retro2: ['i', 'iv', 'VII', 'III'],       // 80s minor
  retro3: ['I', 'bVII', 'IV', 'I'],        // Power pop

  // Mysterious/Exploration
  mystery1: ['i', 'bVI', 'bIII', 'bVII'],  // Dark modal
  mystery2: ['i', 'ii°', 'bVI', 'V'],      // Suspenseful
  mystery3: ['i', 'bII', 'i', 'V'],        // Phrygian flavor
};

export type ChordProgressionName = keyof typeof CHORD_PROGRESSIONS;

type ChordQuality = keyof typeof CHORD_TYPES;

export interface ResolvedChord {
  symbol: string;
  tonalMode: 'major' | 'minor';
  degree: number;
  rootSemitone: number;
  quality: ChordQuality;
  intervals: number[];
  tones: number[];
}

const MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREE_SEMITONES = [0, 2, 3, 5, 7, 8, 10];

const ROMAN_DEGREES: Record<string, number> = {
  i: 0,
  ii: 1,
  iii: 2,
  iv: 3,
  v: 4,
  vi: 5,
  vii: 6,
};

export function resolveChordSymbol(
  symbol: string,
  tonalMode: 'major' | 'minor' = 'major',
): ResolvedChord {
  const trimmed = symbol.trim();
  const normalized = trimmed.replace('Â°', '°');
  const accidentalMatch = normalized.match(/^[b#]+/);
  const accidentalToken = accidentalMatch?.[0] ?? '';
  const accidental = [...accidentalToken].reduce((sum, char) => sum + (char === 'b' ? -1 : 1), 0);
  const withoutAccidental = normalized.slice(accidentalToken.length);
  const romanMatch = withoutAccidental.match(/^[ivIV]+/);
  const roman = romanMatch?.[0] ?? 'I';
  const suffix = withoutAccidental.slice(roman.length);
  const degree = ROMAN_DEGREES[roman.toLowerCase()] ?? 0;
  const baseScale = tonalMode === 'minor' ? MINOR_DEGREE_SEMITONES : MAJOR_DEGREE_SEMITONES;
  const rootSemitone = baseScale[degree] + accidental;
  const quality = getChordQuality(roman, suffix);
  const intervals = CHORD_TYPES[quality];

  return {
    symbol,
    tonalMode,
    degree,
    rootSemitone,
    quality,
    intervals,
    tones: intervals.map(interval => rootSemitone + interval),
  };
}

export function resolveTrackChord(track: TrackDefinition, barIndex: number): ResolvedChord {
  const progression = CHORD_PROGRESSIONS[track.progression] ?? CHORD_PROGRESSIONS.retro1;
  const symbol = progression[((barIndex % progression.length) + progression.length) % progression.length];
  return resolveChordSymbol(symbol, getProgressionTonalMode(progression));
}

function getProgressionTonalMode(progression: string[]): 'major' | 'minor' {
  const firstRoman = progression[0]?.replace(/^[b#]+/, '').match(/^[ivIV]+/)?.[0] ?? 'I';
  return firstRoman[0] === firstRoman[0].toLowerCase() ? 'minor' : 'major';
}

function getChordQuality(roman: string, suffix: string): ChordQuality {
  const normalizedSuffix = suffix.replace('Â°', '°').toLowerCase();

  if (normalizedSuffix.includes('°') || normalizedSuffix.includes('dim')) {
    return 'diminished';
  }

  if (normalizedSuffix.includes('maj7')) {
    return 'major7';
  }

  const isUppercaseRoman = roman === roman.toUpperCase();

  if (normalizedSuffix.includes('7')) {
    return isUppercaseRoman ? 'dom7' : 'minor7';
  }

  return isUppercaseRoman ? 'major' : 'minor';
}

// ============= TRACK DEFINITIONS =============

export interface TrackDefinition {
  name: string;
  bpm: number;
  scale: ScaleName;
  rootNote: string;
  progression: ChordProgressionName;
  mood: 'energetic' | 'chill' | 'intense' | 'focus' | 'retro' | 'mysterious' | 'epic' | 'playful';
  intensity: number; // 0.0 - 1.0
  instruments: InstrumentConfig[];
  effects: EffectConfig;
}

export interface CustomTrackParams {
  seed: number;
  bpm?: number;
  mood?: TrackDefinition['mood'] | string;
  intensity?: number;
  scale?: ScaleName | string;
  rootNote?: string;
}

export interface InstrumentConfig {
  type: 'bass' | 'lead' | 'pad' | 'arp' | 'drums' | 'fx';
  waveform: OscillatorType;
  octave: number;
  volume: number;
  filter?: { type: BiquadFilterType; frequency: number; Q: number };
  envelope?: { attack: number; decay: number; sustain: number; release: number };
}

export interface EffectConfig {
  reverb: number;      // 0.0 - 1.0
  delay: number;       // 0.0 - 1.0
  filterSweep: boolean;
  distortion: number;  // 0.0 - 1.0
}

// ============= SB32-STYLE PROCEDURAL PATCHES =============

export type PatchName =
  | 'fm_bass'
  | 'slap_bass'
  | 'square_lead'
  | 'saw_lead'
  | 'synth_brass'
  | 'warm_pad'
  | 'choir_pad'
  | 'bell'
  | 'marimba'
  | 'string_ensemble';

export interface PatchLayer {
  waveform: OscillatorType;
  gain: number;
  octaveOffset?: number;
  detuneCents?: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filter?: {
    type: BiquadFilterType;
    frequency: number;
    q: number;
  };
}

export interface InstrumentPatch {
  name: PatchName;
  label: string;
  layers: PatchLayer[];
  pan?: number;
  vibrato?: {
    rate: number;
    depthCents: number;
  };
  brightness: number;
  chorusSend: number;
}

export const SB32_PATCHES: Record<PatchName, InstrumentPatch> = {
  fm_bass: {
    name: 'fm_bass',
    label: 'FM Bass',
    pan: -0.08,
    brightness: 0.35,
    chorusSend: 0.12,
    layers: [
      { waveform: 'sine', gain: 0.9, octaveOffset: -1, attack: 0.005, decay: 0.08, sustain: 0.55, release: 0.08 },
      { waveform: 'square', gain: 0.28, octaveOffset: 0, detuneCents: -7, attack: 0.003, decay: 0.05, sustain: 0.35, release: 0.06, filter: { type: 'lowpass', frequency: 750, q: 2 } },
    ],
  },
  slap_bass: {
    name: 'slap_bass',
    label: 'Slap Bass',
    pan: -0.1,
    brightness: 0.55,
    chorusSend: 0.08,
    layers: [
      { waveform: 'sawtooth', gain: 0.7, octaveOffset: -1, attack: 0.002, decay: 0.06, sustain: 0.35, release: 0.07, filter: { type: 'lowpass', frequency: 1050, q: 3 } },
      { waveform: 'triangle', gain: 0.25, octaveOffset: 0, attack: 0.001, decay: 0.025, sustain: 0.1, release: 0.04, filter: { type: 'highpass', frequency: 900, q: 1 } },
    ],
  },
  square_lead: {
    name: 'square_lead',
    label: 'Square Lead',
    pan: 0.12,
    brightness: 0.78,
    chorusSend: 0.2,
    vibrato: { rate: 5.5, depthCents: 9 },
    layers: [
      { waveform: 'square', gain: 0.75, attack: 0.01, decay: 0.08, sustain: 0.7, release: 0.12, filter: { type: 'lowpass', frequency: 4200, q: 1.2 } },
      { waveform: 'triangle', gain: 0.18, octaveOffset: 1, detuneCents: 4, attack: 0.012, decay: 0.1, sustain: 0.45, release: 0.1 },
    ],
  },
  saw_lead: {
    name: 'saw_lead',
    label: 'Saw Lead',
    pan: 0.16,
    brightness: 0.85,
    chorusSend: 0.25,
    vibrato: { rate: 5.2, depthCents: 6 },
    layers: [
      { waveform: 'sawtooth', gain: 0.62, detuneCents: -6, attack: 0.008, decay: 0.06, sustain: 0.72, release: 0.1, filter: { type: 'lowpass', frequency: 5200, q: 1.5 } },
      { waveform: 'sawtooth', gain: 0.5, detuneCents: 7, attack: 0.008, decay: 0.06, sustain: 0.72, release: 0.1, filter: { type: 'lowpass', frequency: 4800, q: 1.5 } },
    ],
  },
  synth_brass: {
    name: 'synth_brass',
    label: 'Synth Brass',
    pan: 0.05,
    brightness: 0.72,
    chorusSend: 0.32,
    layers: [
      { waveform: 'sawtooth', gain: 0.55, detuneCents: -8, attack: 0.04, decay: 0.18, sustain: 0.68, release: 0.18, filter: { type: 'lowpass', frequency: 3400, q: 2.4 } },
      { waveform: 'square', gain: 0.22, detuneCents: 9, attack: 0.035, decay: 0.16, sustain: 0.55, release: 0.16, filter: { type: 'lowpass', frequency: 2600, q: 2 } },
    ],
  },
  warm_pad: {
    name: 'warm_pad',
    label: 'Warm Pad',
    pan: -0.18,
    brightness: 0.42,
    chorusSend: 0.55,
    layers: [
      { waveform: 'triangle', gain: 0.38, detuneCents: -9, attack: 0.18, decay: 0.35, sustain: 0.78, release: 0.5, filter: { type: 'lowpass', frequency: 2200, q: 0.8 } },
      { waveform: 'sine', gain: 0.32, detuneCents: 8, attack: 0.22, decay: 0.4, sustain: 0.72, release: 0.55 },
      { waveform: 'sawtooth', gain: 0.12, octaveOffset: 1, attack: 0.2, decay: 0.3, sustain: 0.45, release: 0.45, filter: { type: 'lowpass', frequency: 1600, q: 0.6 } },
    ],
  },
  choir_pad: {
    name: 'choir_pad',
    label: 'Choir Pad',
    pan: 0.2,
    brightness: 0.38,
    chorusSend: 0.62,
    vibrato: { rate: 4.1, depthCents: 4 },
    layers: [
      { waveform: 'sine', gain: 0.42, attack: 0.25, decay: 0.35, sustain: 0.82, release: 0.65, filter: { type: 'bandpass', frequency: 950, q: 0.9 } },
      { waveform: 'triangle', gain: 0.3, octaveOffset: 1, detuneCents: 5, attack: 0.28, decay: 0.4, sustain: 0.62, release: 0.65, filter: { type: 'bandpass', frequency: 1700, q: 0.9 } },
    ],
  },
  bell: {
    name: 'bell',
    label: 'Bell',
    pan: 0.24,
    brightness: 0.95,
    chorusSend: 0.28,
    layers: [
      { waveform: 'sine', gain: 0.62, attack: 0.003, decay: 0.45, sustain: 0.18, release: 0.45 },
      { waveform: 'triangle', gain: 0.28, octaveOffset: 1, detuneCents: 14, attack: 0.003, decay: 0.32, sustain: 0.08, release: 0.35 },
      { waveform: 'sine', gain: 0.14, octaveOffset: 2, detuneCents: -21, attack: 0.002, decay: 0.2, sustain: 0.04, release: 0.24 },
    ],
  },
  marimba: {
    name: 'marimba',
    label: 'Marimba',
    pan: -0.22,
    brightness: 0.7,
    chorusSend: 0.1,
    layers: [
      { waveform: 'triangle', gain: 0.72, attack: 0.003, decay: 0.16, sustain: 0.12, release: 0.08, filter: { type: 'lowpass', frequency: 3000, q: 1.1 } },
      { waveform: 'sine', gain: 0.26, octaveOffset: 1, attack: 0.002, decay: 0.08, sustain: 0.04, release: 0.05 },
    ],
  },
  string_ensemble: {
    name: 'string_ensemble',
    label: 'String Ensemble',
    pan: -0.05,
    brightness: 0.5,
    chorusSend: 0.48,
    vibrato: { rate: 4.6, depthCents: 5 },
    layers: [
      { waveform: 'sawtooth', gain: 0.34, detuneCents: -10, attack: 0.08, decay: 0.2, sustain: 0.74, release: 0.35, filter: { type: 'lowpass', frequency: 2600, q: 1 } },
      { waveform: 'triangle', gain: 0.28, detuneCents: 11, attack: 0.1, decay: 0.24, sustain: 0.7, release: 0.4, filter: { type: 'lowpass', frequency: 2100, q: 0.8 } },
    ],
  },
};

export function getPatchForInstrument(
  instrument: InstrumentConfig,
  track: TrackDefinition,
): InstrumentPatch {
  if (instrument.type === 'bass') {
    return SB32_PATCHES[track.mood === 'playful' ? 'slap_bass' : 'fm_bass'];
  }

  if (instrument.type === 'pad') {
    if (track.mood === 'epic') return SB32_PATCHES.string_ensemble;
    if (track.mood === 'mysterious') return SB32_PATCHES.choir_pad;
    return SB32_PATCHES.warm_pad;
  }

  if (instrument.type === 'arp') {
    return SB32_PATCHES[track.mood === 'playful' || track.mood === 'focus' ? 'marimba' : 'bell'];
  }

  if (instrument.type === 'lead') {
    if (track.mood === 'epic' || track.mood === 'energetic') return SB32_PATCHES.synth_brass;
    return SB32_PATCHES[instrument.waveform === 'square' ? 'square_lead' : 'saw_lead'];
  }

  return SB32_PATCHES.bell;
}

export interface PatchMixProfile {
  channelGain: number;
  chorusSend: number;
}

export function getPatchMixProfile(patch: InstrumentPatch): PatchMixProfile {
  const channelGain = Math.max(0.2, Math.min(1, 0.92 - patch.brightness * 0.18));
  return {
    channelGain,
    chorusSend: Math.max(0, Math.min(0.75, patch.chorusSend)),
  };
}

// ============= PREDEFINED TRACKS =============

export const TRACK_DEFINITIONS: Record<string, TrackDefinition> = {
  // ========== HUB/MENU TRACKS ==========

  hub_sb32_intro: {
    name: 'SB32 Power-On',
    bpm: 118,
    scale: 'mixolydian',
    rootNote: 'D3',
    progression: 'retro3',
    mood: 'epic',
    intensity: 0.82,
    instruments: [
      { type: 'bass', waveform: 'square', octave: 2, volume: 0.32, filter: { type: 'lowpass', frequency: 620, Q: 4 } },
      { type: 'pad', waveform: 'sawtooth', octave: 4, volume: 0.18, filter: { type: 'lowpass', frequency: 2200, Q: 1 } },
      { type: 'lead', waveform: 'sawtooth', octave: 5, volume: 0.18, filter: { type: 'lowpass', frequency: 4800, Q: 3 } },
      { type: 'arp', waveform: 'triangle', octave: 6, volume: 0.13 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.62 },
      { type: 'fx', waveform: 'sine', octave: 6, volume: 0.08 },
    ],
    effects: { reverb: 0.24, delay: 0.18, filterSweep: true, distortion: 0.08 },
  },

  hub_welcome: {
    name: 'Arcade Welcome',
    bpm: 110,
    scale: 'majorPentatonic',
    rootNote: 'A3',
    progression: 'chill1',
    mood: 'energetic',
    intensity: 0.6,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 2, volume: 0.25, filter: { type: 'lowpass', frequency: 400, Q: 1 } },
      { type: 'pad', waveform: 'triangle', octave: 4, volume: 0.15 },
      { type: 'lead', waveform: 'sine', octave: 5, volume: 0.12 },
      { type: 'arp', waveform: 'sawtooth', octave: 5, volume: 0.1, filter: { type: 'lowpass', frequency: 2000, Q: 2 } },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.5 },
    ],
    effects: { reverb: 0.15, delay: 0.1, filterSweep: true, distortion: 0 },
  },

  hub_ambient: {
    name: 'Neon Dreams',
    bpm: 85,
    scale: 'lydian',
    rootNote: 'C4',
    progression: 'chill3',
    mood: 'chill',
    intensity: 0.3,
    instruments: [
      { type: 'bass', waveform: 'sine', octave: 2, volume: 0.2 },
      { type: 'pad', waveform: 'sine', octave: 4, volume: 0.2 },
      { type: 'pad', waveform: 'triangle', octave: 5, volume: 0.1 },
      { type: 'arp', waveform: 'triangle', octave: 5, volume: 0.08 },
    ],
    effects: { reverb: 0.35, delay: 0.2, filterSweep: true, distortion: 0 },
  },

  hub_energetic: {
    name: 'Ready Player',
    bpm: 128,
    scale: 'minor',
    rootNote: 'E3',
    progression: 'epic1',
    mood: 'energetic',
    intensity: 0.75,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 2, volume: 0.3, filter: { type: 'lowpass', frequency: 600, Q: 4 } },
      { type: 'lead', waveform: 'sawtooth', octave: 4, volume: 0.15, filter: { type: 'lowpass', frequency: 3000, Q: 3 } },
      { type: 'pad', waveform: 'triangle', octave: 4, volume: 0.1 },
      { type: 'arp', waveform: 'sawtooth', octave: 5, volume: 0.12 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.6 },
    ],
    effects: { reverb: 0.1, delay: 0.05, filterSweep: true, distortion: 0.1 },
  },

  // ========== ACTION GAME TRACKS ==========

  action_intense: {
    name: 'Adrenaline Rush',
    bpm: 145,
    scale: 'minorPentatonic',
    rootNote: 'D3',
    progression: 'action1',
    mood: 'intense',
    intensity: 0.9,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 1, volume: 0.35, filter: { type: 'lowpass', frequency: 500, Q: 5 } },
      { type: 'bass', waveform: 'square', octave: 2, volume: 0.15 },
      { type: 'lead', waveform: 'sawtooth', octave: 4, volume: 0.2, filter: { type: 'lowpass', frequency: 4000, Q: 4 } },
      { type: 'arp', waveform: 'square', octave: 5, volume: 0.15 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.7 },
    ],
    effects: { reverb: 0.08, delay: 0, filterSweep: true, distortion: 0.15 },
  },

  action_chase: {
    name: 'Hot Pursuit',
    bpm: 160,
    scale: 'phrygian',
    rootNote: 'E3',
    progression: 'action2',
    mood: 'intense',
    intensity: 0.95,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 1, volume: 0.4, filter: { type: 'lowpass', frequency: 400, Q: 6 } },
      { type: 'lead', waveform: 'sawtooth', octave: 4, volume: 0.18 },
      { type: 'lead', waveform: 'square', octave: 5, volume: 0.1 },
      { type: 'arp', waveform: 'sawtooth', octave: 5, volume: 0.18 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.75 },
    ],
    effects: { reverb: 0.05, delay: 0, filterSweep: true, distortion: 0.2 },
  },

  // ========== PUZZLE GAME TRACKS ==========

  puzzle_focus: {
    name: 'Deep Thought',
    bpm: 75,
    scale: 'dorian',
    rootNote: 'A3',
    progression: 'focus1',
    mood: 'focus',
    intensity: 0.4,
    instruments: [
      { type: 'bass', waveform: 'sine', octave: 2, volume: 0.2 },
      { type: 'pad', waveform: 'sine', octave: 4, volume: 0.18 },
      { type: 'pad', waveform: 'triangle', octave: 5, volume: 0.1 },
      { type: 'arp', waveform: 'sine', octave: 5, volume: 0.1 },
    ],
    effects: { reverb: 0.3, delay: 0.15, filterSweep: true, distortion: 0 },
  },

  puzzle_discovery: {
    name: 'Eureka Moment',
    bpm: 90,
    scale: 'majorPentatonic',
    rootNote: 'C4',
    progression: 'focus2',
    mood: 'playful',
    intensity: 0.5,
    instruments: [
      { type: 'bass', waveform: 'triangle', octave: 2, volume: 0.18 },
      { type: 'pad', waveform: 'sine', octave: 4, volume: 0.15 },
      { type: 'lead', waveform: 'triangle', octave: 5, volume: 0.12 },
      { type: 'arp', waveform: 'sine', octave: 5, volume: 0.12 },
      { type: 'fx', waveform: 'sine', octave: 6, volume: 0.05 },
    ],
    effects: { reverb: 0.25, delay: 0.1, filterSweep: false, distortion: 0 },
  },

  // ========== ARCADE/RETRO TRACKS ==========

  arcade_retro: {
    name: 'Pixel Power',
    bpm: 130,
    scale: 'minorPentatonic',
    rootNote: 'E3',
    progression: 'retro1',
    mood: 'retro',
    intensity: 0.7,
    instruments: [
      { type: 'bass', waveform: 'square', octave: 2, volume: 0.25 },
      { type: 'lead', waveform: 'square', octave: 4, volume: 0.15 },
      { type: 'arp', waveform: 'square', octave: 5, volume: 0.12 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.55 },
    ],
    effects: { reverb: 0.1, delay: 0.05, filterSweep: false, distortion: 0.05 },
  },

  arcade_bounce: {
    name: 'Bounce Beat',
    bpm: 125,
    scale: 'major',
    rootNote: 'G3',
    progression: 'retro3',
    mood: 'retro',
    intensity: 0.65,
    instruments: [
      { type: 'bass', waveform: 'triangle', octave: 2, volume: 0.25 },
      { type: 'lead', waveform: 'square', octave: 4, volume: 0.14 },
      { type: 'pad', waveform: 'triangle', octave: 4, volume: 0.08 },
      { type: 'arp', waveform: 'square', octave: 5, volume: 0.1 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.5 },
    ],
    effects: { reverb: 0.12, delay: 0.08, filterSweep: true, distortion: 0 },
  },

  // ========== CASUAL/CHILL TRACKS ==========

  casual_chill: {
    name: 'Sunday Vibes',
    bpm: 95,
    scale: 'major',
    rootNote: 'F3',
    progression: 'chill2',
    mood: 'chill',
    intensity: 0.35,
    instruments: [
      { type: 'bass', waveform: 'sine', octave: 2, volume: 0.18 },
      { type: 'pad', waveform: 'sine', octave: 4, volume: 0.2 },
      { type: 'lead', waveform: 'triangle', octave: 5, volume: 0.1 },
      { type: 'arp', waveform: 'sine', octave: 5, volume: 0.08 },
    ],
    effects: { reverb: 0.3, delay: 0.15, filterSweep: true, distortion: 0 },
  },

  casual_playful: {
    name: 'Happy Hours',
    bpm: 105,
    scale: 'majorPentatonic',
    rootNote: 'G3',
    progression: 'chill1',
    mood: 'playful',
    intensity: 0.5,
    instruments: [
      { type: 'bass', waveform: 'triangle', octave: 2, volume: 0.2 },
      { type: 'pad', waveform: 'triangle', octave: 4, volume: 0.12 },
      { type: 'lead', waveform: 'sine', octave: 5, volume: 0.12 },
      { type: 'arp', waveform: 'triangle', octave: 5, volume: 0.12 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.4 },
    ],
    effects: { reverb: 0.2, delay: 0.1, filterSweep: false, distortion: 0 },
  },

  // ========== EPIC/ADVENTURE TRACKS ==========

  epic_heroic: {
    name: 'Hero\'s Journey',
    bpm: 120,
    scale: 'minor',
    rootNote: 'D3',
    progression: 'epic2',
    mood: 'epic',
    intensity: 0.8,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 1, volume: 0.3, filter: { type: 'lowpass', frequency: 500, Q: 3 } },
      { type: 'pad', waveform: 'sawtooth', octave: 3, volume: 0.15 },
      { type: 'pad', waveform: 'triangle', octave: 4, volume: 0.12 },
      { type: 'lead', waveform: 'sawtooth', octave: 4, volume: 0.18, filter: { type: 'lowpass', frequency: 3500, Q: 2 } },
      { type: 'arp', waveform: 'triangle', octave: 5, volume: 0.1 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.6 },
    ],
    effects: { reverb: 0.2, delay: 0.1, filterSweep: true, distortion: 0.08 },
  },

  epic_tension: {
    name: 'Dark Descent',
    bpm: 100,
    scale: 'phrygian',
    rootNote: 'E3',
    progression: 'mystery1',
    mood: 'mysterious',
    intensity: 0.7,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 1, volume: 0.28, filter: { type: 'lowpass', frequency: 350, Q: 4 } },
      { type: 'pad', waveform: 'sawtooth', octave: 3, volume: 0.12 },
      { type: 'pad', waveform: 'sine', octave: 4, volume: 0.15 },
      { type: 'lead', waveform: 'triangle', octave: 4, volume: 0.1 },
      { type: 'fx', waveform: 'sawtooth', octave: 5, volume: 0.06 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.45 },
    ],
    effects: { reverb: 0.35, delay: 0.2, filterSweep: true, distortion: 0.05 },
  },

  // ========== SPORTS TRACKS ==========

  sports_competitive: {
    name: 'Championship Drive',
    bpm: 138,
    scale: 'mixolydian',
    rootNote: 'A3',
    progression: 'action3',
    mood: 'energetic',
    intensity: 0.85,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 2, volume: 0.3, filter: { type: 'lowpass', frequency: 550, Q: 4 } },
      { type: 'lead', waveform: 'sawtooth', octave: 4, volume: 0.16 },
      { type: 'pad', waveform: 'triangle', octave: 4, volume: 0.08 },
      { type: 'arp', waveform: 'square', octave: 5, volume: 0.12 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.65 },
    ],
    effects: { reverb: 0.1, delay: 0.05, filterSweep: true, distortion: 0.1 },
  },

  sports_victory: {
    name: 'Glory Moment',
    bpm: 125,
    scale: 'major',
    rootNote: 'C4',
    progression: 'epic1',
    mood: 'epic',
    intensity: 0.75,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 2, volume: 0.25 },
      { type: 'pad', waveform: 'sawtooth', octave: 4, volume: 0.15 },
      { type: 'lead', waveform: 'triangle', octave: 5, volume: 0.15 },
      { type: 'arp', waveform: 'triangle', octave: 5, volume: 0.1 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.55 },
    ],
    effects: { reverb: 0.18, delay: 0.08, filterSweep: false, distortion: 0.05 },
  },

  // ========== RHYTHM GAME TRACKS ==========

  rhythm_beat: {
    name: 'Pulse Drive',
    bpm: 128,
    scale: 'minor',
    rootNote: 'F3',
    progression: 'retro2',
    mood: 'energetic',
    intensity: 0.8,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 2, volume: 0.32, filter: { type: 'lowpass', frequency: 600, Q: 5 } },
      { type: 'bass', waveform: 'sine', octave: 1, volume: 0.2 },
      { type: 'lead', waveform: 'sawtooth', octave: 4, volume: 0.15 },
      { type: 'arp', waveform: 'sawtooth', octave: 5, volume: 0.14 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.7 },
    ],
    effects: { reverb: 0.1, delay: 0.05, filterSweep: true, distortion: 0.08 },
  },

  rhythm_groove: {
    name: 'Funk Machine',
    bpm: 115,
    scale: 'dorian',
    rootNote: 'G3',
    progression: 'focus3',
    mood: 'playful',
    intensity: 0.7,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 2, volume: 0.28, filter: { type: 'lowpass', frequency: 700, Q: 3 } },
      { type: 'lead', waveform: 'square', octave: 4, volume: 0.12 },
      { type: 'pad', waveform: 'triangle', octave: 4, volume: 0.1 },
      { type: 'arp', waveform: 'triangle', octave: 5, volume: 0.12 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.6 },
    ],
    effects: { reverb: 0.15, delay: 0.1, filterSweep: true, distortion: 0.05 },
  },

  // ========== SPACE/SCI-FI TRACKS ==========

  space_exploration: {
    name: 'Cosmic Voyage',
    bpm: 90,
    scale: 'lydian',
    rootNote: 'B3',
    progression: 'mystery2',
    mood: 'mysterious',
    intensity: 0.5,
    instruments: [
      { type: 'bass', waveform: 'sine', octave: 1, volume: 0.22 },
      { type: 'pad', waveform: 'sine', octave: 3, volume: 0.2 },
      { type: 'pad', waveform: 'triangle', octave: 5, volume: 0.12 },
      { type: 'lead', waveform: 'sine', octave: 5, volume: 0.1 },
      { type: 'fx', waveform: 'sine', octave: 6, volume: 0.05 },
    ],
    effects: { reverb: 0.4, delay: 0.25, filterSweep: true, distortion: 0 },
  },

  space_battle: {
    name: 'Starship Combat',
    bpm: 150,
    scale: 'phrygian',
    rootNote: 'E3',
    progression: 'action1',
    mood: 'intense',
    intensity: 0.92,
    instruments: [
      { type: 'bass', waveform: 'sawtooth', octave: 1, volume: 0.35, filter: { type: 'lowpass', frequency: 450, Q: 6 } },
      { type: 'bass', waveform: 'square', octave: 2, volume: 0.15 },
      { type: 'lead', waveform: 'sawtooth', octave: 4, volume: 0.2, filter: { type: 'lowpass', frequency: 4500, Q: 3 } },
      { type: 'arp', waveform: 'sawtooth', octave: 5, volume: 0.16 },
      { type: 'drums', waveform: 'sine', octave: 2, volume: 0.75 },
    ],
    effects: { reverb: 0.08, delay: 0, filterSweep: true, distortion: 0.18 },
  },
};

export function buildCustomTrackDefinition(params: CustomTrackParams): TrackDefinition {
  const mood = normalizeMood(params.mood);
  const scale = normalizeScale(params.scale, mood);
  const rootNote = normalizeRootNote(params.rootNote);
  const bpm = clampNumber(params.bpm ?? getDefaultBpmForMood(mood), 60, 200);
  const intensity = clampNumber(params.intensity ?? getDefaultIntensityForMood(mood), 0.1, 1);
  const template = TRACK_DEFINITIONS[getTemplateTrackForMood(mood)];

  return {
    ...template,
    name: `Lab ${mood.charAt(0).toUpperCase()}${mood.slice(1)} ${params.seed}`,
    bpm,
    scale,
    rootNote,
    mood,
    intensity,
    progression: getProgressionForMood(mood, scale),
    instruments: template.instruments.map(instrument => ({ ...instrument })),
    effects: {
      ...template.effects,
      reverb: mood === 'chill' || mood === 'mysterious'
        ? Math.max(template.effects.reverb, 0.3)
        : template.effects.reverb,
      delay: mood === 'focus' || mood === 'chill'
        ? Math.max(template.effects.delay, 0.12)
        : template.effects.delay,
    },
  };
}

function normalizeMood(mood: CustomTrackParams['mood']): TrackDefinition['mood'] {
  const allowed: TrackDefinition['mood'][] = ['energetic', 'chill', 'intense', 'focus', 'retro', 'mysterious', 'epic', 'playful'];
  return allowed.includes(mood as TrackDefinition['mood']) ? mood as TrackDefinition['mood'] : 'energetic';
}

function normalizeScale(scale: CustomTrackParams['scale'], mood: TrackDefinition['mood']): ScaleName {
  if (scale && scale in SCALES) {
    return scale as ScaleName;
  }

  const fallbackByMood: Record<TrackDefinition['mood'], ScaleName> = {
    energetic: 'minor',
    chill: 'lydian',
    intense: 'minorPentatonic',
    focus: 'dorian',
    retro: 'minorPentatonic',
    mysterious: 'phrygian',
    epic: 'minor',
    playful: 'majorPentatonic',
  };

  return fallbackByMood[mood];
}

function normalizeRootNote(rootNote: string | undefined): string {
  const normalized = `${rootNote || 'A'}3`;
  if (normalized in NOTE_FREQUENCIES) return normalized;

  const withOctave = rootNote && /\d$/.test(rootNote) ? rootNote : `${rootNote || 'A'}3`;
  return withOctave in NOTE_FREQUENCIES ? withOctave : 'A3';
}

function getTemplateTrackForMood(mood: TrackDefinition['mood']): string {
  const templates: Record<TrackDefinition['mood'], string> = {
    energetic: 'hub_energetic',
    chill: 'hub_ambient',
    intense: 'action_intense',
    focus: 'puzzle_focus',
    retro: 'arcade_retro',
    mysterious: 'epic_tension',
    epic: 'epic_heroic',
    playful: 'casual_playful',
  };

  return templates[mood];
}

function getProgressionForMood(
  mood: TrackDefinition['mood'],
  scale: ScaleName,
): ChordProgressionName {
  if (scale === 'major' || scale === 'majorPentatonic' || scale === 'lydian' || scale === 'mixolydian') {
    return mood === 'focus' ? 'focus2' : mood === 'retro' ? 'retro3' : 'chill1';
  }

  const progressions: Record<TrackDefinition['mood'], ChordProgressionName> = {
    energetic: 'epic1',
    chill: 'chill3',
    intense: 'action1',
    focus: 'focus1',
    retro: 'retro2',
    mysterious: 'mystery1',
    epic: 'epic2',
    playful: 'chill1',
  };

  return progressions[mood];
}

function getDefaultBpmForMood(mood: TrackDefinition['mood']): number {
  const bpmByMood: Record<TrackDefinition['mood'], number> = {
    energetic: 128,
    chill: 85,
    intense: 150,
    focus: 80,
    retro: 130,
    mysterious: 95,
    epic: 120,
    playful: 105,
  };

  return bpmByMood[mood];
}

function getDefaultIntensityForMood(mood: TrackDefinition['mood']): number {
  const intensityByMood: Record<TrackDefinition['mood'], number> = {
    energetic: 0.75,
    chill: 0.35,
    intense: 0.9,
    focus: 0.45,
    retro: 0.7,
    mysterious: 0.65,
    epic: 0.8,
    playful: 0.55,
  };

  return intensityByMood[mood];
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// ============= GAME TO TRACK MAPPING =============

export const GAME_TRACK_MAPPING: Record<string, { primary: string; secondary: string }> = {
  // Tier 0
  'runner': { primary: 'action_intense', secondary: 'action_chase' },
  'snake': { primary: 'arcade_retro', secondary: 'arcade_bounce' },
  'minesweeper': { primary: 'puzzle_focus', secondary: 'puzzle_discovery' },
  'breakout': { primary: 'arcade_bounce', secondary: 'arcade_retro' },
  'memory': { primary: 'casual_chill', secondary: 'puzzle_focus' },
  'tapdodge': { primary: 'arcade_retro', secondary: 'action_intense' },

  // Tier 1
  'puzzle': { primary: 'puzzle_focus', secondary: 'puzzle_discovery' },
  'color-drop': { primary: 'puzzle_discovery', secondary: 'casual_playful' },
  'tower-builder': { primary: 'casual_playful', secondary: 'arcade_bounce' },
  'mini-golf': { primary: 'casual_chill', secondary: 'casual_playful' },
  'bubble': { primary: 'casual_playful', secondary: 'arcade_bounce' },

  // Tier 2
  'space': { primary: 'space_battle', secondary: 'space_exploration' },
  'asteroids': { primary: 'space_battle', secondary: 'action_intense' },
  'frog-hop': { primary: 'arcade_bounce', secondary: 'casual_playful' },
  'platform-adventure': { primary: 'epic_heroic', secondary: 'action_chase' },
  'speed-racer': { primary: 'action_chase', secondary: 'sports_competitive' },

  // Tier 3
  'dungeon-crawl': { primary: 'epic_tension', secondary: 'epic_heroic' },
  'target-shooter': { primary: 'action_intense', secondary: 'sports_competitive' },
  'puzzle-quest': { primary: 'epic_heroic', secondary: 'puzzle_discovery' },
  'ice-hockey': { primary: 'sports_competitive', secondary: 'sports_victory' },
  'block-defense': { primary: 'epic_tension', secondary: 'action_intense' },

  // Tier 4
  'side-scroll-action': { primary: 'epic_heroic', secondary: 'action_chase' },
  'sim-farm': { primary: 'casual_chill', secondary: 'casual_playful' },
  'battle-arena': { primary: 'action_intense', secondary: 'epic_heroic' },
  'puzzle-rpg': { primary: 'epic_tension', secondary: 'puzzle_focus' },
  'rhythm-challenge': { primary: 'rhythm_beat', secondary: 'rhythm_groove' },
};

// ============= SEEDED RANDOM NUMBER GENERATOR =============

export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Mulberry32 PRNG - fast and good distribution
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Get integer in range [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Pick random element from array
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Shuffle array
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ============= MELODY GENERATOR =============

export interface MelodyNote {
  frequency: number;
  duration: number; // in beats
  velocity: number; // 0-1
  octaveShift: number;
}

export interface MusicEvent {
  id: string;
  instrumentType: InstrumentConfig['type'];
  bar: number;
  beat: number;
  phrase: number;
  scheduledTime: number;
  duration: number;
  velocity: number;
  frequency?: number;
}

const BEATS_PER_BAR = 4;

export type MusicLayerName = 'bass' | 'drums' | 'melody' | 'chords' | 'arpeggio' | 'ambience';

export type MusicStingerType = 'success' | 'danger' | 'transition';

export function getActiveMusicLayersForIntensity(intensity: number): Record<MusicLayerName, boolean> {
  const safeIntensity = clampNumber(intensity, 0, 1);

  return {
    bass: safeIntensity >= 0.05,
    drums: safeIntensity >= 0.15,
    chords: safeIntensity >= 0.25,
    arpeggio: safeIntensity >= 0.45,
    melody: safeIntensity >= 0.6,
    ambience: safeIntensity >= 0.75,
  };
}

export type PhraseSection = 'intro' | 'a' | 'b' | 'fill' | 'cadence';

export interface PhrasePlanNote extends MelodyNote {
  section: PhraseSection;
  bar: number;
  beat: number;
  motifIndex: number;
  chordSymbol: string;
}

export interface PhrasePlan {
  seed: number;
  phraseIndex: number;
  sections: PhraseSection[];
  notes: PhrasePlanNote[];
}

export function buildPhrasePlan(
  track: TrackDefinition,
  seed: number,
  phraseIndex: number = 0,
): PhrasePlan {
  const rng = new SeededRandom(seed + phraseIndex * 7919);
  const melody = new MelodyGenerator(seed + phraseIndex * 104729, track.scale, track.rootNote);
  const isHighEnergy = track.mood === 'intense' || track.mood === 'energetic';
  const isAmbient = track.mood === 'chill' || track.mood === 'mysterious';
  const sections: PhraseSection[] = phraseIndex === 0
    ? ['intro', 'a', 'b', 'cadence']
    : ['a', phraseIndex % 2 === 0 ? 'a' : 'b', 'fill', 'cadence'];
  const baseMotif = [0, 2, 4, 2].map(degree => degree + rng.nextInt(-1, 1));
  const notes: PhrasePlanNote[] = [];

  sections.forEach((section, bar) => {
    const chord = resolveTrackChord(track, bar);
    const beats = section === 'cadence' && !isAmbient ? [0, 1, 2, 3] : [0, 1, 2, 3];

    beats.forEach((beat) => {
      const shouldRest = !isHighEnergy && section !== 'cadence' && beat === 1 && rng.next() > 0.45;
      if (shouldRest) return;

      const motifIndex = beat % baseMotif.length;
      const sectionLift = section === 'b' ? 1 : section === 'fill' ? rng.pick([-2, 2, 3]) : 0;
      const cadenceTone = beat >= 2 ? chord.tones[0] : chord.tones[Math.min(beat, chord.tones.length - 1)];
      const frequency = section === 'cadence'
        ? melody.getFrequencyForSemitoneOffset(cadenceTone, 0)
        : melody.getFrequencyForDegree(baseMotif[motifIndex] + sectionLift, section === 'fill' ? 1 : 0);

      notes.push({
        frequency,
        duration: section === 'cadence'
          ? (beat >= 2 ? 2 : 1)
          : isAmbient ? rng.pick([1, 2]) : rng.pick([0.5, 1, 1]),
        velocity: section === 'cadence'
          ? 0.65
          : Math.min(0.95, 0.45 + track.intensity * 0.35 + rng.next() * 0.15),
        octaveShift: section === 'fill' ? 1 : 0,
        section,
        bar,
        beat,
        motifIndex,
        chordSymbol: chord.symbol,
      });
    });
  });

  return {
    seed,
    phraseIndex,
    sections,
    notes,
  };
}

export function buildMusicEventGrid(
  track: TrackDefinition,
  seed: number,
  bars: number = 4,
): MusicEvent[] {
  const melody = new MelodyGenerator(seed, track.scale, track.rootNote);
  const beatDuration = 60 / track.bpm;
  const events: MusicEvent[] = [];
  const phrasePlan = buildPhrasePlan(track, seed, 0);

  for (let bar = 0; bar < bars; bar++) {
    const chord = resolveTrackChord(track, bar);

    for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
      const scheduledTime = (bar * BEATS_PER_BAR + beat) * beatDuration;

      track.instruments.forEach((instrument, instrumentIndex) => {
        const baseEvent = {
          id: `${bar}:${beat}:${instrumentIndex}:${instrument.type}`,
          instrumentType: instrument.type,
          bar,
          beat,
          phrase: Math.floor(bar / 4),
          scheduledTime,
          duration: beatDuration,
          velocity: instrument.volume,
        };

        switch (instrument.type) {
          case 'bass': {
            const shouldPlay = track.mood === 'intense' || track.mood === 'energetic' || beat === 0 || beat === 2;
            if (!shouldPlay) return;

            events.push({
              ...baseEvent,
              duration: track.mood === 'intense' ? 0.2 : 0.4,
              frequency: melody.getFrequencyForSemitoneOffset(chord.rootSemitone, instrument.octave - 3),
            });
            break;
          }

          case 'lead': {
            const phraseNote = phrasePlan.notes.find(note => note.bar === bar && note.beat === beat);
            if (!phraseNote) return;

            events.push({
              ...baseEvent,
              duration: phraseNote.duration * beatDuration,
              velocity: instrument.volume * phraseNote.velocity,
              frequency: phraseNote.frequency * Math.pow(2, instrument.octave - 4),
            });
            break;
          }

          case 'pad': {
            if (beat !== 0) return;

            events.push({
              ...baseEvent,
              duration: beatDuration * BEATS_PER_BAR,
              velocity: instrument.volume * 0.7,
              frequency: melody.getFrequencyForSemitoneOffset(chord.tones[0], instrument.octave - 4),
            });
            break;
          }

          case 'arp': {
            const tone = chord.tones[[0, 1, 2, 1][beat] % chord.tones.length];
            events.push({
              ...baseEvent,
              duration: 0.15,
              frequency: melody.getFrequencyForSemitoneOffset(tone, instrument.octave - 4),
            });
            break;
          }

          case 'drums':
            events.push({
              ...baseEvent,
              duration: 0.2,
              frequency: beat === 0 || beat === 2 ? 60 : 200,
            });
            break;

          case 'fx':
            if (beat !== 0) return;

            events.push({
              ...baseEvent,
              duration: 0.6,
              frequency: melody.getFrequencyForDegree((seed + bar) % SCALES[track.scale].length, instrument.octave - 4),
            });
            break;
        }
      });
    }
  }

  return events;
}

export class MelodyGenerator {
  private rng: SeededRandom;
  private scale: number[];
  private rootFreq: number;

  constructor(seed: number, scaleName: ScaleName, rootNote: string) {
    this.rng = new SeededRandom(seed);
    this.scale = SCALES[scaleName];
    this.rootFreq = NOTE_FREQUENCIES[rootNote] || 220;
  }

  // Get frequency for scale degree
  getFrequencyForDegree(degree: number, octaveShift: number = 0): number {
    const normalizedDegree = ((degree % this.scale.length) + this.scale.length) % this.scale.length;
    const octave = Math.floor(degree / this.scale.length);
    const semitone = this.scale[normalizedDegree];
    return this.rootFreq * Math.pow(2, (semitone + (octave + octaveShift) * 12) / 12);
  }

  getFrequencyForSemitoneOffset(semitoneOffset: number, octaveShift: number = 0): number {
    return this.rootFreq * Math.pow(2, (semitoneOffset + octaveShift * 12) / 12);
  }

  // Generate melody pattern for a phrase
  generatePhrase(bars: number, beatsPerBar: number, style: 'melodic' | 'rhythmic' | 'ambient'): MelodyNote[] {
    const notes: MelodyNote[] = [];
    const totalBeats = bars * beatsPerBar;

    if (style === 'ambient') {
      // Long sustained notes
      for (let beat = 0; beat < totalBeats; beat += 4) {
        notes.push({
          frequency: this.getFrequencyForDegree(this.rng.nextInt(0, this.scale.length - 1)),
          duration: this.rng.next() > 0.5 ? 4 : 2,
          velocity: 0.3 + this.rng.next() * 0.3,
          octaveShift: this.rng.nextInt(-1, 1),
        });
      }
    } else if (style === 'rhythmic') {
      // Short punchy notes
      for (let beat = 0; beat < totalBeats; beat++) {
        if (this.rng.next() > 0.4) {
          notes.push({
            frequency: this.getFrequencyForDegree(this.rng.nextInt(0, this.scale.length - 1)),
            duration: this.rng.pick([0.25, 0.5, 0.5, 1]),
            velocity: 0.5 + this.rng.next() * 0.4,
            octaveShift: this.rng.nextInt(0, 1),
          });
        }
      }
    } else {
      // Melodic - mix of note lengths with stepwise motion
      let currentDegree = this.rng.nextInt(0, 4);
      let beat = 0;
      while (beat < totalBeats) {
        const duration = this.rng.pick([0.5, 1, 1, 2]);
        notes.push({
          frequency: this.getFrequencyForDegree(currentDegree),
          duration,
          velocity: 0.4 + this.rng.next() * 0.4,
          octaveShift: 0,
        });
        beat += duration;
        // Stepwise motion with occasional leaps
        if (this.rng.next() > 0.3) {
          currentDegree += this.rng.pick([-1, 1, -2, 2]);
        } else {
          currentDegree += this.rng.nextInt(-4, 4);
        }
        currentDegree = Math.max(-2, Math.min(currentDegree, this.scale.length + 2));
      }
    }

    return notes;
  }

  // Generate arpeggio pattern
  generateArpeggio(bars: number, beatsPerBar: number, pattern: 'up' | 'down' | 'updown' | 'random'): MelodyNote[] {
    const notes: MelodyNote[] = [];
    const notesPerBeat = 4; // 16th notes
    const totalNotes = bars * beatsPerBar * notesPerBeat;

    const chordDegrees = [0, 2, 4, 5]; // Simplified chord tones
    let patternIndex = 0;

    for (let i = 0; i < totalNotes; i++) {
      let degree: number;

      switch (pattern) {
        case 'up':
          degree = chordDegrees[patternIndex % chordDegrees.length];
          patternIndex++;
          break;
        case 'down':
          degree = chordDegrees[(chordDegrees.length - 1) - (patternIndex % chordDegrees.length)];
          patternIndex++;
          break;
        case 'updown':
          const fullPattern = [...chordDegrees, ...chordDegrees.slice(1, -1).reverse()];
          degree = fullPattern[patternIndex % fullPattern.length];
          patternIndex++;
          break;
        case 'random':
        default:
          degree = this.rng.pick(chordDegrees);
          break;
      }

      // Only play some notes for variation
      if (this.rng.next() > 0.2) {
        notes.push({
          frequency: this.getFrequencyForDegree(degree),
          duration: 1 / notesPerBeat,
          velocity: 0.3 + this.rng.next() * 0.2,
          octaveShift: i % 8 < 4 ? 0 : 1,
        });
      }
    }

    return notes;
  }

  // Generate bass line
  generateBassLine(bars: number, beatsPerBar: number, style: 'driving' | 'walking' | 'simple'): MelodyNote[] {
    const notes: MelodyNote[] = [];
    const rootDegrees = [0, 3, 4, 5]; // Common bass roots

    for (let bar = 0; bar < bars; bar++) {
      const barRoot = rootDegrees[bar % rootDegrees.length];

      if (style === 'driving') {
        // Eighth note pattern on root
        for (let beat = 0; beat < beatsPerBar * 2; beat++) {
          notes.push({
            frequency: this.getFrequencyForDegree(barRoot, -1),
            duration: 0.5,
            velocity: beat % 2 === 0 ? 0.8 : 0.5,
            octaveShift: -1,
          });
        }
      } else if (style === 'walking') {
        // Walking bass with passing tones
        const walkPattern = [barRoot, barRoot + 1, barRoot + 2, barRoot + 3];
        for (let beat = 0; beat < beatsPerBar; beat++) {
          notes.push({
            frequency: this.getFrequencyForDegree(walkPattern[beat % walkPattern.length], -1),
            duration: 1,
            velocity: 0.6 + this.rng.next() * 0.2,
            octaveShift: -1,
          });
        }
      } else {
        // Simple - root on 1 and 3
        for (let beat = 0; beat < beatsPerBar; beat += 2) {
          notes.push({
            frequency: this.getFrequencyForDegree(barRoot, -1),
            duration: 2,
            velocity: 0.7,
            octaveShift: -1,
          });
        }
      }
    }

    return notes;
  }
}

// ============= DETERMINISTIC MUSIC SCHEDULER =============

export interface ScheduledMusicEvent {
  type: 'beat';
  beatNumber: number;
  beatIndex: number;
  barIndex: number;
  phraseIndex: number;
  scheduledTime: number;
}

export interface MusicEventSchedulerOptions {
  bpm: number;
  startTime: number;
  scheduleAheadSeconds?: number;
}

export class MusicEventScheduler {
  private beatDurationSeconds: number;
  private nextBeatNumber: number = 0;
  private nextEventTime: number;
  private readonly scheduleAheadSeconds: number;

  constructor(options: MusicEventSchedulerOptions) {
    this.scheduleAheadSeconds = options.scheduleAheadSeconds ?? 0.5;
    this.beatDurationSeconds = MusicEventScheduler.bpmToBeatDuration(options.bpm);
    this.nextEventTime = options.startTime;
  }

  reset(startTime: number, bpm: number, nextBeatNumber: number = 0): void {
    this.beatDurationSeconds = MusicEventScheduler.bpmToBeatDuration(bpm);
    this.nextBeatNumber = nextBeatNumber;
    this.nextEventTime = startTime;
  }

  setBpm(bpm: number): void {
    this.beatDurationSeconds = MusicEventScheduler.bpmToBeatDuration(bpm);
  }

  poll(currentTime: number): ScheduledMusicEvent[] {
    const events: ScheduledMusicEvent[] = [];
    const horizon = currentTime + this.scheduleAheadSeconds;

    while (this.nextEventTime < horizon) {
      events.push(this.createBeatEvent(this.nextBeatNumber, this.nextEventTime));
      this.nextBeatNumber++;
      this.nextEventTime += this.beatDurationSeconds;
    }

    return events;
  }

  getNextBeatNumber(): number {
    return this.nextBeatNumber;
  }

  getNextEventTime(): number {
    return this.nextEventTime;
  }

  getBeatDurationSeconds(): number {
    return this.beatDurationSeconds;
  }

  private createBeatEvent(beatNumber: number, scheduledTime: number): ScheduledMusicEvent {
    return {
      type: 'beat',
      beatNumber,
      beatIndex: beatNumber % 4,
      barIndex: Math.floor(beatNumber / 4) % 4,
      phraseIndex: Math.floor(beatNumber / 16),
      scheduledTime,
    };
  }

  private static bpmToBeatDuration(bpm: number): number {
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    return 60 / safeBpm;
  }
}

// ============= PROCEDURAL MUSIC ENGINE =============

export class ProceduralMusicEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private dryMixNode: GainNode | null = null;
  private chorusDelayNode: DelayNode | null = null;
  private chorusFeedbackNode: GainNode | null = null;
  private chorusWetNode: GainNode | null = null;
  private masterDynamicsNode: DynamicsCompressorNode | null = null;
  private currentTrack: string | null = null;
  private currentTrackDefinition: TrackDefinition | null = null;
  private isPlaying: boolean = false;
  private intervalId: number | null = null;
  private scheduler: MusicEventScheduler | null = null;
  private activeNodes: AudioNode[] = [];
  private seed: number = Date.now();
  private beatIndex: number = 0;
  private barIndex: number = 0;
  private phraseIndex: number = 0;
  private melodyGenerator: MelodyGenerator | null = null;
  private currentPhrase: MelodyNote[] = [];
  private phraseNoteIndex: number = 0;
  private musicIntensity: number = 1;

  // Reverb and effects
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  // Audio analyzer for visualizer
  private analyserNode: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private timeDomainData: Uint8Array | null = null;

  // Instrument layer controls
  private layerStates: {
    bass: boolean;
    drums: boolean;
    melody: boolean;
    chords: boolean;
    arpeggio: boolean;
    ambience: boolean;
  } = {
    bass: true,
    drums: true,
    melody: true,
    chords: true,
    arpeggio: true,
    ambience: true,
  };

  // Volume control (0-1)
  private volume: number = 1.0;
  private baseGainLevel: number = 0.5; // Base gain level for music
  private readonly schedulerTickMs: number = 25;
  private readonly scheduleAheadSeconds: number = 0.5;

  constructor(context: AudioContext, masterGain: GainNode) {
    this.context = context;
    this.masterGain = masterGain;

    // Create analyzer node for visualizations
    if (context) {
      this.analyserNode = context.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;
      this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.timeDomainData = new Uint8Array(this.analyserNode.frequencyBinCount);
    }
  }

  // ============= AUDIO ANALYZER API =============

  /**
   * Get the AnalyserNode for external visualization
   */
  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Get current frequency data (0-255 values)
   */
  getFrequencyData(): Uint8Array {
    if (this.analyserNode && this.frequencyData) {
      this.analyserNode.getByteFrequencyData(this.frequencyData);
      return this.frequencyData;
    }
    return new Uint8Array(128);
  }

  /**
   * Get current time domain data (waveform, 0-255 values centered at 128)
   */
  getTimeDomainData(): Uint8Array {
    if (this.analyserNode && this.timeDomainData) {
      this.analyserNode.getByteTimeDomainData(this.timeDomainData);
      return this.timeDomainData;
    }
    return new Uint8Array(128);
  }

  /**
   * Get number of frequency bins
   */
  getFrequencyBinCount(): number {
    return this.analyserNode?.frequencyBinCount || 128;
  }

  // ============= INSTRUMENT LAYER CONTROLS =============

  /**
   * Set the enabled state for a specific instrument layer
   */
  setLayerEnabled(layer: keyof typeof this.layerStates, enabled: boolean): void {
    this.layerStates[layer] = enabled;
  }

  /**
   * Toggle an instrument layer on/off
   */
  toggleLayer(layer: keyof typeof this.layerStates): boolean {
    this.layerStates[layer] = !this.layerStates[layer];
    return this.layerStates[layer];
  }

  /**
   * Get the current state of all layers
   */
  getLayerStates(): typeof this.layerStates {
    return { ...this.layerStates };
  }

  /**
   * Check if a specific layer is enabled
   */
  isLayerEnabled(layer: keyof typeof this.layerStates): boolean {
    return this.layerStates[layer];
  }

  /**
   * Enable all layers
   */
  enableAllLayers(): void {
    Object.keys(this.layerStates).forEach(key => {
      this.layerStates[key as keyof typeof this.layerStates] = true;
    });
  }

  /**
   * Disable all layers (mute everything)
   */
  disableAllLayers(): void {
    Object.keys(this.layerStates).forEach(key => {
      this.layerStates[key as keyof typeof this.layerStates] = false;
    });
  }

  /**
   * Solo a specific layer (enable only that layer)
   */
  soloLayer(layer: keyof typeof this.layerStates): void {
    this.disableAllLayers();
    this.layerStates[layer] = true;
  }

  setMusicIntensity(intensity: number): void {
    this.musicIntensity = clampNumber(intensity, 0, 1);
  }

  getMusicIntensity(): number {
    return this.musicIntensity;
  }

  triggerStinger(type: MusicStingerType): void {
    if (!this.context || !this.musicGainNode || !this.melodyGenerator) return;

    const track = this.currentTrackDefinition;
    if (!track) return;

    const now = this.context.currentTime;
    const chord = resolveTrackChord(track, this.barIndex);
    const patch = type === 'danger'
      ? SB32_PATCHES.saw_lead
      : type === 'success'
        ? SB32_PATCHES.bell
        : SB32_PATCHES.synth_brass;
    const tone = type === 'danger'
      ? chord.rootSemitone + 1
      : type === 'success'
        ? chord.tones[chord.tones.length - 1] + 12
        : chord.tones[0] + 12;
    const duration = type === 'transition' ? 0.45 : 0.28;

    this.playPatchNote(
      patch,
      this.melodyGenerator.getFrequencyForSemitoneOffset(tone, 0),
      now,
      duration,
      type === 'danger' ? 0.28 : 0.22,
      {
        type: 'lead',
        waveform: patch.layers[0].waveform,
        octave: 4,
        volume: 0.3,
      },
    );
  }

  // Initialize with new seed
  setSeed(seed: number): void {
    this.seed = seed;
  }

  // Get current playing track
  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  // Check if playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Set music volume (0-1)
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    // Update the music gain node if it exists
    if (this.musicGainNode && this.context) {
      const targetGain = this.baseGainLevel * this.volume;
      // Smooth transition to avoid pops
      this.musicGainNode.gain.setTargetAtTime(
        Math.max(targetGain, 0.0001),
        this.context.currentTime,
        0.1 // Time constant for smooth transition
      );
    }
  }

  // Get current volume
  getVolume(): number {
    return this.volume;
  }

  // Start playing a track
  startTrack(trackName: string, fadeSeconds: number = 0.5): void {
    const track = TRACK_DEFINITIONS[trackName];
    if (!track) {
      console.warn(`Track "${trackName}" not found`);
      return;
    }

    this.startTrackDefinition(trackName, track, fadeSeconds);
  }

  startCustomTrack(trackName: string, track: TrackDefinition, fadeSeconds: number = 0.5): void {
    this.startTrackDefinition(trackName, track, fadeSeconds);
  }

  private startTrackDefinition(trackName: string, track: TrackDefinition, fadeSeconds: number): void {
    if (!this.context || !this.masterGain) return;

    // Stop current if playing
    if (this.isPlaying) {
      this.stopTrack(0.1);
    }

    // Reset state
    this.currentTrack = trackName;
    this.currentTrackDefinition = track;
    this.isPlaying = true;
    this.beatIndex = 0;
    this.barIndex = 0;
    this.phraseIndex = 0;

    // Create melody generator with seed
    this.melodyGenerator = new MelodyGenerator(this.seed, track.scale, track.rootNote);

    // Generate initial phrase
    this.generateNewPhrase(track);

    // Create music gain with fade-in (respecting current volume setting)
    this.musicGainNode = this.context.createGain();
    const targetVolume = this.baseGainLevel * track.intensity * this.volume;
    this.musicGainNode.gain.setValueAtTime(0.0001, this.context.currentTime);
    this.musicGainNode.gain.exponentialRampToValueAtTime(
      Math.max(targetVolume, 0.0001),
      this.context.currentTime + fadeSeconds
    );

    this.setupMixBus(track);
    this.setupEffects(track.effects);

    this.scheduler = new MusicEventScheduler({
      bpm: this.getEffectiveBpm(),
      startTime: this.context.currentTime,
      scheduleAheadSeconds: this.scheduleAheadSeconds,
    });
    this.startScheduler(track);
  }

  // Stop playing
  stopTrack(fadeSeconds: number = 0.5): void {
    if (!this.context) return;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.scheduler = null;

    const nodesToCleanup = [...this.activeNodes];
    const musicGainNodeToCleanup = this.musicGainNode;

    // Fade out
    if (musicGainNodeToCleanup && fadeSeconds > 0) {
      const now = this.context.currentTime;
      musicGainNodeToCleanup.gain.setValueAtTime(musicGainNodeToCleanup.gain.value, now);
      musicGainNodeToCleanup.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    }

    this.activeNodes = [];
    this.musicGainNode = null;
    this.resetRoutingNodeRefs();

    // Cleanup after fade
    setTimeout(() => {
      this.disconnectNodes([...nodesToCleanup, musicGainNodeToCleanup]);
    }, fadeSeconds * 1000 + 100);

    this.isPlaying = false;
    this.currentTrack = null;
    this.currentTrackDefinition = null;
    this.isPaused = false;
    this.pausedTrack = null;
    this.pausedTrackDefinition = null;
  }

  // Pause state
  private isPaused: boolean = false;
  private pausedTrack: string | null = null;
  private pausedTrackDefinition: TrackDefinition | null = null;

  // Pause playing
  pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pausedTrack = this.currentTrack;
    this.pausedTrackDefinition = this.currentTrackDefinition;

    // Stop the interval but keep state
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Fade out quickly
    if (this.context && this.musicGainNode) {
      const now = this.context.currentTime;
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
      this.musicGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.1);
    }
  }

  // Resume playing
  resume(): void {
    if (!this.isPaused || !this.pausedTrack) return;

    const track = this.pausedTrackDefinition ?? TRACK_DEFINITIONS[this.pausedTrack];
    if (!track || !this.context) return;

    this.isPaused = false;

    // Fade back in (respecting current volume setting)
    if (this.musicGainNode) {
      const now = this.context.currentTime;
      const targetVolume = this.baseGainLevel * track.intensity * this.volume;
      this.musicGainNode.gain.setValueAtTime(0.0001, now);
      this.musicGainNode.gain.exponentialRampToValueAtTime(
        Math.max(targetVolume, 0.0001),
        now + 0.2
      );
    }

    const nextBeatNumber = this.scheduler?.getNextBeatNumber() ?? this.getCurrentBeatNumber();
    this.scheduler = new MusicEventScheduler({
      bpm: this.getEffectiveBpm(),
      startTime: this.context.currentTime,
      scheduleAheadSeconds: this.scheduleAheadSeconds,
    });
    this.scheduler.reset(this.context.currentTime, this.getEffectiveBpm(), nextBeatNumber);
    this.startScheduler(track);
  }

  // Check if paused
  getIsPaused(): boolean {
    return this.isPaused;
  }

  // Dynamic BPM override - change tempo in real-time
  private currentBpmOverride: number | null = null;

  /**
   * Set a BPM override for the currently playing track
   * Pass null to reset to the track's default BPM
   */
  setBpmOverride(bpm: number | null): void {
    this.currentBpmOverride = bpm;

    if (this.scheduler) {
      this.scheduler.setBpm(this.getEffectiveBpm());
    }

    // If we're currently playing, make sure the scheduler is running
    if (this.isPlaying && !this.isPaused && this.currentTrack) {
      const track = this.currentTrackDefinition ?? TRACK_DEFINITIONS[this.currentTrack];
      if (track && this.intervalId === null) {
        this.startScheduler(track);
      }
    }
  }

  /**
   * Get the current effective BPM (override or track default)
   */
  getEffectiveBpm(): number {
    if (this.currentBpmOverride !== null) {
      return this.currentBpmOverride;
    }
    if (this.currentTrack) {
      const track = this.currentTrackDefinition ?? TRACK_DEFINITIONS[this.currentTrack];
      return track?.bpm || 120;
    }
    return 120;
  }

  /**
   * Get the BPM override value (null if using track default)
   */
  getBpmOverride(): number | null {
    return this.currentBpmOverride;
  }

  /**
   * Reset BPM to track's default
   */
  resetBpm(): void {
    this.setBpmOverride(null);
  }

  private setupMixBus(track: TrackDefinition): void {
    if (!this.context || !this.musicGainNode || !this.masterGain) return;

    this.dryMixNode = this.context.createGain();
    this.dryMixNode.gain.value = 0.88;
    this.dryMixNode.connect(this.musicGainNode);

    this.setupChorusBus(track);
    this.connectMusicBusToMaster();

    this.activeNodes.push(this.dryMixNode);
  }

  private setupChorusBus(track: TrackDefinition): void {
    if (!this.context || !this.musicGainNode) return;
    if (typeof this.context.createDelay !== 'function') return;

    this.chorusDelayNode = this.context.createDelay(0.08);
    this.chorusDelayNode.delayTime.value = track.mood === 'chill' || track.mood === 'mysterious' ? 0.028 : 0.018;

    this.chorusFeedbackNode = this.context.createGain();
    this.chorusFeedbackNode.gain.value = 0.12;

    this.chorusWetNode = this.context.createGain();
    this.chorusWetNode.gain.value = track.mood === 'chill' || track.mood === 'mysterious' ? 0.28 : 0.18;

    this.chorusDelayNode.connect(this.chorusFeedbackNode);
    this.chorusFeedbackNode.connect(this.chorusDelayNode);
    this.chorusDelayNode.connect(this.chorusWetNode);
    this.chorusWetNode.connect(this.musicGainNode);

    this.activeNodes.push(this.chorusDelayNode, this.chorusFeedbackNode, this.chorusWetNode);
  }

  private connectMusicBusToMaster(): void {
    if (!this.context || !this.musicGainNode || !this.masterGain) return;

    let outputNode: AudioNode = this.musicGainNode;

    if (typeof this.context.createDynamicsCompressor === 'function') {
      this.masterDynamicsNode = this.context.createDynamicsCompressor();
      this.masterDynamicsNode.threshold.value = -16;
      this.masterDynamicsNode.knee.value = 18;
      this.masterDynamicsNode.ratio.value = 4;
      this.masterDynamicsNode.attack.value = 0.006;
      this.masterDynamicsNode.release.value = 0.18;
      outputNode.connect(this.masterDynamicsNode);
      outputNode = this.masterDynamicsNode;
      this.activeNodes.push(this.masterDynamicsNode);
    }

    if (this.analyserNode) {
      outputNode.connect(this.analyserNode);
      this.analyserNode.connect(this.masterGain);
    } else {
      outputNode.connect(this.masterGain);
    }
  }

  // Setup audio effects
  private setupEffects(effects: EffectConfig): void {
    if (!this.context || !this.musicGainNode || !this.masterGain) return;

    // Reverb
    if (effects.reverb > 0) {
      this.createReverb(effects.reverb);
    }

    // Delay
    if (effects.delay > 0) {
      this.createDelay(effects.delay);
    }
  }

  // Create reverb effect
  private createReverb(amount: number): void {
    if (!this.context || !this.musicGainNode || !this.masterGain) return;

    const sampleRate = this.context.sampleRate;
    const length = sampleRate * 2.5;
    const impulse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }

    this.reverbNode = this.context.createConvolver();
    this.reverbNode.buffer = impulse;

    this.reverbGain = this.context.createGain();
    this.reverbGain.gain.value = amount;

    this.musicGainNode.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    this.activeNodes.push(this.reverbNode, this.reverbGain);
  }

  // Create delay effect
  private createDelay(amount: number): void {
    if (!this.context || !this.musicGainNode || !this.masterGain) return;

    this.delayNode = this.context.createDelay(1.0);
    this.delayNode.delayTime.value = 0.375; // 3/8 beat delay

    this.delayFeedback = this.context.createGain();
    this.delayFeedback.gain.value = 0.3;

    const delayWet = this.context.createGain();
    delayWet.gain.value = amount;

    this.musicGainNode.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(delayWet);
    delayWet.connect(this.masterGain);

    this.activeNodes.push(this.delayNode, this.delayFeedback, delayWet);
  }

  // Cleanup all active nodes
  private cleanupNodes(): void {
    this.disconnectNodes([...this.activeNodes, this.musicGainNode]);
    this.activeNodes = [];
    this.musicGainNode = null;
    this.resetRoutingNodeRefs();
  }

  private disconnectNodes(nodes: Array<AudioNode | null>): void {
    nodes.forEach(node => {
      if (!node) return;
      try {
        node.disconnect();
      } catch { /* ignore */ }
    });
  }

  private resetRoutingNodeRefs(): void {
    this.activeNodes = [];
    this.reverbNode = null;
    this.reverbGain = null;
    this.delayNode = null;
    this.delayFeedback = null;
    this.dryMixNode = null;
    this.chorusDelayNode = null;
    this.chorusFeedbackNode = null;
    this.chorusWetNode = null;
    this.masterDynamicsNode = null;
  }

  // Generate new phrase for variation
  private generateNewPhrase(track: TrackDefinition): void {
    this.currentPhrase = buildPhrasePlan(track, this.seed, this.phraseIndex).notes;
    this.phraseNoteIndex = 0;
  }

  private startScheduler(track: TrackDefinition): void {
    if (!this.context || !this.scheduler) return;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }

    this.processScheduledEvents(track);
    this.intervalId = window.setInterval(() => {
      this.processScheduledEvents(track);
    }, this.schedulerTickMs);
  }

  private processScheduledEvents(track: TrackDefinition): void {
    if (!this.isPlaying || !this.context || this.isPaused || !this.scheduler) return;

    const events = this.scheduler.poll(this.context.currentTime);
    events.forEach(event => {
      this.playScheduledBeat(track, event);
    });
  }

  private getCurrentBeatNumber(): number {
    return this.phraseIndex * 16 + this.barIndex * 4 + this.beatIndex;
  }

  // Play a single deterministic scheduler event
  private playScheduledBeat(track: TrackDefinition, event: ScheduledMusicEvent): void {
    this.beatIndex = event.beatIndex;
    this.barIndex = event.barIndex;
    this.phraseIndex = event.phraseIndex;

    if (event.beatNumber > 0 && event.beatIndex === 0 && event.barIndex === 0) {
      this.generateNewPhrase(track);

      if (event.phraseIndex % 4 === 3) {
        this.playRiser(track, event.scheduledTime);
      }
    }

    this.playBeat(track, event.scheduledTime);
  }

  // Play a single beat
  private playBeat(track: TrackDefinition, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const intensityLayers = getActiveMusicLayersForIntensity(this.musicIntensity);

    // Play each instrument (respecting layer states)
    track.instruments.forEach(instrument => {
      switch (instrument.type) {
        case 'bass':
          if (this.layerStates.bass && intensityLayers.bass) {
            this.playBass(track, instrument, now);
          }
          break;
        case 'lead':
          if (this.layerStates.melody && intensityLayers.melody) {
            this.playLead(track, instrument, now);
          }
          break;
        case 'pad':
          if (this.layerStates.chords && intensityLayers.chords) {
            this.playPad(track, instrument, now);
          }
          break;
        case 'arp':
          if (this.layerStates.arpeggio && intensityLayers.arpeggio) {
            this.playArp(track, instrument, now);
          }
          break;
        case 'drums':
          if (this.layerStates.drums && intensityLayers.drums) {
            this.playDrums(track, instrument, now);
          }
          break;
        case 'fx':
          if (this.layerStates.ambience && intensityLayers.ambience) {
            this.playFx(track, instrument, now);
          }
          break;
      }
    });
  }

  private playPatchNote(
    patch: InstrumentPatch,
    frequency: number,
    now: number,
    duration: number,
    volume: number,
    config: InstrumentConfig,
    detuneOffsetCents: number = 0,
  ): void {
    if (!this.context || !this.musicGainNode) return;

    const safeDuration = Math.max(0.03, duration);
    const safeVolume = Math.max(0, Math.min(1, volume));

    patch.layers.forEach((layer) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const layerFrequency = frequency * Math.pow(2, layer.octaveOffset ?? 0);
      const layerGain = safeVolume * layer.gain;

      osc.type = layer.waveform;
      osc.frequency.setValueAtTime(layerFrequency, now);
      osc.detune.setValueAtTime((layer.detuneCents ?? 0) + detuneOffsetCents, now);

      let outputNode: AudioNode = osc;
      const filterConfig = config.filter ?? layer.filter;
      if (filterConfig) {
        const filter = this.context!.createBiquadFilter();
        filter.type = filterConfig.type;
        filter.frequency.setValueAtTime(filterConfig.frequency, now);
        filter.Q.value = 'q' in filterConfig ? filterConfig.q : filterConfig.Q;
        osc.connect(filter);
        outputNode = filter;
      }

      const attackEnd = now + Math.max(0.001, layer.attack);
      const decayEnd = attackEnd + Math.max(0.001, layer.decay);
      const releaseStart = now + Math.max(0.01, safeDuration - layer.release);
      const releaseEnd = now + safeDuration;
      const sustainGain = Math.max(0.0001, layerGain * layer.sustain);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.max(layerGain, 0.0001), attackEnd);
      gain.gain.linearRampToValueAtTime(sustainGain, Math.min(decayEnd, releaseStart));
      gain.gain.setValueAtTime(sustainGain, releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

      outputNode.connect(gain);
      const routedNodes = this.connectPatchOutput(gain, patch);

      this.applyPatchVibrato(osc, patch, now, safeDuration);

      osc.start(now);
      osc.stop(releaseEnd + 0.05);

      setTimeout(() => {
        [gain, ...routedNodes].forEach(node => {
          try {
            node.disconnect();
          } catch { /* ignore disconnected note routing */ }
        });
      }, Math.max(0, (releaseEnd - this.context!.currentTime) * 1000 + 100));
    });
  }

  private connectPatchOutput(source: AudioNode, patch: InstrumentPatch): AudioNode[] {
    if (!this.context || !this.musicGainNode) return [];

    const mixProfile = getPatchMixProfile(patch);
    const channelGain = this.context.createGain();
    channelGain.gain.value = mixProfile.channelGain;
    const routedNodes: AudioNode[] = [channelGain];

    let routedSource: AudioNode = source;
    if (typeof this.context.createStereoPanner === 'function' && patch.pan !== undefined) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, patch.pan));
      source.connect(panner);
      routedSource = panner;
      routedNodes.push(panner);
    }

    routedSource.connect(channelGain);
    channelGain.connect(this.dryMixNode ?? this.musicGainNode);

    if (this.chorusDelayNode && mixProfile.chorusSend > 0) {
      const chorusSend = this.context.createGain();
      chorusSend.gain.value = mixProfile.chorusSend;
      channelGain.connect(chorusSend);
      chorusSend.connect(this.chorusDelayNode);
      routedNodes.push(chorusSend);
    }

    return routedNodes;
  }

  private applyPatchVibrato(
    osc: OscillatorNode,
    patch: InstrumentPatch,
    now: number,
    duration: number,
  ): void {
    if (!this.context || !patch.vibrato) return;

    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(patch.vibrato.rate, now);
    lfoGain.gain.setValueAtTime(patch.vibrato.depthCents, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    lfo.start(now);
    lfo.stop(now + duration + 0.05);
  }

  // Play bass instrument
  private playBass(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode || !this.melodyGenerator) return;

    // Play on beats 1 and 3 for most styles, every beat for intense
    const playOnBeat = track.mood === 'intense' || track.mood === 'energetic'
      ? true
      : this.beatIndex === 0 || this.beatIndex === 2;

    if (!playOnBeat) return;

    const chord = resolveTrackChord(track, this.barIndex);
    const duration = track.mood === 'intense' ? 0.2 : 0.4;
    const frequency = this.melodyGenerator.getFrequencyForSemitoneOffset(chord.rootSemitone, config.octave - 3);

    this.playPatchNote(getPatchForInstrument(config, track), frequency, now, duration, config.volume, config);
  }

  // Play lead melody
  private playLead(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    // Get note from pre-generated phrase
    if (this.phraseNoteIndex >= this.currentPhrase.length) {
      this.phraseNoteIndex = 0;
    }

    const note = this.currentPhrase[this.phraseNoteIndex];
    if (!note) return;

    const duration = note.duration * (60 / this.getEffectiveBpm());
    const frequency = note.frequency * Math.pow(2, config.octave - 4);

    this.playPatchNote(
      getPatchForInstrument(config, track),
      frequency,
      now,
      duration,
      config.volume * note.velocity,
      config,
    );

    this.phraseNoteIndex++;
  }

  // Play pad/chord
  private playPad(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode || !this.melodyGenerator) return;

    // Only play on beat 1
    if (this.beatIndex !== 0) return;

    const chord = resolveTrackChord(track, this.barIndex);

    chord.tones.forEach((tone, i) => {
      const duration = (60 / this.getEffectiveBpm()) * 4; // Full bar
      const frequency = this.melodyGenerator!.getFrequencyForSemitoneOffset(tone, config.octave - 4);

      this.playPatchNote(
        getPatchForInstrument(config, track),
        frequency,
        now,
        duration,
        config.volume * 0.7,
        config,
        (i - 1) * 5,
      );
    });
  }

  // Play arpeggio
  private playArp(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode || !this.melodyGenerator) return;

    const chord = resolveTrackChord(track, this.barIndex);
    const pattern = [0, 1, 2, 1];
    const tone = chord.tones[pattern[this.beatIndex] % chord.tones.length];

    const duration = 0.15;
    const frequency = this.melodyGenerator.getFrequencyForSemitoneOffset(tone, config.octave - 4);

    this.playPatchNote(getPatchForInstrument(config, track), frequency, now, duration, config.volume, config);
  }

  // Play drums
  private playDrums(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode) return;
    const volume = config.volume;

    // Kick on 1 and 3
    if (this.beatIndex === 0 || this.beatIndex === 2) {
      this.playKick(now, volume);
    }

    // Snare/clap on 2 and 4
    if (this.beatIndex === 1 || this.beatIndex === 3) {
      this.playSnare(now, volume * 0.6);
    }

    // Hi-hat on every beat
    this.playHiHat(now, volume * 0.2);

    // Open hi-hat accent
    if (this.beatIndex === 1) {
      this.playOpenHiHat(now, volume * 0.15);
    }
  }

  // Play FX layer
  private playFx(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    // Only occasionally play fx
    if (Math.random() > 0.3) return;
    if (this.beatIndex !== 0) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = config.waveform;
    osc.frequency.value = 880 + Math.random() * 440;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(config.volume * 0.5, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Drum components
  private playKick(now: number, volume: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + 0.25);

    // Click transient
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.value = 1000;
    clickGain.gain.setValueAtTime(volume * 0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    click.connect(clickGain);
    clickGain.connect(this.musicGainNode);
    click.start(now);
    click.stop(now + 0.02);
  }

  private playSnare(now: number, volume: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.musicGainNode);
    osc.start(now);
    osc.stop(now + 0.12);

    // Noise
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1;

    noiseGain.gain.setValueAtTime(volume * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.musicGainNode);

    noise.start(now);
  }

  private playHiHat(now: number, volume: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode);

    noise.start(now);
  }

  private playOpenHiHat(now: number, volume: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode);

    noise.start(now);
  }

  // Play riser/build-up
  private playRiser(track: TrackDefinition, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const duration = (60 / this.getEffectiveBpm()) * 4 * 4; // 4 bars

    // Noise riser
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noiseFilter.type = 'bandpass';
    noiseFilter.Q.value = 5;
    noiseFilter.frequency.setValueAtTime(200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(8000, now + duration);

    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.15 * track.intensity, now + duration * 0.9);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.musicGainNode);

    noise.start(now);

    // Pitched sweep
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();

    sweepOsc.type = 'sawtooth';
    sweepOsc.frequency.setValueAtTime(NOTE_FREQUENCIES[track.rootNote] || 220, now);
    sweepOsc.frequency.exponentialRampToValueAtTime((NOTE_FREQUENCIES[track.rootNote] || 220) * 4, now + duration);

    sweepGain.gain.setValueAtTime(0.001, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.1 * track.intensity, now + duration * 0.8);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    sweepOsc.connect(sweepGain);
    sweepGain.connect(this.musicGainNode);

    sweepOsc.start(now);
    sweepOsc.stop(now + duration + 0.1);
  }
}

// ============= HELPER FUNCTIONS =============

export function getTracksForGame(gameId: string): { primary: TrackDefinition; secondary: TrackDefinition } {
  const mapping = GAME_TRACK_MAPPING[gameId];
  if (!mapping) {
    // Default to hub tracks
    return {
      primary: TRACK_DEFINITIONS['arcade_retro'],
      secondary: TRACK_DEFINITIONS['arcade_bounce'],
    };
  }
  return {
    primary: TRACK_DEFINITIONS[mapping.primary],
    secondary: TRACK_DEFINITIONS[mapping.secondary],
  };
}

export function getHubTrack(variation: 'welcome' | 'ambient' | 'energetic' = 'welcome'): TrackDefinition {
  return TRACK_DEFINITIONS[`hub_${variation}`];
}

export function getAllTrackNames(): string[] {
  return Object.keys(TRACK_DEFINITIONS);
}

export function getTrackDefinition(name: string): TrackDefinition | undefined {
  return TRACK_DEFINITIONS[name];
}
