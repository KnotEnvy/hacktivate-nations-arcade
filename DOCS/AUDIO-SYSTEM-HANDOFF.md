# Hacktivate Nations Arcade - Procedural Audio System Handoff

## Session Date: January 6, 2026

---

## Quick Start for New Sessions

When starting a new session about the audio system, read these key files in order:

1. `src/services/ProceduralMusicEngine.ts` - Core music generation engine
2. `src/services/AudioManager.ts` - Main audio API and sound effects
3. `src/components/arcade/AudioSettings.tsx` - Audio UI with hidden Music Lab

---

## System Overview

The Hacktivate Nations Arcade features a **fully procedural audio system** that generates unique background music using Web Audio API. The system produces 40+ minutes of non-repeating content with seed-based reproducibility.

### Architecture

```
AudioManager (Main Controller)
    ├── Sound Effects (17 synthesized sounds)
    ├── Legacy Music System (2 tracks: hub_music, game_music)
    └── ProceduralMusicEngine (20 procedural tracks)
            ├── MelodyGenerator (seed-based melody creation)
            ├── SeededRandom (reproducible randomness)
            └── Track Definitions (scales, chords, instruments)
```

---

## Key Files & Locations

| File | Purpose | Lines |
|------|---------|-------|
| `src/services/ProceduralMusicEngine.ts` | Core procedural music generation | ~1440 |
| `src/services/AudioManager.ts` | Main audio API, SFX, pause/resume | ~2340 |
| `src/components/arcade/AudioSettings.tsx` | Audio UI + hidden Music Lab | ~720 |
| `src/data/Games.ts` | Game manifest (25 games across 5 tiers) | ~250 |

---

## Procedural Music Engine Details

### Musical Scales Available (12 total)

```typescript
SCALES = {
  major, minor, dorian, phrygian, lydian, mixolydian,
  majorPentatonic, minorPentatonic, japanese, hungarian, blues, chromatic
}
```

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

Every game has 2 assigned tracks (primary + secondary). See `GAME_TRACK_MAPPING` in ProceduralMusicEngine.ts:484-520.

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

### Pause/Resume (Added Jan 2026)

```typescript
pauseMusic(): void       // Pause current music
resumeMusic(): void      // Resume paused music
togglePause(): boolean   // Toggle, returns isPaused state
isMusicPaused(): boolean // Check pause state
isMusicPlaying(): boolean // Check if playing (not paused)
```

### Volume Controls

```typescript
setMasterVolume(volume: number): void  // 0-1
setSfxVolume(volume: number): void     // 0-1
setMusicVolume(volume: number): void   // 0-1
toggleMute(): boolean
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

### Features

#### Simple Mode
- **Seed Input** - Enter any number for reproducible music
- **Random Seed Button** - Generate random seed
- **BPM Slider** - 60 (chill) to 180 (intense)
- **Intensity Slider** - 10% (ambient) to 100% (maximum)
- **Mood Selector** - 8 moods with icons

#### Advanced Mode (toggle)
All Simple Mode features plus:
- **Scale/Mode Selector** - 11 musical scales with emoji icons
- **Root Note Selector** - All 12 notes (C through B, including sharps)
- **Configuration Display** - Shows current settings
- **Enhanced Generate Button** - Shows key signature in button

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

### Scale Options (Advanced Mode)

| Scale | Emoji | Musical Character |
|-------|-------|-------------------|
| Major | 🌞 | Bright, happy |
| Minor | 🌙 | Sad, serious |
| Dorian | 🎷 | Jazzy, sophisticated |
| Phrygian | 🏜️ | Spanish/Middle Eastern |
| Lydian | ✨ | Dreamy, floating |
| Mixolydian | 🎸 | Bluesy, rock |
| Major Pentatonic | 🎵 | Happy, simple |
| Minor Pentatonic | 🎹 | Bluesy, versatile |
| Japanese | 🎋 | Peaceful, zen |
| Hungarian | 🎻 | Dramatic, mysterious |
| Blues | 🎺 | Soulful |

---

## Recent Changes (January 2026)

### Added Pause/Resume

- `AudioManager.pauseMusic()` / `resumeMusic()` / `togglePause()`
- `ProceduralMusicEngine.pause()` / `resume()`
- Now Playing banner has pause/play button
- Equalizer bars stop animating when paused
- "PAUSED" indicator badge appears

### Enhanced Music Laboratory

- Added Simple/Advanced mode toggle
- BPM slider (60-180)
- Intensity slider (10%-100%)
- Scale selector with 11 options
- Root note selector (all 12 notes)
- Configuration display panel
- Enhanced generate button shows settings

### Smart Track Selection

- `playCustomTrack()` now uses BPM/intensity to select appropriate tracks
- Cross-references user preferences with track characteristics
- Uses seeded random for reproducible selection

---

## ArcadeHub Integration Points

Music triggers in `src/components/arcade/ArcadeHub.tsx`:

```typescript
// Line 206 - Initial load
audioManager.playRandomHubMusic(3.0);

// Line 665 - Game start
audioManager.playGameMusic(gameId, 'primary', 2.0);

// Line 718 - Return to hub
audioManager.playRandomHubMusic(2.0);
```

---

## Testing

Run AudioManager tests:
```bash
npm test
```

All 21 AudioManager tests should pass.

---

## Future Enhancement Ideas

1. **Dynamic BPM Override** - Allow Lab to actually change track BPM in real-time
2. **Save Favorite Configurations** - Let users save seed + settings combos
3. **Share Seeds** - Generate shareable codes for Music Lab creations
4. **Achievement Integration** - Unlock Lab as achievement reward
5. **Per-Game Music Settings** - Let users assign custom tracks to games
6. **Waveform Visualizer** - Add visual feedback in Lab
7. **More Scales** - Add harmonic minor, whole tone, chromatic patterns
8. **Layered Instruments** - Let users toggle individual instrument layers

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

### Modify Music Lab UI

Edit `src/components/arcade/AudioSettings.tsx`:
- Simple mode controls: Lines 567-633
- Mood selector: Lines 636-664
- Advanced controls (scale/key): Lines 666-738
- Generate button: Lines 741-766

---

## Technical Notes

### Web Audio API Usage

- `AudioContext` for all audio operations
- `OscillatorNode` for synthesized sounds
- `GainNode` for volume envelopes
- `BiquadFilterNode` for frequency shaping
- `ConvolverNode` for reverb effects
- `DelayNode` for echo/delay effects

### Seeded Random

Uses Mulberry32 PRNG algorithm for reproducible randomness. Same seed always produces same melody.

### Performance Considerations

- Music loops run on `setInterval` (not requestAnimationFrame)
- Nodes are cleaned up after stop/fade
- Reverb impulse responses are generated once per track start

---

## Contact Points in Codebase

| Feature | Primary File | Key Function/Class |
|---------|-------------|-------------------|
| Track playback | AudioManager.ts | `playMusic()`, `playTrackByName()` |
| Procedural generation | ProceduralMusicEngine.ts | `playBeat()`, `MelodyGenerator` |
| UI controls | AudioSettings.tsx | Component state, handlers |
| Game integration | ArcadeHub.tsx | `playGameMusic()` calls |
| Scale definitions | ProceduralMusicEngine.ts | `SCALES` constant |
| Track definitions | ProceduralMusicEngine.ts | `TRACK_DEFINITIONS` constant |

---

*Document created: January 6, 2026*
*Last updated: January 6, 2026*
