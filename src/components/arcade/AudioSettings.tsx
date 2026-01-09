// ===== src/components/arcade/AudioSettings.tsx =====
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioManager } from '@/services/AudioManager';
import { SCALES } from '@/services/ProceduralMusicEngine';
import { AchievementService } from '@/services/AchievementService';

interface AudioSettingsProps {
  audioManager: AudioManager;
  isOpen: boolean;
  onClose: () => void;
  achievementService?: AchievementService;
}

// Track mood icons and colors
const MOOD_CONFIG: Record<string, { icon: string; color: string; description: string }> = {
  energetic: { icon: '⚡', color: 'text-yellow-400', description: 'High energy, upbeat' },
  chill: { icon: '🌙', color: 'text-blue-400', description: 'Relaxed, ambient' },
  intense: { icon: '🔥', color: 'text-red-500', description: 'Fast-paced, aggressive' },
  focus: { icon: '🎯', color: 'text-cyan-400', description: 'Concentrated, minimal' },
  retro: { icon: '👾', color: 'text-green-400', description: 'Classic arcade vibes' },
  mysterious: { icon: '🌌', color: 'text-purple-400', description: 'Dark, atmospheric' },
  epic: { icon: '⚔️', color: 'text-orange-400', description: 'Grand, heroic' },
  playful: { icon: '🎈', color: 'text-pink-400', description: 'Fun, lighthearted' },
};

// Scale display names - organized by category
const SCALE_NAMES: Record<string, { name: string; emoji: string; category: string }> = {
  // Classic modes
  major: { name: 'Major', emoji: '🌞', category: 'classic' },
  minor: { name: 'Minor', emoji: '🌙', category: 'classic' },
  dorian: { name: 'Dorian', emoji: '🎷', category: 'classic' },
  phrygian: { name: 'Phrygian', emoji: '🏜️', category: 'classic' },
  lydian: { name: 'Lydian', emoji: '✨', category: 'classic' },
  mixolydian: { name: 'Mixolydian', emoji: '🎸', category: 'classic' },

  // Pentatonic & Blues
  majorPentatonic: { name: 'Major Penta', emoji: '🎵', category: 'pentatonic' },
  minorPentatonic: { name: 'Minor Penta', emoji: '🎹', category: 'pentatonic' },
  blues: { name: 'Blues', emoji: '🎺', category: 'pentatonic' },

  // Harmonic variations
  harmonicMinor: { name: 'Harmonic Min', emoji: '🎭', category: 'harmonic' },
  melodicMinor: { name: 'Melodic Min', emoji: '🎼', category: 'harmonic' },

  // Symmetric & experimental
  wholeTone: { name: 'Whole Tone', emoji: '🌀', category: 'experimental' },
  diminished: { name: 'Diminished', emoji: '⚡', category: 'experimental' },
  augmented: { name: 'Augmented', emoji: '🔮', category: 'experimental' },
  prometheus: { name: 'Prometheus', emoji: '🔥', category: 'experimental' },
  enigmatic: { name: 'Enigmatic', emoji: '❓', category: 'experimental' },

  // World music
  japanese: { name: 'Japanese', emoji: '🎋', category: 'world' },
  hungarian: { name: 'Hungarian', emoji: '🎻', category: 'world' },
  arabian: { name: 'Arabian', emoji: '🕌', category: 'world' },
  egyptian: { name: 'Egyptian', emoji: '🏛️', category: 'world' },
  hirajoshi: { name: 'Hirajoshi', emoji: '🌸', category: 'world' },
  insen: { name: 'Insen', emoji: '🍃', category: 'world' },

  // Game-specific
  darkSynth: { name: 'Dark Synth', emoji: '🖤', category: 'game' },
  spaceAmbient: { name: 'Space', emoji: '🚀', category: 'game' },
};

// Scale category labels for advanced mode
const SCALE_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  classic: { label: 'Classic Modes', emoji: '🎼' },
  pentatonic: { label: 'Pentatonic', emoji: '🎵' },
  harmonic: { label: 'Harmonic', emoji: '🎭' },
  experimental: { label: 'Experimental', emoji: '🔮' },
  world: { label: 'World Music', emoji: '🌍' },
  game: { label: 'Game Vibes', emoji: '🎮' },
};

// Root note options
const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ============= FAVORITES SYSTEM =============

interface MusicFavorite {
  id: string;
  name: string;
  seed: number;
  bpm: number;
  intensity: number;
  mood: string;
  scale: string;
  rootNote: string;
  createdAt: number;
}

const FAVORITES_STORAGE_KEY = 'hacktivate_music_lab_favorites';
const MAX_FAVORITES = 20;

// Load favorites from localStorage
const loadFavorites = (): MusicFavorite[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save favorites to localStorage
const saveFavoritesToStorage = (favorites: MusicFavorite[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites.slice(0, MAX_FAVORITES)));
  } catch {
    // Storage full or unavailable
  }
};

// Generate a unique ID
const generateFavoriteId = (): string => {
  return `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============= PER-GAME MUSIC CUSTOMIZATION =============

interface GameMusicPreference {
  gameId: string;
  type: 'track' | 'favorite' | 'custom';
  trackName?: string;       // For type 'track'
  favoriteId?: string;      // For type 'favorite'
  customConfig?: {          // For type 'custom'
    seed: number;
    bpm: number;
    mood: string;
    scale: string;
    rootNote: string;
    intensity: number;
  };
}

const GAME_MUSIC_PREFS_KEY = 'hacktivate_game_music_prefs';

// Load game music preferences
const loadGameMusicPrefs = (): Record<string, GameMusicPreference> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(GAME_MUSIC_PREFS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Save game music preferences
const saveGameMusicPrefs = (prefs: Record<string, GameMusicPreference>): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GAME_MUSIC_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable
  }
};

// List of games for the selector (subset for UI)
const GAME_LIST = [
  { id: 'runner', name: 'Endless Runner', icon: '🏃' },
  { id: 'snake', name: 'Snake', icon: '🐍' },
  { id: 'breakout', name: 'Breakout', icon: '🧱' },
  { id: 'minesweeper', name: 'Minesweeper', icon: '💣' },
  { id: 'memory', name: 'Memory Match', icon: '🧠' },
  { id: 'tetris', name: 'Tetris', icon: '🟦' },
  { id: 'space_invaders', name: 'Space Invaders', icon: '👾' },
  { id: 'pong', name: 'Pong', icon: '🏓' },
  { id: 'sudoku', name: 'Sudoku', icon: '🔢' },
  { id: 'crossword', name: 'Crossword', icon: '📝' },
];

// ============= SHAREABLE CODE SYSTEM =============

// Indexed arrays for compact encoding
const MOOD_KEYS = ['energetic', 'chill', 'intense', 'focus', 'retro', 'mysterious', 'epic', 'playful'];
const SCALE_KEYS = [
  'major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian',
  'majorPentatonic', 'minorPentatonic', 'blues', 'harmonicMinor', 'melodicMinor',
  'wholeTone', 'diminished', 'augmented', 'arabian', 'egyptian', 'hirajoshi',
  'insen', 'prometheus', 'enigmatic', 'darkSynth', 'spaceAmbient', 'japanese', 'hungarian'
];
const NOTE_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Base62 characters for compact encoding
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Encode a number to base62
const toBase62 = (num: number): string => {
  if (num === 0) return '0';
  let result = '';
  while (num > 0) {
    result = BASE62[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
};

// Decode base62 to number
const fromBase62 = (str: string): number => {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    result = result * 62 + BASE62.indexOf(str[i]);
  }
  return result;
};

interface ShareableConfig {
  seed: number;
  bpm: number;
  intensity: number; // 0-100
  moodIndex: number;
  scaleIndex: number;
  noteIndex: number;
}

// Generate a shareable code from config
const generateShareCode = (config: ShareableConfig): string => {
  // Pack data: seed (base62) + bpm (2 digits) + intensity (2 digits) + mood (1 digit) + scale (2 digits) + note (1 hex)
  const seedCode = toBase62(config.seed);
  const bpmCode = config.bpm.toString().padStart(3, '0');
  const intensityCode = config.intensity.toString().padStart(2, '0');
  const moodCode = config.moodIndex.toString(16);
  const scaleCode = config.scaleIndex.toString(16).padStart(2, '0');
  const noteCode = config.noteIndex.toString(16);

  // Format: HNA-{seed}-{bpm}{intensity}{mood}{scale}{note}
  const dataCode = `${bpmCode}${intensityCode}${moodCode}${scaleCode}${noteCode}`;
  return `HNA-${seedCode}-${dataCode}`;
};

// Parse a shareable code to config
const parseShareCode = (code: string): ShareableConfig | null => {
  try {
    // Remove whitespace and validate format
    const cleaned = code.trim().toUpperCase();
    if (!cleaned.startsWith('HNA-')) return null;

    const parts = cleaned.split('-');
    if (parts.length !== 3) return null;

    const seedCode = parts[1];
    const dataCode = parts[2];

    if (dataCode.length < 9) return null;

    const seed = fromBase62(seedCode);
    const bpm = parseInt(dataCode.substring(0, 3), 10);
    const intensity = parseInt(dataCode.substring(3, 5), 10);
    const moodIndex = parseInt(dataCode.substring(5, 6), 16);
    const scaleIndex = parseInt(dataCode.substring(6, 8), 16);
    const noteIndex = parseInt(dataCode.substring(8, 9), 16);

    // Validate ranges
    if (isNaN(seed) || seed < 0) return null;
    if (isNaN(bpm) || bpm < 60 || bpm > 200) return null;
    if (isNaN(intensity) || intensity < 0 || intensity > 100) return null;
    if (isNaN(moodIndex) || moodIndex < 0 || moodIndex >= MOOD_KEYS.length) return null;
    if (isNaN(scaleIndex) || scaleIndex < 0 || scaleIndex >= SCALE_KEYS.length) return null;
    if (isNaN(noteIndex) || noteIndex < 0 || noteIndex >= NOTE_KEYS.length) return null;

    return { seed, bpm, intensity, moodIndex, scaleIndex, noteIndex };
  } catch {
    return null;
  }
};

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  'Hub/Menu': '🏠',
  'Action': '💥',
  'Puzzle': '🧩',
  'Arcade': '🕹️',
  'Casual': '☀️',
  'Epic': '⚔️',
  'Sports': '🏆',
  'Rhythm': '🎵',
  'Space': '🚀',
  'Legacy': '📼',
};

export function AudioSettings({ audioManager, isOpen, onClose, achievementService }: AudioSettingsProps) {
  // Volume state
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [sfxVolume, setSfxVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);

  // Track browser state
  const [activeTab, setActiveTab] = useState<'volume' | 'tracks' | 'lab'>('volume');
  const [selectedCategory, setSelectedCategory] = useState<string>('Hub/Menu');
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  // Music Laboratory state (hidden feature!)
  const [labUnlocked, setLabUnlocked] = useState(false);
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [customSeed, setCustomSeed] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('energetic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSeeds, setGeneratedSeeds] = useState<number[]>([]);
  const [showLabIntro, setShowLabIntro] = useState(false);

  // Enhanced Lab controls
  const [customBpm, setCustomBpm] = useState<number>(120);
  const [customIntensity, setCustomIntensity] = useState<number>(0.6);
  const [selectedScale, setSelectedScale] = useState<string>('minorPentatonic');
  const [selectedRootNote, setSelectedRootNote] = useState<string>('A');
  const [labMode, setLabMode] = useState<'simple' | 'advanced'>('simple');

  // Playback state
  const [isPaused, setIsPaused] = useState(false);

  // Real-time BPM override
  const [liveBpmOverride, setLiveBpmOverride] = useState<number | null>(null);
  const [showBpmControl, setShowBpmControl] = useState(false);

  // Favorites system
  const [favorites, setFavorites] = useState<MusicFavorite[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');

  // Share code system
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  // Visualizer
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<'bars' | 'wave' | 'both'>('bars');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Instrument layers
  const [showLayers, setShowLayers] = useState(false);
  const [layerStates, setLayerStates] = useState({
    bass: true,
    drums: true,
    melody: true,
    chords: true,
    arpeggio: true,
    ambience: true,
  });

  // Per-game music customization
  const [showGameMusic, setShowGameMusic] = useState(false);
  const [gameMusicPrefs, setGameMusicPrefs] = useState<Record<string, GameMusicPreference>>({});
  const [selectedGameForMusic, setSelectedGameForMusic] = useState<string>('');

  // Load favorites and game music prefs on mount
  useEffect(() => {
    setFavorites(loadFavorites());
    setGameMusicPrefs(loadGameMusicPrefs());
  }, []);

  // Visualizer animation loop
  useEffect(() => {
    if (!showVisualizer || !audioManager || isPaused) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!showVisualizer || isPaused) return;

      const frequencyData = audioManager.getFrequencyData();
      const timeDomainData = audioManager.getTimeDomainData();

      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(17, 24, 39, 0.3)';
      ctx.fillRect(0, 0, width, height);

      if (visualizerMode === 'bars' || visualizerMode === 'both') {
        // Draw frequency bars
        const barCount = 32;
        const barWidth = (width / barCount) - 2;
        const step = Math.floor(frequencyData.length / barCount);

        for (let i = 0; i < barCount; i++) {
          const value = frequencyData[i * step];
          const barHeight = (value / 255) * height * 0.8;

          // Gradient color based on frequency
          const hue = 280 - (i / barCount) * 60; // Purple to pink
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.9)`;

          const x = i * (barWidth + 2);
          const y = height - barHeight;

          // Rounded bars
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
      }

      if (visualizerMode === 'wave' || visualizerMode === 'both') {
        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = visualizerMode === 'both' ? 'rgba(6, 182, 212, 0.7)' : 'rgba(168, 85, 247, 0.9)';
        ctx.lineWidth = 2;

        const sliceWidth = width / timeDomainData.length;
        let x = 0;

        for (let i = 0; i < timeDomainData.length; i++) {
          const v = timeDomainData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [showVisualizer, audioManager, isPaused, visualizerMode]);

  // Load state from audio manager
  useEffect(() => {
    if (audioManager && isOpen) {
      setMasterVolume(audioManager.getMasterVolume());
      setSfxVolume(audioManager.getSfxVolume());
      setMusicVolume(audioManager.getMusicVolume());
      setIsMuted(audioManager.isMutedState());
      setCurrentTrack(audioManager.getCurrentTrackName());
    }
  }, [audioManager, isOpen]);

  // Update current track and pause state periodically
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (audioManager) {
        setCurrentTrack(audioManager.getCurrentTrackName());
        setIsPaused(audioManager.isMusicPaused());
      }
    }, 500);
    return () => clearInterval(interval);
  }, [audioManager, isOpen]);

  // Handle title click for secret lab unlock
  const handleTitleClick = useCallback(() => {
    const newCount = titleClickCount + 1;
    setTitleClickCount(newCount);

    if (newCount >= 5 && !labUnlocked) {
      setLabUnlocked(true);
      setShowLabIntro(true);
      audioManager?.playSound('unlock');

      // Award the "Lab Rat" achievement
      if (achievementService) {
        achievementService.checkAchievement('music_lab_unlocked', 1);
      }

      // Reset after showing intro
      setTimeout(() => setShowLabIntro(false), 3000);
    } else if (newCount < 5) {
      // Subtle feedback for clicks
      audioManager?.playSound('click');
    }
  }, [titleClickCount, labUnlocked, audioManager, achievementService]);

  // Volume handlers
  const handleMasterVolumeChange = (value: number) => {
    setMasterVolume(value);
    audioManager?.setMasterVolume(value);
  };

  const handleSfxVolumeChange = (value: number) => {
    setSfxVolume(value);
    audioManager?.setSfxVolume(value);
    setTimeout(() => audioManager?.playSound('coin'), 100);
  };

  const handleMusicVolumeChange = (value: number) => {
    setMusicVolume(value);
    audioManager?.setMusicVolume(value);
  };

  const handleMuteToggle = () => {
    const newMutedState = audioManager?.toggleMute();
    setIsMuted(newMutedState || false);
  };

  // Track selection handler
  const handleTrackSelect = (trackName: string) => {
    audioManager?.playTrackByName(trackName, 0.5);
    setCurrentTrack(trackName);
    setIsPaused(false);
  };

  // Pause/play toggle handler
  const handlePauseToggle = () => {
    if (audioManager) {
      const newPausedState = audioManager.togglePause();
      setIsPaused(newPausedState);
      audioManager.playSound('click');
    }
  };

  // Real-time BPM change handler
  const handleLiveBpmChange = (bpm: number) => {
    setLiveBpmOverride(bpm);
    audioManager?.setBpmOverride(bpm);
  };

  // Reset BPM to track default
  const handleResetBpm = () => {
    setLiveBpmOverride(null);
    audioManager?.resetBpm();
    audioManager?.playSound('click');
  };

  // ============= FAVORITES HANDLERS =============

  // Save current config as favorite
  const handleSaveFavorite = () => {
    if (!favoriteName.trim()) return;

    const newFavorite: MusicFavorite = {
      id: generateFavoriteId(),
      name: favoriteName.trim(),
      seed: customSeed ? parseInt(customSeed) : Date.now(),
      bpm: customBpm,
      intensity: customIntensity,
      mood: selectedMood,
      scale: selectedScale,
      rootNote: selectedRootNote,
      createdAt: Date.now(),
    };

    const updatedFavorites = [newFavorite, ...favorites].slice(0, MAX_FAVORITES);
    setFavorites(updatedFavorites);
    saveFavoritesToStorage(updatedFavorites);

    // Track achievement: Music Collector (favorites saved)
    if (achievementService) {
      achievementService.checkAchievement('music_lab_favorites', updatedFavorites.length);
    }

    audioManager?.playSound('success');
    setSavingFavorite(false);
    setFavoriteName('');
  };

  // Load a favorite configuration
  const handleLoadFavorite = (favorite: MusicFavorite) => {
    setCustomSeed(favorite.seed.toString());
    setCustomBpm(favorite.bpm);
    setCustomIntensity(favorite.intensity);
    setSelectedMood(favorite.mood);
    setSelectedScale(favorite.scale);
    setSelectedRootNote(favorite.rootNote);

    audioManager?.playSound('click');

    // Optionally auto-play the loaded favorite
    setTimeout(() => {
      audioManager?.playCustomTrack({
        seed: favorite.seed,
        mood: favorite.mood,
        bpm: favorite.bpm,
        intensity: favorite.intensity,
      });
      setCurrentTrack(`custom_${favorite.mood}`);
      setIsPaused(false);
    }, 100);
  };

  // Delete a favorite
  const handleDeleteFavorite = (id: string) => {
    const updatedFavorites = favorites.filter(f => f.id !== id);
    setFavorites(updatedFavorites);
    saveFavoritesToStorage(updatedFavorites);
    audioManager?.playSound('click');
  };

  // ============= GAME MUSIC PREFERENCE HANDLERS =============

  // Assign current config to a game
  const handleAssignCurrentToGame = (gameId: string) => {
    const pref: GameMusicPreference = {
      gameId,
      type: 'custom',
      customConfig: {
        seed: customSeed ? parseInt(customSeed) : Date.now(),
        bpm: customBpm,
        mood: selectedMood,
        scale: selectedScale,
        rootNote: selectedRootNote,
        intensity: customIntensity,
      },
    };

    const updated = { ...gameMusicPrefs, [gameId]: pref };
    setGameMusicPrefs(updated);
    saveGameMusicPrefs(updated);

    // Track achievement: Game DJ (games customized)
    if (achievementService) {
      achievementService.checkAchievement('music_lab_games_customized', Object.keys(updated).length);
    }

    audioManager?.playSound('success');
  };

  // Assign a favorite to a game
  const handleAssignFavoriteToGame = (gameId: string, favoriteId: string) => {
    const pref: GameMusicPreference = {
      gameId,
      type: 'favorite',
      favoriteId,
    };

    const updated = { ...gameMusicPrefs, [gameId]: pref };
    setGameMusicPrefs(updated);
    saveGameMusicPrefs(updated);

    // Track achievement: Game DJ (games customized)
    if (achievementService) {
      achievementService.checkAchievement('music_lab_games_customized', Object.keys(updated).length);
    }

    audioManager?.playSound('success');
  };

  // Assign a track to a game
  const handleAssignTrackToGame = (gameId: string, trackName: string) => {
    const pref: GameMusicPreference = {
      gameId,
      type: 'track',
      trackName,
    };

    const updated = { ...gameMusicPrefs, [gameId]: pref };
    setGameMusicPrefs(updated);
    saveGameMusicPrefs(updated);

    // Track achievement: Game DJ (games customized)
    if (achievementService) {
      achievementService.checkAchievement('music_lab_games_customized', Object.keys(updated).length);
    }

    audioManager?.playSound('success');
  };

  // Clear game preference (use default)
  const handleClearGamePref = (gameId: string) => {
    const updated = { ...gameMusicPrefs };
    delete updated[gameId];
    setGameMusicPrefs(updated);
    saveGameMusicPrefs(updated);
    audioManager?.playSound('click');
  };

  // Get a display name for a game's music preference
  const getGamePrefDisplayName = (pref: GameMusicPreference): string => {
    if (pref.type === 'track') {
      return pref.trackName || 'Unknown Track';
    } else if (pref.type === 'favorite') {
      const fav = favorites.find(f => f.id === pref.favoriteId);
      return fav?.name || 'Unknown Favorite';
    } else if (pref.type === 'custom') {
      return `Custom (${pref.customConfig?.mood || 'unknown'})`;
    }
    return 'Default';
  };

  // ============= LAYER CONTROL HANDLERS =============

  // Toggle a layer on/off
  const handleToggleLayer = (layer: keyof typeof layerStates) => {
    const newState = audioManager?.toggleLayer(layer) ?? !layerStates[layer];
    setLayerStates(prev => ({ ...prev, [layer]: newState }));
    audioManager?.playSound('click');
  };

  // Solo a layer (enable only that one)
  const handleSoloLayer = (layer: keyof typeof layerStates) => {
    audioManager?.soloLayer(layer);
    setLayerStates({
      bass: layer === 'bass',
      drums: layer === 'drums',
      melody: layer === 'melody',
      chords: layer === 'chords',
      arpeggio: layer === 'arpeggio',
      ambience: layer === 'ambience',
    });
    audioManager?.playSound('click');
  };

  // Enable all layers
  const handleEnableAllLayers = () => {
    audioManager?.enableAllLayers();
    setLayerStates({
      bass: true,
      drums: true,
      melody: true,
      chords: true,
      arpeggio: true,
      ambience: true,
    });
    audioManager?.playSound('success');
  };

  // ============= SHARE CODE HANDLERS =============

  // Generate share code from current config
  const handleGenerateShareCode = () => {
    const config: ShareableConfig = {
      seed: customSeed ? parseInt(customSeed) : 0,
      bpm: customBpm,
      intensity: Math.round(customIntensity * 100),
      moodIndex: MOOD_KEYS.indexOf(selectedMood),
      scaleIndex: SCALE_KEYS.indexOf(selectedScale),
      noteIndex: NOTE_KEYS.indexOf(selectedRootNote),
    };

    const code = generateShareCode(config);
    setShareCode(code);
    setShowSharePanel(true);

    // Track achievement: Music Sharer (shared a code)
    if (achievementService) {
      achievementService.checkAchievement('music_lab_shared', 1);
    }

    audioManager?.playSound('success');
  };

  // Copy share code to clipboard
  const handleCopyShareCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCodeCopied(true);
      audioManager?.playSound('coin');
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  // Import config from share code
  const handleImportShareCode = () => {
    setImportError('');

    const parsed = parseShareCode(importCode);
    if (!parsed) {
      setImportError('Invalid code. Please check and try again.');
      audioManager?.playSound('error');
      return;
    }

    // Apply the imported config
    setCustomSeed(parsed.seed.toString());
    setCustomBpm(parsed.bpm);
    setCustomIntensity(parsed.intensity / 100);
    setSelectedMood(MOOD_KEYS[parsed.moodIndex] || 'energetic');
    setSelectedScale(SCALE_KEYS[parsed.scaleIndex] || 'minorPentatonic');
    setSelectedRootNote(NOTE_KEYS[parsed.noteIndex] || 'A');

    audioManager?.playSound('unlock');
    setImportCode('');
    setShowSharePanel(false);

    // Auto-play the imported config
    setTimeout(() => {
      audioManager?.playCustomTrack({
        seed: parsed.seed,
        mood: MOOD_KEYS[parsed.moodIndex],
        bpm: parsed.bpm,
        intensity: parsed.intensity / 100,
      });
      setCurrentTrack(`custom_${MOOD_KEYS[parsed.moodIndex]}`);
      setIsPaused(false);
    }, 100);
  };

  // Generate random seed
  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 999999999);
    setCustomSeed(seed.toString());
    return seed;
  };

  // Play custom generated track
  const handleGenerateTrack = async () => {
    setIsGenerating(true);
    audioManager?.playSound('powerup');

    // Dramatic delay for effect
    await new Promise(resolve => setTimeout(resolve, 800));

    const seed = customSeed ? parseInt(customSeed) : generateRandomSeed();

    audioManager?.playCustomTrack({
      seed,
      mood: selectedMood,
      bpm: customBpm,
      intensity: customIntensity,
    });

    // Save to history
    if (!generatedSeeds.includes(seed)) {
      setGeneratedSeeds(prev => [seed, ...prev.slice(0, 4)]);
    }

    // Track achievement: Music Creator (tracks generated)
    if (achievementService) {
      const tracksGenerated = (generatedSeeds.length + 1);
      achievementService.checkAchievement('music_lab_tracks_generated', tracksGenerated);
    }

    setIsGenerating(false);
    setIsPaused(false);
    setCurrentTrack(`custom_${selectedMood}`);
  };

  // Get track info
  const getTrackInfo = (trackName: string) => {
    return audioManager?.getTrackInfo(trackName);
  };

  // Get tracks by category
  const getTracksByCategory = () => {
    return audioManager?.getTracksByCategory() || {};
  };

  if (!isOpen) return null;

  const tracksByCategory = getTracksByCategory();
  const currentTrackInfo = currentTrack ? getTrackInfo(currentTrack) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" data-testid="audio-settings-modal">
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 border border-purple-500/50 shadow-2xl shadow-purple-500/20 max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3
            className="text-xl font-bold text-white cursor-pointer select-none hover:text-purple-300 transition-colors"
            onClick={handleTitleClick}
            title={labUnlocked ? "Music Laboratory Unlocked!" : undefined}
          >
            {labUnlocked ? '🎛️ Audio Studio' : '🔊 Audio Settings'}
            {titleClickCount > 0 && titleClickCount < 5 && (
              <span className="ml-2 text-xs text-purple-400 animate-pulse">
                {'🎵'.repeat(titleClickCount)}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Lab Unlock Animation */}
        {showLabIntro && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 animate-pulse">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">🔬</div>
              <div className="text-2xl font-bold text-purple-400 mb-2">SECRET UNLOCKED!</div>
              <div className="text-gray-300">Music Laboratory is now available</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('volume')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === 'volume'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            🔊 Volume
          </button>
          <button
            onClick={() => setActiveTab('tracks')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === 'tracks'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            🎵 Tracks
          </button>
          {labUnlocked && (
            <button
              onClick={() => setActiveTab('lab')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
                activeTab === 'lab'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              🔬 Lab
            </button>
          )}
        </div>

        {/* Now Playing Banner - Simple version for all tabs */}
        {currentTrack && currentTrackInfo && (
          <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Pause/Play Button */}
                <button
                  onClick={handlePauseToggle}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all transform hover:scale-105 ${
                    isPaused
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                  title={isPaused ? 'Resume music' : 'Pause music'}
                >
                  {isPaused ? (
                    <span className="text-xl">▶</span>
                  ) : (
                    <span className="text-xl">⏸</span>
                  )}
                </button>
                <div>
                  <div className="text-white font-medium flex items-center gap-2">
                    {currentTrackInfo.name}
                    {isPaused && (
                      <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-0.5 rounded">
                        PAUSED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className={liveBpmOverride ? 'text-cyan-400 font-medium' : ''}>
                      {liveBpmOverride || currentTrackInfo.bpm} BPM
                    </span>
                    {liveBpmOverride && <span className="text-cyan-400"> (live)</span>}
                    {' • '}{currentTrackInfo.scale} • {currentTrackInfo.mood}
                  </div>
                </div>
              </div>
              {/* Equalizer Bars - only animate when playing */}
              <div className="flex items-center gap-1">
                {[
                  { delay: 0, height: 16, color: 'bg-purple-500' },
                  { delay: 150, height: 24, color: 'bg-purple-400' },
                  { delay: 300, height: 12, color: 'bg-purple-500' },
                  { delay: 450, height: 20, color: 'bg-purple-400' },
                ].map((bar, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded transition-all ${
                      isPaused
                        ? 'bg-gray-600'
                        : `${bar.color} animate-pulse`
                    }`}
                    style={{
                      height: isPaused ? '8px' : `${bar.height}px`,
                      animationDelay: isPaused ? '0ms' : `${bar.delay}ms`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">

          {/* Volume Tab */}
          {activeTab === 'volume' && (
            <div className="space-y-5">
              {/* Master Volume */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🔊 Master Volume</label>
                  <span className="text-purple-400 font-mono">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  data-testid="master-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={masterVolume}
                  onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* SFX Volume */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">💥 Sound Effects</label>
                  <span className="text-purple-400 font-mono">{Math.round(sfxVolume * 100)}%</span>
                </div>
                <input
                  data-testid="sfx-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sfxVolume}
                  onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Music Volume */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🎵 Background Music</label>
                  <span className="text-purple-400 font-mono">{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  data-testid="music-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Mute Toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg">
                <span className="text-white font-medium">🔇 Mute All Audio</span>
                <button
                  data-testid="mute-toggle"
                  onClick={handleMuteToggle}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    isMuted ? 'bg-gray-600' : 'bg-purple-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${
                      isMuted ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
              </div>

              {/* Test Sounds */}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400 mb-3">Test Sound Effects:</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => audioManager?.playSound('coin')}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors"
                  >
                    💰 Coin
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('jump')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                  >
                    🦘 Jump
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('powerup')}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                  >
                    ⬆️ Power-up
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('explosion')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
                  >
                    💥 Boom
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('success')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                  >
                    ✨ Success
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tracks Tab */}
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              {/* Category Selector */}
              <div className="flex flex-wrap gap-2">
                {Object.keys(tracksByCategory).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {CATEGORY_ICONS[category]} {category}
                  </button>
                ))}
              </div>

              {/* Track List */}
              <div className="space-y-2">
                {tracksByCategory[selectedCategory]?.map((trackName) => {
                  const info = getTrackInfo(trackName);
                  const isPlaying = currentTrack === trackName;
                  const isLegacy = trackName === 'hub_music' || trackName === 'game_music';

                  return (
                    <button
                      key={trackName}
                      onClick={() => handleTrackSelect(trackName)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        isPlaying
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {isLegacy ? '📼' : (MOOD_CONFIG[info?.mood || '']?.icon || '🎵')}
                          </span>
                          <div>
                            <div className="font-medium">
                              {info?.name || trackName}
                              {isLegacy && <span className="ml-2 text-xs text-yellow-400">(Original)</span>}
                            </div>
                            {info && (
                              <div className="text-xs opacity-70">
                                {info.bpm} BPM • {info.scale} • {info.mood}
                              </div>
                            )}
                          </div>
                        </div>
                        {isPlaying && (
                          <div className="flex items-center gap-0.5">
                            <div className="w-1 h-3 bg-white rounded animate-pulse" />
                            <div className="w-1 h-4 bg-white rounded animate-pulse" style={{ animationDelay: '100ms' }} />
                            <div className="w-1 h-2 bg-white rounded animate-pulse" style={{ animationDelay: '200ms' }} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Info text */}
              <p className="text-xs text-gray-500 text-center mt-4">
                All tracks are procedurally generated and unique every time!
              </p>
            </div>
          )}

          {/* Music Laboratory Tab (Hidden Feature!) */}
          {activeTab === 'lab' && labUnlocked && (
            <div className="space-y-4">
              {/* Lab Header with Mode Toggle */}
              <div className="text-center p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg border border-purple-500/30">
                <div className="text-3xl mb-2">🔬🎵✨</div>
                <h4 className="text-lg font-bold text-white">Music Laboratory</h4>
                <p className="text-sm text-gray-400 mb-3">Create your own procedural masterpiece!</p>

                {/* Mode Toggle */}
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setLabMode('simple')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      labMode === 'simple'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🎚️ Simple
                  </button>
                  <button
                    onClick={() => setLabMode('advanced')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      labMode === 'advanced'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🔧 Advanced
                  </button>
                </div>
              </div>

              {/* ============= LIVE TOOLS SECTION (Lab Exclusive) ============= */}
              {currentTrack && currentTrackInfo && (
                <div className="p-3 bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded-lg border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                      🎛️ Live Tools
                      <span className="text-[10px] bg-cyan-600/30 px-2 py-0.5 rounded text-cyan-300">Lab Exclusive</span>
                    </h5>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowVisualizer(!showVisualizer)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          showVisualizer
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        📊 Visualizer
                      </button>
                      <button
                        onClick={() => setShowLayers(!showLayers)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          showLayers
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        🎚️ Layers
                      </button>
                      <button
                        onClick={() => setShowBpmControl(!showBpmControl)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          showBpmControl
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        ⏱️ Tempo
                      </button>
                    </div>
                  </div>

                  {/* Live BPM Control */}
                  {showBpmControl && (
                    <div className="mb-3 p-2 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-cyan-400 font-medium whitespace-nowrap">Live BPM:</span>
                        <input
                          type="range"
                          min="60"
                          max="200"
                          step="5"
                          value={liveBpmOverride || currentTrackInfo.bpm}
                          onChange={(e) => handleLiveBpmChange(parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-cyan"
                        />
                        <span className="text-cyan-400 font-mono text-sm w-12 text-right">
                          {liveBpmOverride || currentTrackInfo.bpm}
                        </span>
                        {liveBpmOverride && (
                          <button
                            onClick={handleResetBpm}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                            title="Reset to track default"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
                        <span>60 (Slow)</span>
                        <span>130 (Normal)</span>
                        <span>200 (Fast)</span>
                      </div>
                    </div>
                  )}

                  {/* Waveform Visualizer */}
                  {showVisualizer && (
                    <div className="mb-3 p-2 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-purple-400 font-medium">Visualizer</span>
                        <div className="flex gap-1">
                          {(['bars', 'wave', 'both'] as const).map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setVisualizerMode(mode)}
                              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                                visualizerMode === mode
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              }`}
                            >
                              {mode === 'bars' ? '📊' : mode === 'wave' ? '〰️' : '🎵'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={80}
                        className="w-full h-20 bg-gray-900 rounded-lg border border-purple-500/30"
                      />
                      {isPaused && (
                        <div className="text-center text-[10px] text-gray-500 mt-1">
                          Resume music to see visualizer in action
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instrument Layers */}
                  {showLayers && (
                    <div className="p-2 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-amber-400 font-medium">Instrument Layers</span>
                        <button
                          onClick={handleEnableAllLayers}
                          className="px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
                        >
                          Enable All
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { key: 'drums', label: 'Drums', icon: '🥁' },
                          { key: 'bass', label: 'Bass', icon: '🎸' },
                          { key: 'melody', label: 'Melody', icon: '🎹' },
                          { key: 'chords', label: 'Chords', icon: '🎵' },
                          { key: 'arpeggio', label: 'Arp', icon: '✨' },
                          { key: 'ambience', label: 'Amb', icon: '🌊' },
                        ] as const).map(({ key, label, icon }) => (
                          <button
                            key={key}
                            onClick={() => handleToggleLayer(key)}
                            className={`p-1.5 rounded-lg border transition-all text-center ${
                              layerStates[key]
                                ? 'bg-amber-600/30 border-amber-500/50'
                                : 'bg-gray-800/50 border-gray-700 opacity-50'
                            }`}
                          >
                            <span className="text-sm">{icon}</span>
                            <div className="text-[10px] text-white">{label}</div>
                          </button>
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1.5 text-center">
                        Click to toggle layers on/off
                      </div>
                    </div>
                  )}

                  {/* Collapsed state hint */}
                  {!showBpmControl && !showVisualizer && !showLayers && (
                    <div className="text-xs text-gray-500 text-center">
                      Click the buttons above to access live playback controls
                    </div>
                  )}
                </div>
              )}

              {/* No track playing hint */}
              {(!currentTrack || !currentTrackInfo) && (
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 text-center">
                  <div className="text-gray-500 text-sm">🎵 Generate a track to unlock Live Tools</div>
                </div>
              )}

              {/* Seed Input */}
              <div>
                <label className="block text-white font-medium mb-2">
                  🌱 Music Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSeed}
                    onChange={(e) => setCustomSeed(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter a number or generate random"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => setCustomSeed(generateRandomSeed().toString())}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                    title="Generate random seed"
                  >
                    🎲
                  </button>
                </div>
              </div>

              {/* BPM Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🥁 BPM (Tempo)</label>
                  <span className="text-purple-400 font-mono bg-gray-800 px-2 py-0.5 rounded">{customBpm}</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="5"
                  value={customBpm}
                  onChange={(e) => setCustomBpm(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>60 (Chill)</span>
                  <span>120 (Groove)</span>
                  <span>180 (Intense)</span>
                </div>
              </div>

              {/* Intensity Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🔥 Intensity</label>
                  <span className="text-purple-400 font-mono bg-gray-800 px-2 py-0.5 rounded">
                    {Math.round(customIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={customIntensity}
                  onChange={(e) => setCustomIntensity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>🌙 Ambient</span>
                  <span>⚡ Medium</span>
                  <span>🔥 Maximum</span>
                </div>
              </div>

              {/* Mood Selector */}
              <div>
                <label className="block text-white font-medium mb-2">
                  🎭 Mood
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MOOD_CONFIG).map(([mood, config]) => (
                    <button
                      key={mood}
                      onClick={() => setSelectedMood(mood)}
                      className={`p-2.5 rounded-lg text-left transition-all ${
                        selectedMood === mood
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <div>
                          <div className="font-medium capitalize text-sm">{mood}</div>
                          {labMode === 'advanced' && (
                            <div className="text-xs opacity-70">{config.description}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Controls */}
              {labMode === 'advanced' && (
                <>
                  {/* Scale Selector - Organized by Category */}
                  <div>
                    <label className="block text-white font-medium mb-2">
                      🎼 Scale / Mode
                    </label>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                      {Object.entries(SCALE_CATEGORIES).map(([category, { label, emoji }]) => {
                        const scalesInCategory = Object.entries(SCALE_NAMES)
                          .filter(([, info]) => info.category === category)
                          .map(([key]) => key);

                        if (scalesInCategory.length === 0) return null;

                        return (
                          <div key={category}>
                            <div className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                              <span>{emoji}</span>
                              <span>{label}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {scalesInCategory.map((scale) => (
                                <button
                                  key={scale}
                                  onClick={() => setSelectedScale(scale)}
                                  className={`p-1.5 rounded-lg text-center transition-all ${
                                    selectedScale === scale
                                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white ring-2 ring-purple-400'
                                      : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                  }`}
                                >
                                  <span className="text-sm">{SCALE_NAMES[scale]?.emoji}</span>
                                  <div className="text-[10px] font-medium">{SCALE_NAMES[scale]?.name}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Root Note Selector */}
                  <div>
                    <label className="block text-white font-medium mb-2">
                      🎹 Root Note (Key)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ROOT_NOTES.map((note) => (
                        <button
                          key={note}
                          onClick={() => setSelectedRootNote(note)}
                          className={`w-10 h-10 rounded-lg font-bold transition-all ${
                            selectedRootNote === note
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                              : note.includes('#')
                                ? 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                                : 'bg-gray-700 text-white hover:bg-gray-600'
                          }`}
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current Configuration Display */}
                  <div className="p-3 bg-gray-800/70 rounded-lg border border-purple-500/20">
                    <h5 className="text-sm font-medium text-purple-400 mb-2">🎛️ Current Configuration</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Seed:</span>
                        <span className="text-white font-mono">{customSeed || 'Random'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">BPM:</span>
                        <span className="text-white">{customBpm}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Key:</span>
                        <span className="text-white">{selectedRootNote} {SCALE_NAMES[selectedScale]?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Intensity:</span>
                        <span className="text-white">{Math.round(customIntensity * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Generate Button + Share Button */}
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateTrack}
                  disabled={isGenerating}
                  className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                    isGenerating
                      ? 'bg-gray-700 text-gray-400 cursor-wait'
                      : 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-size-200 animate-gradient text-white hover:shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02]'
                  }`}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">🎵</span>
                      Generating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      ✨ Generate Music ✨
                      {labMode === 'advanced' && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                          {selectedRootNote} {SCALE_NAMES[selectedScale]?.name} @ {customBpm}bpm
                        </span>
                      )}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleGenerateShareCode}
                  className="px-4 py-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-all hover:scale-105"
                  title="Share this configuration"
                >
                  🔗
                </button>
              </div>

              {/* ============= SHARE CODE PANEL ============= */}
              {showSharePanel && (
                <div className="p-4 bg-cyan-900/30 rounded-lg border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-white font-medium flex items-center gap-2">
                      🔗 Share Your Music
                    </h5>
                    <button
                      onClick={() => setShowSharePanel(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Generated Share Code */}
                  {shareCode && (
                    <div className="mb-4">
                      <label className="block text-xs text-cyan-400 mb-1.5">Your Share Code:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={shareCode}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-800 border border-cyan-500/50 rounded-lg text-cyan-300 font-mono text-sm select-all"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={handleCopyShareCode}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            codeCopied
                              ? 'bg-green-600 text-white'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          }`}
                        >
                          {codeCopied ? '✓ Copied!' : '📋 Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        Share this code with friends to let them hear your creation!
                      </p>
                    </div>
                  )}

                  {/* Import Share Code */}
                  <div className="border-t border-cyan-500/20 pt-3">
                    <label className="block text-xs text-cyan-400 mb-1.5">Import a Share Code:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={importCode}
                        onChange={(e) => {
                          setImportCode(e.target.value);
                          setImportError('');
                        }}
                        placeholder="Paste HNA-XXXXX-XXXXXXXXX code here..."
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm"
                      />
                      <button
                        onClick={handleImportShareCode}
                        disabled={!importCode.trim()}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          importCode.trim()
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Import
                      </button>
                    </div>
                    {importError && (
                      <p className="text-xs text-red-400 mt-1.5">{importError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Seeds */}
              {generatedSeeds.length > 0 && (
                <div>
                  <label className="block text-white font-medium mb-2">
                    🕐 Recent Seeds
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {generatedSeeds.map((seed) => (
                      <button
                        key={seed}
                        onClick={() => {
                          setCustomSeed(seed.toString());
                          audioManager?.playSound('click');
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-mono transition-colors border border-gray-700 hover:border-purple-500"
                      >
                        {seed}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ============= FAVORITES SYSTEM UI ============= */}
              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-medium flex items-center gap-2">
                    💾 Saved Favorites
                    {favorites.length > 0 && (
                      <span className="text-xs bg-purple-600/50 px-2 py-0.5 rounded-full">
                        {favorites.length}
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    {!savingFavorite ? (
                      <button
                        onClick={() => setSavingFavorite(true)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                      >
                        <span>➕</span> Save Current
                      </button>
                    ) : null}
                    {favorites.length > 0 && (
                      <button
                        onClick={() => setShowFavorites(!showFavorites)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                          showFavorites
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {showFavorites ? '📂 Hide' : '📁 Show'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Save New Favorite Form */}
                {savingFavorite && (
                  <div className="p-3 bg-green-900/30 rounded-lg border border-green-500/30 mb-3">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={favoriteName}
                        onChange={(e) => setFavoriteName(e.target.value)}
                        placeholder="Enter a name for this config..."
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none text-sm"
                        maxLength={30}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveFavorite}
                        disabled={!favoriteName.trim()}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          favoriteName.trim()
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setSavingFavorite(false);
                          setFavoriteName('');
                        }}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">
                      Saving: Seed {customSeed || 'Random'} • {customBpm} BPM • {selectedMood} • {SCALE_NAMES[selectedScale]?.name || selectedScale}
                    </div>
                  </div>
                )}

                {/* Favorites List */}
                {showFavorites && favorites.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {favorites.map((favorite) => (
                      <div
                        key={favorite.id}
                        className="p-2.5 bg-gray-800/70 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleLoadFavorite(favorite)}
                            className="flex-1 text-left"
                          >
                            <div className="text-white font-medium text-sm flex items-center gap-2">
                              <span>{MOOD_CONFIG[favorite.mood]?.icon || '🎵'}</span>
                              {favorite.name}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {favorite.bpm} BPM • {favorite.rootNote} {SCALE_NAMES[favorite.scale]?.name || favorite.scale} • {Math.round(favorite.intensity * 100)}%
                            </div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              Seed: {favorite.seed}
                            </div>
                          </button>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleLoadFavorite(favorite)}
                              className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors text-xs"
                              title="Play this favorite"
                            >
                              ▶
                            </button>
                            <button
                              onClick={() => handleDeleteFavorite(favorite.id)}
                              className="p-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded transition-colors text-xs"
                              title="Delete this favorite"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {showFavorites && favorites.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No favorites saved yet. Click "Save Current" to save your first configuration!
                  </div>
                )}
              </div>

              {/* ============= PER-GAME MUSIC CUSTOMIZATION UI ============= */}
              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-medium flex items-center gap-2">
                    🎮 Per-Game Music
                    {Object.keys(gameMusicPrefs).length > 0 && (
                      <span className="text-xs bg-green-600/50 px-2 py-0.5 rounded-full">
                        {Object.keys(gameMusicPrefs).length} customized
                      </span>
                    )}
                  </label>
                  <button
                    onClick={() => setShowGameMusic(!showGameMusic)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                      showGameMusic
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {showGameMusic ? '🎯 Hide' : '🎯 Setup'}
                  </button>
                </div>

                {showGameMusic && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">
                      Assign custom music to specific games. When you start a game, your custom music will play instead of the default!
                    </p>

                    {/* Game List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                      {GAME_LIST.map((game) => {
                        const pref = gameMusicPrefs[game.id];
                        return (
                          <div
                            key={game.id}
                            className={`p-3 rounded-lg border transition-all ${
                              pref
                                ? 'bg-green-900/30 border-green-500/30'
                                : 'bg-gray-800/50 border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{game.icon}</span>
                                <div>
                                  <div className="text-sm text-white font-medium">{game.name}</div>
                                  {pref ? (
                                    <div className="text-xs text-green-400">
                                      Custom: {getGamePrefDisplayName(pref)}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500">Using default music</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {!pref ? (
                                  <>
                                    <button
                                      onClick={() => handleAssignCurrentToGame(game.id)}
                                      className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                                      title="Assign current Lab settings"
                                    >
                                      Use Current
                                    </button>
                                    {favorites.length > 0 && (
                                      <select
                                        className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded border-none focus:outline-none cursor-pointer"
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleAssignFavoriteToGame(game.id, e.target.value);
                                          }
                                        }}
                                        defaultValue=""
                                      >
                                        <option value="">+ Favorite</option>
                                        {favorites.map((fav) => (
                                          <option key={fav.id} value={fav.id}>
                                            {fav.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleClearGamePref(game.id)}
                                    className="px-2 py-1 text-xs bg-red-600/80 hover:bg-red-500 text-white rounded transition-colors"
                                    title="Remove custom music"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[10px] text-gray-500 text-center">
                      Custom game music is saved automatically and will play when you start each game!
                    </p>
                  </div>
                )}
              </div>

              {/* Lab Tips */}
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <h5 className="text-sm font-medium text-purple-400 mb-2">💡 Lab Tips</h5>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Try your birthday as a seed for personalized music!</li>
                  <li>• Same seed + same settings = identical track every time</li>
                  {labMode === 'simple' ? (
                    <li>• Switch to <span className="text-pink-400">Advanced</span> mode for scale and key controls!</li>
                  ) : (
                    <>
                      <li>• <span className="text-purple-400">Minor Pentatonic</span> is great for retro games</li>
                      <li>• <span className="text-purple-400">Japanese</span> scale for peaceful, zen vibes</li>
                    </>
                  )}
                  <li>• Use <span className="text-green-400">Per-Game Music</span> to customize each game's soundtrack!</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            data-testid="audio-settings-close"
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(168, 85, 247, 0.5);
          transition: transform 0.1s;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(168, 85, 247, 0.5);
        }
        .slider-cyan::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(6, 182, 212, 0.5);
          transition: transform 0.1s;
        }
        .slider-cyan::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .slider-cyan::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(6, 182, 212, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.8);
        }
        .bg-size-200 {
          background-size: 200% 200%;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
