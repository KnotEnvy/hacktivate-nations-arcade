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

// ============= PREDEFINED TRACKS =============

export const TRACK_DEFINITIONS: Record<string, TrackDefinition> = {
  // ========== HUB/MENU TRACKS (3 variations) ==========

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
  'bubble-pop': { primary: 'casual_playful', secondary: 'arcade_bounce' },

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

// ============= PROCEDURAL MUSIC ENGINE =============

export class ProceduralMusicEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private currentTrack: string | null = null;
  private isPlaying: boolean = false;
  private intervalId: number | null = null;
  private activeNodes: AudioNode[] = [];
  private seed: number = Date.now();
  private beatIndex: number = 0;
  private barIndex: number = 0;
  private phraseIndex: number = 0;
  private melodyGenerator: MelodyGenerator | null = null;
  private currentPhrase: MelodyNote[] = [];
  private phraseNoteIndex: number = 0;

  // Reverb and effects
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  constructor(context: AudioContext, masterGain: GainNode) {
    this.context = context;
    this.masterGain = masterGain;
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

  // Start playing a track
  startTrack(trackName: string, fadeSeconds: number = 0.5): void {
    if (!this.context || !this.masterGain) return;

    // Stop current if playing
    if (this.isPlaying) {
      this.stopTrack(0.1);
    }

    const track = TRACK_DEFINITIONS[trackName];
    if (!track) {
      console.warn(`Track "${trackName}" not found`);
      return;
    }

    // Reset state
    this.currentTrack = trackName;
    this.isPlaying = true;
    this.beatIndex = 0;
    this.barIndex = 0;
    this.phraseIndex = 0;

    // Create melody generator with seed
    this.melodyGenerator = new MelodyGenerator(this.seed, track.scale, track.rootNote);

    // Generate initial phrase
    this.generateNewPhrase(track);

    // Create music gain with fade-in
    this.musicGainNode = this.context.createGain();
    const targetVolume = 0.5 * track.intensity;
    this.musicGainNode.gain.setValueAtTime(0.0001, this.context.currentTime);
    this.musicGainNode.gain.exponentialRampToValueAtTime(
      Math.max(targetVolume, 0.0001),
      this.context.currentTime + fadeSeconds
    );
    this.musicGainNode.connect(this.masterGain);

    // Setup effects
    this.setupEffects(track.effects);

    // Calculate beat duration from BPM
    const beatDuration = 60000 / track.bpm;

    // Start music loop
    this.intervalId = window.setInterval(() => {
      if (!this.isPlaying || !this.context) return;
      this.playBeat(track);
    }, beatDuration);

    // Play first beat immediately
    this.playBeat(track);
  }

  // Stop playing
  stopTrack(fadeSeconds: number = 0.5): void {
    if (!this.context) return;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Fade out
    if (this.musicGainNode && fadeSeconds > 0) {
      const now = this.context.currentTime;
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
      this.musicGainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    }

    // Cleanup after fade
    setTimeout(() => {
      this.cleanupNodes();
    }, fadeSeconds * 1000 + 100);

    this.isPlaying = false;
    this.currentTrack = null;
    this.isPaused = false;
  }

  // Pause state
  private isPaused: boolean = false;
  private pausedTrack: string | null = null;

  // Pause playing
  pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pausedTrack = this.currentTrack;

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

    const track = TRACK_DEFINITIONS[this.pausedTrack];
    if (!track || !this.context) return;

    this.isPaused = false;

    // Fade back in
    if (this.musicGainNode) {
      const now = this.context.currentTime;
      const targetVolume = 0.5 * track.intensity;
      this.musicGainNode.gain.setValueAtTime(0.0001, now);
      this.musicGainNode.gain.exponentialRampToValueAtTime(
        Math.max(targetVolume, 0.0001),
        now + 0.2
      );
    }

    // Restart the beat loop
    const beatDuration = 60000 / track.bpm;
    this.intervalId = window.setInterval(() => {
      if (!this.isPlaying || !this.context || this.isPaused) return;
      this.playBeat(track);
    }, beatDuration);
  }

  // Check if paused
  getIsPaused(): boolean {
    return this.isPaused;
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
    this.activeNodes.forEach(node => {
      try {
        node.disconnect();
      } catch { /* ignore */ }
    });
    this.activeNodes = [];
    this.reverbNode = null;
    this.reverbGain = null;
    this.delayNode = null;
    this.delayFeedback = null;
  }

  // Generate new phrase for variation
  private generateNewPhrase(track: TrackDefinition): void {
    if (!this.melodyGenerator) return;

    const style = track.mood === 'intense' || track.mood === 'energetic' ? 'rhythmic' :
                  track.mood === 'chill' || track.mood === 'mysterious' ? 'ambient' : 'melodic';

    this.currentPhrase = this.melodyGenerator.generatePhrase(4, 4, style);
    this.phraseNoteIndex = 0;
  }

  // Play a single beat
  private playBeat(track: TrackDefinition): void {
    if (!this.context || !this.musicGainNode) return;

    const now = this.context.currentTime;

    // Play each instrument
    track.instruments.forEach(instrument => {
      switch (instrument.type) {
        case 'bass':
          this.playBass(track, instrument, now);
          break;
        case 'lead':
          this.playLead(track, instrument, now);
          break;
        case 'pad':
          this.playPad(track, instrument, now);
          break;
        case 'arp':
          this.playArp(track, instrument, now);
          break;
        case 'drums':
          this.playDrums(track, instrument, now);
          break;
        case 'fx':
          this.playFx(track, instrument, now);
          break;
      }
    });

    // Update beat counters
    this.beatIndex++;
    if (this.beatIndex >= 4) {
      this.beatIndex = 0;
      this.barIndex++;

      if (this.barIndex >= 4) {
        this.barIndex = 0;
        this.phraseIndex++;

        // Generate new phrase every 4 bars for variation
        this.generateNewPhrase(track);

        // Play riser before phrase 4
        if (this.phraseIndex % 4 === 3) {
          this.playRiser(track, now);
        }
      }
    }
  }

  // Play bass instrument
  private playBass(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode || !this.melodyGenerator) return;

    // Play on beats 1 and 3 for most styles, every beat for intense
    const playOnBeat = track.mood === 'intense' || track.mood === 'energetic'
      ? true
      : this.beatIndex === 0 || this.beatIndex === 2;

    if (!playOnBeat) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = config.waveform;

    // Get bass note from scale
    const rootDegrees = [0, 3, 4, 5];
    const degree = rootDegrees[this.barIndex % rootDegrees.length];
    osc.frequency.value = this.melodyGenerator.getFrequencyForDegree(degree, config.octave - 3);

    // Optional filter
    let outputNode: AudioNode = osc;
    if (config.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = config.filter.type;
      filter.frequency.value = config.filter.frequency;
      filter.Q.value = config.filter.Q;
      osc.connect(filter);
      outputNode = filter;
    }

    // Envelope
    const duration = track.mood === 'intense' ? 0.2 : 0.4;
    gain.gain.setValueAtTime(config.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    outputNode.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + duration + 0.1);
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

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = config.waveform;
    osc.frequency.value = note.frequency * Math.pow(2, config.octave - 4);

    // Optional filter
    let outputNode: AudioNode = osc;
    if (config.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = config.filter.type;
      filter.frequency.setValueAtTime(config.filter.frequency, now);
      filter.frequency.exponentialRampToValueAtTime(config.filter.frequency * 0.5, now + 0.2);
      filter.Q.value = config.filter.Q;
      osc.connect(filter);
      outputNode = filter;
    }

    // Envelope with velocity
    const duration = note.duration * (60 / track.bpm);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(config.volume * note.velocity, now + 0.02);
    gain.gain.setValueAtTime(config.volume * note.velocity * 0.8, now + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    outputNode.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + duration + 0.1);

    this.phraseNoteIndex++;
  }

  // Play pad/chord
  private playPad(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode || !this.melodyGenerator) return;

    // Only play on beat 1
    if (this.beatIndex !== 0) return;

    const ctx = this.context;

    // Simple triad
    const chordDegrees = [0, 2, 4];
    const barRoot = [0, 3, 4, 5][this.barIndex % 4];

    chordDegrees.forEach((degree, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = config.waveform;
      osc.frequency.value = this.melodyGenerator!.getFrequencyForDegree(barRoot + degree, config.octave - 4);
      osc.detune.value = (i - 1) * 5; // Slight detune for warmth

      // Long sustain
      const duration = (60 / track.bpm) * 4; // Full bar
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(config.volume * 0.7, now + 0.1);
      gain.gain.setValueAtTime(config.volume * 0.6, now + duration * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.musicGainNode!);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  // Play arpeggio
  private playArp(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode || !this.melodyGenerator) return;

    const ctx = this.context;

    // Arpeggio pattern based on beat
    const patterns = [0, 2, 4, 2]; // Up-down pattern
    const barRoot = [0, 3, 4, 5][this.barIndex % 4];
    const degree = barRoot + patterns[this.beatIndex];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = config.waveform;
    osc.frequency.value = this.melodyGenerator.getFrequencyForDegree(degree, config.octave - 4);

    // Optional filter
    let outputNode: AudioNode = osc;
    if (config.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = config.filter.type;
      filter.frequency.value = config.filter.frequency;
      filter.Q.value = config.filter.Q;
      osc.connect(filter);
      outputNode = filter;
    }

    // Short staccato
    const duration = 0.15;
    gain.gain.setValueAtTime(config.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    outputNode.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // Play drums
  private playDrums(track: TrackDefinition, config: InstrumentConfig, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
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
    const duration = (60 / track.bpm) * 4 * 4; // 4 bars

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
