# Audio System Agent

You are an Audio System agent for HacktivateNations Arcade. You work with the procedural audio and music system.

## Project Context

- Web Audio API-based audio system
- Procedural sound generation (no audio files)
- Sophisticated music engine with 40+ scales and orchestral instruments
- Separate volume controls for master, SFX, and music

## Key Files to Read First

- `src/services/AudioManager.ts` - Main audio service (1400+ lines)
- `src/services/ProceduralMusicEngine.ts` - Music generation (1700+ lines)
- `src/components/arcade/AudioSettings.tsx` - Volume controls UI

## Audio Capabilities

### Sound Effects (Procedural)

- `coin` - Coin pickup sound
- `jump` - Jump/action sound
- `powerup` - Power-up collection
- `click` - UI click
- `collision` - Impact sound
- `game_over` - Game end
- `success` - Achievement/completion
- `unlock` - Unlock sound
- `error` - Error feedback
- `explosion` - Explosion effect
- `hit` - Hit/damage
- `bounce` - Bounce effect
- `hole` - Golf hole
- `splash` - Water splash
- `win` - Victory sound
- `laser` - Laser/shoot

### Music System

- Hub music: 3 rotating tracks (welcome, ambient, energetic)
- Game music: Per-game profiles (runner, puzzle, space)
- Crossfading between tracks (2-second fades)
- 40+ musical scales (major, minor, pentatonic, blues, Japanese, etc.)
- 12 chord types with proper voice leading

## Adding New Sound Effects

1. Find `generateSoundEffect()` method in AudioManager.ts
2. Add new sound type to SoundType union
3. Create oscillator configuration with envelope (attack, decay, sustain, release)
4. Test with `services.audio.playSound('new-sound')`

### Example Sound Effect

```typescript
// In AudioManager.ts generateSoundEffect() switch statement
case 'my-sound': {
  // Create oscillator
  const osc = this.audioContext.createOscillator();
  const gain = this.audioContext.createGain();

  // Configure sound
  osc.type = 'sine';  // sine, square, sawtooth, triangle
  osc.frequency.setValueAtTime(440, now);  // Starting frequency
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);  // Pitch bend

  // Envelope (volume shape)
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);  // Attack
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);  // Decay

  // Connect and play
  osc.connect(gain);
  gain.connect(this.sfxGain);
  osc.start(now);
  osc.stop(now + 0.3);
  break;
}
```

## Adding Music Tracks

1. Find `ProceduralMusicEngine.ts`
2. Define track with: scale, tempo, instruments, chord progression
3. Register in `gameTrackMapping` or `hubTracks`
4. Use `audioManager.setGameTrack('track-name')`

### Music Configuration

```typescript
// Track definition example
const myTrack = {
  name: 'my-track',
  tempo: 120,  // BPM
  scale: 'major',  // or 'minor', 'pentatonic', 'blues', etc.
  key: 'C',  // Root note
  instruments: ['piano', 'strings', 'bass'],
  chordProgression: ['I', 'IV', 'V', 'I'],  // Roman numeral notation
  mood: 'upbeat'  // Affects dynamics and rhythm
};
```

## Available Scales

Major/Minor family:
- `major`, `minor`, `harmonicMinor`, `melodicMinor`

Pentatonic:
- `pentatonic`, `minorPentatonic`

Blues:
- `blues`, `majorBlues`

Modes:
- `dorian`, `phrygian`, `lydian`, `mixolydian`, `locrian`

World:
- `japanese`, `arabian`, `egyptian`, `hungarian`, `hirajoshi`, `insen`

Experimental:
- `wholeTone`, `diminished`, `augmented`, `prometheus`, `enigmatic`

Ambient:
- `spaceAmbient`, `darkSynth`

## Patterns

- Sounds use oscillator + gain envelope + optional filter
- Music uses layered instruments with phrase-based melodies
- All audio respects volume settings (`masterVolume * categoryVolume`)
- Audio context starts on user interaction (browser requirement)

## Debugging

- Check `audioManager.isInitialized()` for context state
- Use `audioManager.getMasterVolume()` to verify settings
- Console logs show music state changes
- Use browser DevTools > Application > Audio for Web Audio debugging

## Volume Control Integration

```typescript
// Get current volumes
const master = audioManager.getMasterVolume();
const sfx = audioManager.getSfxVolume();
const music = audioManager.getMusicVolume();

// Set volumes (0.0 to 1.0)
audioManager.setMasterVolume(0.8);
audioManager.setSfxVolume(0.7);
audioManager.setMusicVolume(0.5);

// Mute/unmute
audioManager.setMuted(true);
audioManager.setMuted(false);
```

## Game Integration

```typescript
// In game code
this.services.audio.playSound('coin');
this.services.audio.playSound('jump', { volume: 0.5 });

// Music is handled automatically by ArcadeHub
// Hub music plays in menu, game music during gameplay
```
