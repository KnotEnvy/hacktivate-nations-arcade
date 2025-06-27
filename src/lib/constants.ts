// ===== src/lib/constants.ts (UPDATED) =====
export const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  TARGET_FPS: 60,
  CURRENCY_RATE: 250, // coins per active minute
} as const;

export const UNLOCK_COSTS = {
  0: 0,     // Runner (default)
  1: 2000,  // +1 game
  2: 5000,  // +2 games
  3: 10000, // tier 3
  4: 20000, // tier 4
} as const;

export const ECONOMY = {
  SCORE_TO_COINS_RATIO: 100, // floor(score/100)
  PICKUP_COIN_VALUE: 10,
  DAILY_CHALLENGE_MULTIPLIER: 1.5,
} as const;

export const PERFORMANCE = {
  MAX_ASSET_SIZE_KB: 300,
  TARGET_FCP_MS: 2000,
  TARGET_GAME_LOAD_MS: 500,
} as const;

export const COLORS = {
  primary: '#8B5CF6',     // Purple
  secondary: '#06B6D4',   // Cyan  
  accent: '#F59E0B',      // Amber
  success: '#10B981',     // Emerald
  danger: '#EF4444',      // Red
  dark: '#1F2937',        // Gray-800
  light: '#F9FAFB',       // Gray-50
} as const;

// NEW: Audio Configuration
export const AUDIO_CONFIG = {
  // Master volume settings
  MASTER_VOLUME: 1.0,
  SFX_VOLUME: 1.0,
  MUSIC_VOLUME: 0.7,
  
  // Audio context settings
  SAMPLE_RATE: 44100,
  BUFFER_SIZE: 4096,
  
  // Sound effect durations (in seconds)
  SOUND_DURATIONS: {
    JUMP: 0.2,
    COIN: 0.3,
    POWERUP: 0.5,
    GAME_OVER: 1.0,
    CLICK: 0.1,
    UNLOCK: 0.8,
    COLLISION: 0.4,
    SUCCESS: 0.6,
  },
  
  // Sound effect parameters for procedural generation
  SOUND_PARAMS: {
    JUMP: {
      startFreq: 200,
      endFreq: 600,
      decay: 8,
      volume: 0.3,
    },
    COIN: {
      startFreq: 800,
      modulationFreq: 30,
      modulationDepth: 400,
      decay: 6,
      volume: 0.4,
    },
    POWERUP: {
      startFreq: 400,
      endFreq: 1200,
      envelope: 'sine',
      volume: 0.5,
    },
    GAME_OVER: {
      startFreq: 300,
      endFreq: 100,
      decay: 2,
      volume: 0.6,
    },
    CLICK: {
      noiseDecay: 50,
      volume: 0.2,
    },
    UNLOCK: {
      startFreq: 440,
      octaves: 2,
      harmonics: 3,
      volume: 0.4,
    },
    COLLISION: {
      startFreq: 100,
      endFreq: 50,
      decay: 5,
      volume: 0.7,
    },
    SUCCESS: {
      chord: [440, 554, 659], // A major chord
      decay: 3,
      volume: 0.5,
    },
  },
  
  // Audio loading and caching
  MAX_CONCURRENT_SOUNDS: 8,
  SOUND_CACHE_SIZE: 50,
  PRELOAD_SOUNDS: ['jump', 'coin', 'click'],
  
  // Future music system
  MUSIC_FADE_DURATION: 1.0,
  MUSIC_LOOP_ENABLED: true,
  MUSIC_CROSSFADE_ENABLED: false,
  
  // Game-specific audio settings
  GAME_AUDIO_PROFILES: {
    runner: {
      sfxVolume: 1.0,
      musicVolume: 0.6,
      prioritySounds: ['jump', 'coin', 'collision'],
    },
    puzzle: {
      sfxVolume: 0.8,
      musicVolume: 0.8,
      prioritySounds: ['click', 'success', 'game_over'],
    },
    // Future games can add their profiles here
    space: {
      sfxVolume: 1.0,
      musicVolume: 0.5,
      prioritySounds: ['shoot', 'explosion', 'powerup'],
    },
  },
} as const;

// Audio utility types for type safety
export type SoundName = keyof typeof AUDIO_CONFIG.SOUND_PARAMS;
export type GameAudioProfile = keyof typeof AUDIO_CONFIG.GAME_AUDIO_PROFILES;