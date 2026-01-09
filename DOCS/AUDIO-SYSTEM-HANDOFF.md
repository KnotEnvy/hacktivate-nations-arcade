# Hacktivate Nations Arcade - Procedural Audio System Handoff

## Session Date: January 8, 2026

---

## Quick Start for New Sessions

When starting a new session about the audio system, read these key files in order:

1. `src/services/ProceduralMusicEngine.ts` - Core music generation engine
2. `src/services/AudioManager.ts` - Main audio API and sound effects
3. `src/components/arcade/AudioSettings.tsx` - Audio UI with hidden Music Lab
4. `src/data/Achievements.ts` - Music Lab achievements

---

## System Overview

The Hacktivate Nations Arcade features a **fully procedural audio system** that generates unique background music using Web Audio API. The system produces 40+ minutes of non-repeating content with seed-based reproducibility.

### Architecture

```
AudioManager (Main Controller)
    ├── Sound Effects (17 synthesized sounds)
    ├── Legacy Music System (2 tracks: hub_music, game_music)
    ├── Hub Music Auto-Rotation (automatic track changes)
    └── ProceduralMusicEngine (20 procedural tracks)
            ├── MelodyGenerator (seed-based melody creation)
            ├── SeededRandom (reproducible randomness)
            ├── Track Definitions (scales, chords, instruments)
            ├── AnalyserNode (real-time visualization)
            ├── Layer Controls (toggle instruments)
            └── Volume Control (independent music volume)
```

---

## Key Files & Locations

| File | Purpose | Lines |
|------|---------|-------|
| `src/services/ProceduralMusicEngine.ts` | Core procedural music generation | ~1500 |
| `src/services/AudioManager.ts` | Main audio API, SFX, rotation | ~2550 |
| `src/components/arcade/AudioSettings.tsx` | Audio UI + hidden Music Lab | ~2100 |
| `src/data/Achievements.ts` | Achievement definitions incl. Music Lab | ~300 |
| `src/data/Games.ts` | Game manifest (25 games across 5 tiers) | ~250 |

---

## Procedural Music Engine Details

### Musical Scales Available (24 total)

```typescript
SCALES = {
  // Classic Modes
  major, minor, dorian, phrygian, lydian, mixolydian,

  // Pentatonic & Blues
  majorPentatonic, minorPentatonic, blues,

  // Harmonic Variations (NEW)
  harmonicMinor, melodicMinor,

  // Symmetric & Experimental (NEW)
  wholeTone, diminished, augmented, prometheus, enigmatic,

  // World Music
  japanese, hungarian, arabian, egyptian, hirajoshi, insen,

  // Game-Specific (NEW)
  darkSynth, spaceAmbient
}
```

### Scale Categories (for Lab UI)

| Category | Scales | Character |
|----------|--------|-----------|
| Classic Modes | major, minor, dorian, phrygian, lydian, mixolydian | Traditional Western modes |
| Pentatonic | majorPentatonic, minorPentatonic, blues | Simple, versatile |
| Harmonic | harmonicMinor, melodicMinor | Dramatic, emotional |
| Experimental | wholeTone, diminished, augmented, prometheus, enigmatic | Unusual, atmospheric |
| World Music | japanese, hungarian, arabian, egyptian, hirajoshi, insen | Cultural flavors |
| Game Vibes | darkSynth, spaceAmbient | Modern gaming aesthetics |

### Chord Progressions (18 total, by mood)

- **Epic**: `epic1`, `epic2`, `epic3` - Heroic, building tension
- **Chill**: `chill1`, `chill2`, `chill3` - Relaxed, ambient
- **Action**: `action1`, `action2`, `action3` - Driving, intense
- **Focus**: `focus1`, `focus2`, `focus3` - Contemplative
- **Retro**: `retro1`, `retro2`, `retro3` - Classic arcade
- **Mystery**: `mystery1`, `mystery2`, `mystery3` - Dark, atmospheric

### Track Definitions (20 procedural + 2 legacy)

| Category | Tracks | BPM Range | Typical Use |
|----------|--------|-----------|-------------|
| Hub/Menu | `hub_welcome`, `hub_ambient`, `hub_energetic` | 85-128 | Main menu, lobby |
| Action | `action_intense`, `action_chase` | 145-160 | Runner, shooters |
| Puzzle | `puzzle_focus`, `puzzle_discovery` | 75-90 | Minesweeper, puzzles |
| Arcade | `arcade_retro`, `arcade_bounce` | 125-130 | Snake, breakout |
| Casual | `casual_chill`, `casual_playful` | 95-105 | Memory, casual games |
| Epic | `epic_heroic`, `epic_tension` | 100-120 | Adventure, RPG |
| Sports | `sports_competitive`, `sports_victory` | 125-138 | Racing, sports |
| Rhythm | `rhythm_beat`, `rhythm_groove` | 115-128 | Rhythm games |
| Space | `space_exploration`, `space_battle` | 90-150 | Space shooter |
| Legacy | `hub_music`, `game_music` | 110-140 | Original tracks |

### Game-to-Track Mapping

Every game has 2 assigned tracks (primary + secondary). See `GAME_TRACK_MAPPING` in ProceduralMusicEngine.ts.

Example:
```typescript
'runner': { primary: 'action_intense', secondary: 'action_chase' },
'snake': { primary: 'arcade_retro', secondary: 'arcade_bounce' },
'minesweeper': { primary: 'puzzle_focus', secondary: 'puzzle_discovery' },
```

---

## AudioManager API Reference

### Sound Effects (17 types)

```typescript
playSound(name: SoundName): void

// Available sounds:
'coin', 'jump', 'powerup', 'click', 'collision', 'game_over',
'success', 'unlock', 'error', 'explosion', 'hit', 'bounce',
'hole', 'splash', 'win', 'laser'
```

### Music Playback

```typescript
// Play specific track
playMusic(name: MusicName, fadeSeconds?: number): void

// Play game-specific music (uses GAME_TRACK_MAPPING)
playGameMusic(gameId: string, variant: 'primary' | 'secondary', fadeSeconds?: number): void

// Play random hub track
playRandomHubMusic(fadeSeconds?: number): void

// Play track by exact name
playTrackByName(trackName: string, fadeSeconds?: number): void

// Generate custom track from Lab settings
playCustomTrack(params: {
  seed: number;
  bpm?: number;        // 60-180
  mood?: string;       // energetic, chill, intense, focus, retro, mysterious, epic, playful
  intensity?: number;  // 0.1-1.0
}): void

// Stop music
stopMusic(fadeSeconds?: number): void
```

### Hub Music Auto-Rotation (NEW)

```typescript
// Start automatic hub track rotation
startHubMusicRotation(intervalMinutes?: number): void  // Default: 4 minutes

// Stop rotation
stopHubMusicRotation(): void

// Check if rotation is active
isHubRotationActive(): boolean

// Change rotation interval
setRotationInterval(minutes: number): void
getRotationIntervalMinutes(): number
```

### Pause/Resume

```typescript
pauseMusic(): void       // Pause current music
resumeMusic(): void      // Resume paused music
togglePause(): boolean   // Toggle, returns isPaused state
isMusicPaused(): boolean // Check pause state
isMusicPlaying(): boolean // Check if playing (not paused)
```

### Volume Controls

```typescript
setMasterVolume(volume: number): void  // 0-1, affects all audio
setSfxVolume(volume: number): void     // 0-1, affects sound effects
setMusicVolume(volume: number): void   // 0-1, affects music (including procedural)
toggleMute(): boolean
```

### Live BPM Control (NEW)

```typescript
setBpmOverride(bpm: number | null): void  // Override current track BPM (60-200)
getEffectiveBpm(): number                  // Get current effective BPM
getBpmOverride(): number | null            // Get override value or null
resetBpm(): void                           // Reset to track default
```

### Instrument Layer Controls (NEW)

```typescript
// Toggle a specific layer
toggleLayer(layer: 'bass' | 'drums' | 'melody' | 'chords' | 'arpeggio' | 'ambience'): boolean

// Set layer state directly
setLayerEnabled(layer: string, enabled: boolean): void

// Get all layer states
getLayerStates(): { bass: boolean; drums: boolean; melody: boolean; chords: boolean; arpeggio: boolean; ambience: boolean }

// Enable all layers
enableAllLayers(): void

// Solo a layer (mute all others)
soloLayer(layer: string): void
```

### Audio Visualization (NEW)

```typescript
getAnalyserNode(): AnalyserNode | null     // Get Web Audio analyser node
getFrequencyData(): Uint8Array              // Get frequency spectrum data
getTimeDomainData(): Uint8Array             // Get waveform data
getFrequencyBinCount(): number              // Get number of frequency bins
```

### Track Information

```typescript
getCurrentTrackName(): string | null
getTrackInfo(trackName: string): { name, bpm, mood, scale, intensity } | null
getTracksByCategory(): Record<string, string[]>
getAvailableTracks(): string[]
getGameTracks(gameId: string): { primary: string; secondary: string }
```

### Seed Control

```typescript
setMusicSeed(seed: number): void
getCurrentSeed(): number
```

---

## Hidden Music Laboratory

### How to Unlock

Click the Audio Settings title **5 times** to unlock the secret Music Laboratory tab.

Unlocking awards the **"Lab Rat"** achievement!

### Features Overview

The Music Lab is divided into several sections:

1. **Live Tools** (Lab Exclusive) - Real-time playback controls
2. **Track Generator** - Create custom procedural music
3. **Favorites System** - Save and load configurations
4. **Share Codes** - Share creations with friends
5. **Per-Game Music** - Customize music for each game

### Live Tools (Lab Exclusive)

Only visible in the Lab tab when music is playing:

- **Visualizer** - Real-time waveform display
  - Bars mode (frequency spectrum)
  - Wave mode (time domain)
  - Both mode (combined)
- **Layers** - Toggle individual instruments
  - Drums, Bass, Melody, Chords, Arpeggio, Ambience
  - Click to toggle, button to enable all
- **Tempo** - Live BPM override
  - Slider from 60-200 BPM
  - Changes take effect immediately
  - Reset button to restore track default

### Track Generator

#### Simple Mode
- **Seed Input** - Enter any number for reproducible music
- **Random Seed Button** - Generate random seed
- **BPM Slider** - 60 (chill) to 180 (intense)
- **Intensity Slider** - 10% (ambient) to 100% (maximum)
- **Mood Selector** - 8 moods with icons

#### Advanced Mode (toggle)
All Simple Mode features plus:
- **Scale/Mode Selector** - 24 musical scales organized by category
- **Root Note Selector** - All 12 notes (C through B, including sharps)
- **Configuration Display** - Shows current settings
- **Enhanced Generate Button** - Shows key signature in button

### Favorites System (NEW)

- Save up to **20 favorite configurations**
- Each favorite stores: seed, BPM, intensity, mood, scale, root note
- Saved to localStorage (persists across sessions)
- Click a favorite to load and auto-play
- Delete unwanted favorites

### Share Codes (NEW)

Generate compact shareable codes in format: `HNA-XXXXX-XXXXXXXXX`

Example: `HNA-2B3K9-120601405`

Codes encode:
- Seed (Base62 encoded)
- BPM (60-200)
- Intensity (0-100%)
- Mood, Scale, Root Note (indexed)

To share: Click share button, copy code
To import: Paste code in import field, click Import

### Per-Game Music (NEW)

Assign custom music to specific games:
- **Use Current** - Assign current Lab settings to a game
- **Use Favorite** - Assign a saved favorite to a game
- **Clear** - Reset to default game music

When you start a customized game, your custom music plays instead of the default!

### Mood Options

| Mood | Icon | Description | Associated Tracks |
|------|------|-------------|-------------------|
| Energetic | ⚡ | High energy, upbeat | hub_energetic, sports_competitive |
| Chill | 🌙 | Relaxed, ambient | hub_ambient, casual_chill |
| Intense | 🔥 | Fast-paced, aggressive | action_intense, action_chase |
| Focus | 🎯 | Concentrated, minimal | puzzle_focus, puzzle_discovery |
| Retro | 👾 | Classic arcade vibes | arcade_retro, arcade_bounce |
| Mysterious | 🌌 | Dark, atmospheric | epic_tension, space_exploration |
| Epic | ⚔️ | Grand, heroic | epic_heroic, sports_victory |
| Playful | 🎈 | Fun, lighthearted | casual_playful, puzzle_discovery |

---

## Music Lab Achievements (NEW)

| ID | Title | Icon | Requirement |
|----|-------|------|-------------|
| music_lab_discoverer | Lab Rat | 🐀 | Discover the Music Laboratory |
| music_creator | Music Creator | 🎵 | Generate 10 custom tracks |
| music_collector | Music Collector | 💾 | Save 5 favorite configurations |
| music_sharer | Music Sharer | 🔗 | Share your first creation |
| music_customizer | Game DJ | 🎮 | Customize 5 games' music |

---

## ArcadeHub Integration Points

Music triggers in `src/components/arcade/ArcadeHub.tsx`:

```typescript
// Initial load - Start hub music with auto-rotation
audioManager.startHubMusicRotation(4); // 4 minutes between changes

// Game start - Stop rotation, play game music
audioManager.stopHubMusicRotation();
audioManager.playGameMusic(gameId, 'primary', 2.0);

// Return to hub - Restart rotation
audioManager.startHubMusicRotation(4);
```

### Auto-Rotation Behavior

- Hub tracks rotate automatically every 4 minutes
- Smooth 3-second crossfade between tracks
- Never plays the same track twice in a row
- Pauses during games, resumes on return to hub
- Cycles through: `hub_welcome`, `hub_ambient`, `hub_energetic`

---

## Testing

Run AudioManager tests:
```bash
npm test
```

All AudioManager tests should pass.

---

## Recent Changes (January 8, 2026)

### Hub Music Auto-Rotation
- Automatic track changes every 4 minutes in hub
- Smooth crossfades between tracks
- Smart selection avoids repeating same track
- Stops when game starts, restarts on return

### 12 New Musical Scales
- Harmonic variations: harmonicMinor, melodicMinor
- Symmetric: wholeTone, diminished, augmented
- World music: arabian, egyptian, hirajoshi, insen
- Experimental: prometheus, enigmatic
- Game-specific: darkSynth, spaceAmbient

### Live Tools (Lab Exclusive)
- **Waveform Visualizer** - Canvas-based with bars/wave/both modes
- **Live BPM Control** - Real-time tempo adjustment (60-200 BPM)
- **Instrument Layers** - Toggle bass, drums, melody, chords, arpeggio, ambience

### Favorites System
- Save up to 20 configurations to localStorage
- Load favorites with one click
- Auto-plays when loaded

### Shareable Codes
- Compact HNA-XXXXX-XXXXXXXXX format
- Base62 encoding for seeds
- Copy to clipboard support
- Import validation

### Per-Game Music Customization
- Assign custom music to 10 popular games
- Use current Lab settings or saved favorites
- Persists in localStorage

### Achievement Integration
- 5 new Music Lab achievements
- Tracked automatically when using Lab features

### Bug Fixes
- Fixed music volume slider not affecting procedural music
- Fixed equalizer bars not animating (Tailwind JIT issue)

---

## Common Tasks

### Add a New Track

1. Add definition to `TRACK_DEFINITIONS` in ProceduralMusicEngine.ts
2. Add to `ExtendedMusicName` type in AudioManager.ts
3. Add to appropriate category in `getTracksByCategory()` in AudioManager.ts
4. Optionally map to games in `GAME_TRACK_MAPPING`

### Add a New Sound Effect

1. Add to `SoundName` type in AudioManager.ts
2. Create `play[Name]Sound()` private method
3. Add case to `playSound()` switch statement

### Add a New Scale

1. Add intervals array to `SCALES` in ProceduralMusicEngine.ts
2. Add display info to `SCALE_NAMES` in AudioSettings.tsx
3. Assign to appropriate category

### Add a Music Lab Achievement

1. Add definition to `ACHIEVEMENTS` in Achievements.ts
2. Add tracking call in AudioSettings.tsx handler
3. Use `achievementService.checkAchievement(id, value)`

---

## Technical Notes

### Web Audio API Usage

- `AudioContext` for all audio operations
- `OscillatorNode` for synthesized sounds
- `GainNode` for volume envelopes
- `BiquadFilterNode` for frequency shaping
- `ConvolverNode` for reverb effects
- `DelayNode` for echo/delay effects
- `AnalyserNode` for visualization data (NEW)

### Seeded Random

Uses Mulberry32 PRNG algorithm for reproducible randomness. Same seed always produces same melody.

### Performance Considerations

- Music loops run on `setInterval` (not requestAnimationFrame)
- Nodes are cleaned up after stop/fade
- Reverb impulse responses are generated once per track start
- Visualizer uses requestAnimationFrame (pauses when hidden)
- Layer states persist across tracks

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `hacktivate_music_lab_favorites` | Saved favorite configurations |
| `hacktivate_game_music_prefs` | Per-game music assignments |
| `hacktivate_audio_settings` | Volume levels, mute state |

---

## Contact Points in Codebase

| Feature | Primary File | Key Function/Class |
|---------|-------------|-------------------|
| Track playback | AudioManager.ts | `playMusic()`, `playTrackByName()` |
| Procedural generation | ProceduralMusicEngine.ts | `playBeat()`, `MelodyGenerator` |
| Hub rotation | AudioManager.ts | `startHubMusicRotation()` |
| UI controls | AudioSettings.tsx | Component state, handlers |
| Live tools | AudioSettings.tsx | Live Tools section (Lab tab) |
| Favorites | AudioSettings.tsx | `handleSaveFavorite()`, `handleLoadFavorite()` |
| Share codes | AudioSettings.tsx | `generateShareCode()`, `parseShareCode()` |
| Game integration | ArcadeHub.tsx | `playGameMusic()` calls |
| Scale definitions | ProceduralMusicEngine.ts | `SCALES` constant |
| Track definitions | ProceduralMusicEngine.ts | `TRACK_DEFINITIONS` constant |
| Achievements | Achievements.ts | Music Lab achievement definitions |

---

## Future Enhancement Ideas

All original enhancement ideas have been implemented! Potential future additions:

1. **Audio Export** - Let users export their creations as audio files
2. **Community Seeds** - Online sharing/browsing of popular seeds
3. **Dynamic Soundscapes** - Ambient sounds that react to gameplay
4. **Custom Chord Progressions** - Let users create their own progressions
5. **MIDI Export** - Export melodies as MIDI files
6. **Rhythm Editor** - Visual drum pattern editor
7. **Preset Packs** - Downloadable mood/genre preset collections

---

*Document created: January 6, 2026*
*Last updated: January 8, 2026*
