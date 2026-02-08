# Crystal Caverns - Phase 3: Final Polish & Release

> **Version**: 1.0 | **Status**: In Progress (P3-1, P3-3, P3-4, P3-5, P3-6 complete — Audio, Performance, Launch remaining)
> **Target**: Public Release Ready
> **Quality Bar**: Premium Indie Game Polish
> **Last Updated**: 2026-02-07
>
> *"Players should be amazed by the amount of polish. They'll come back for more and demand DLC."*

---

## Executive Summary

Phase 3 transforms Crystal Caverns from a feature-complete game into a **release-ready product** that stands alongside premium indie titles. Every aspect receives final polish: visuals, audio, gameplay feel, progression systems, and player experience.

### Release Criteria
- [ ] Zero critical/high-severity bugs
- [ ] 60 FPS stable performance
- [ ] Complete audio experience (music + SFX)
- [ ] Achievement system functional
- [x] Local leaderboards working *(top 10, name entry, persist to localStorage)*
- [x] All 5 levels playtested and balanced *(L5 redesigned with 4 zones)*
- [x] Story fully integrated and impactful *(typewriter, story triggers, inscriptions, skeletons)*
- [x] Controls feel "tight" and responsive *(coyote time, jump buffer, variable jump)*
- [x] Game over screen shows death stats, session stats, high score entry

---

## Sprint Overview

| Sprint | Focus | Priority | Est. Effort | Status |
|--------|-------|----------|-------------|--------|
| P3-1 | Visual Atmosphere | HIGH | Large | **DONE** (parallax, lighting, particles, animation) |
| P3-2 | Audio & Music | HIGH | Medium | NOT STARTED (saved for last) |
| P3-3 | Game Feel & Juice | HIGH | Medium | **DONE** (camera, hit feedback, movement polish) |
| P3-4 | Progression Systems | MEDIUM | Medium | **DONE** (score breakdown, leaderboard, level unlock, game over screen) |
| P3-5 | Level Design Polish | HIGH | Large | **DONE** (all 5 levels revamped, L5 redesigned with 4 zones) |
| P3-6 | UI/UX Refinement | MEDIUM | Medium | **DONE** (HUD, story typewriter, pause, level select, game over) |
| P3-7 | Performance & QA | HIGH | Large | NOT STARTED |
| P3-8 | Launch Prep | HIGH | Small | NOT STARTED |

---

# P3-1: Visual Atmosphere

## 1.1 Parallax Background System

**Goal**: Add depth and atmosphere to every level with layered backgrounds.

### Layer Structure
```typescript
interface ParallaxLayer {
  name: string;
  scrollFactor: number;  // 0.0 = fixed, 1.0 = moves with camera
  yOffset: number;
  opacity: number;
  render: (ctx: CanvasRenderingContext2D, camX: number, camY: number) => void;
}

const PARALLAX_LAYERS: ParallaxLayer[] = [
  { name: 'distant_glow', scrollFactor: 0.05, yOffset: 0, opacity: 0.3 },
  { name: 'far_crystals', scrollFactor: 0.15, yOffset: -20, opacity: 0.5 },
  { name: 'mid_stalactites', scrollFactor: 0.3, yOffset: -50, opacity: 0.7 },
  { name: 'near_chains', scrollFactor: 0.5, yOffset: 0, opacity: 0.9 },
];
```

### Per-Level Themes
| Level | Background Theme | Key Elements |
|-------|------------------|--------------|
| 1 | Ancient Entry | Crumbling arches, distant torchlight, dust motes |
| 2 | Crystal Forest | Towering crystal formations, ethereal mist, reflections |
| 3 | Fallen Hall | Broken pillars, scattered weapons, ghostly silhouettes |
| 4 | Labyrinth Depths | Twisting passages, multiple paths visible, ancient machinery |
| 5 | Heart Chamber | Massive central crystal, golden light rays, Shadow tendrils |

### Implementation Tasks
- [x] Create ParallaxBackground class *(rendering/ParallaxBackground.ts - 1017 lines)*
- [x] Design 4 layers per level (20 total layer designs)
- [x] Implement smooth scrolling with camera
- [x] Add subtle animation (floating dust, flickering lights)
- [x] Optimize rendering (only draw visible portions, viewport culling)

### Implementation Notes (Completed 2026-02-05)
- **File**: `src/games/platform-adventure/rendering/ParallaxBackground.ts`
- 5 level themes with 4 parallax layers each (scrollFactor: 0.05, 0.15, 0.3, 0.5)
- 25+ procedurally drawn element types using hashNoise deterministic generation
- Horizontal wrapping for seamless scrolling
- Per-element animation (floating, swaying, pulsing)
- Background gradient colors tuned for visibility: not too dark, cave-appropriate
- Ambient overlay tint per level theme

---

## 1.2 Dynamic Torch Lighting

**Goal**: Torches cast realistic flickering light that illuminates surroundings.

### Lighting System
```typescript
class DynamicLighting {
  private torches: TorchLight[] = [];
  private ambientDarkness: number = 0.6;  // Base darkness level

  renderLightingOverlay(ctx: CanvasRenderingContext2D): void {
    // Create darkness layer
    ctx.fillStyle = `rgba(0, 0, 0, ${this.ambientDarkness})`;
    ctx.fillRect(0, 0, width, height);

    // Cut out light circles with additive blending
    ctx.globalCompositeOperation = 'destination-out';
    for (const torch of this.torches) {
      torch.renderLight(ctx);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

class TorchLight {
  flickerPhase: number = 0;
  baseRadius: number = 120;

  update(dt: number): void {
    this.flickerPhase += dt * 8;
    this.currentRadius = this.baseRadius +
      Math.sin(this.flickerPhase) * 10 +
      Math.sin(this.flickerPhase * 2.3) * 5 +
      Math.random() * 3;
  }

  renderLight(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.currentRadius
    );
    gradient.addColorStop(0, 'rgba(255, 200, 100, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 150, 50, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 100, 20, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

### Light Sources (Actual Implementation)
| Source | Radius | Color | Flicker | Purpose |
|--------|--------|-------|---------|---------|
| Wall Torch | 180px | Warm orange | High (15) | Mounted on walls, relights player torch |
| Crystal | 80px | Cool blue | Low pulse (3) | Ambient cave glow |
| Spectral Crystal | 100px | Purple | Pulsing (5) | Haunted/story atmosphere |
| Golden Owl | 200px | Golden | Steady glow | Level 5 objective beacon |
| Player Torch | 200px | Warm orange | Medium (8) | Always-on player light, dims over time |
| Moonlight | 280px | Silver-blue | None (slow pulse) | Ambient ceiling shafts at key areas |

### Player Torch Mechanic
- Player always carries a torch (not tied to sword)
- Brightness drains from 100% to 25% over 45 seconds
- Walking near a wall torch relights to full brightness
- Radius: 200px (full) → 70px (dim)
- Each level starts with a fresh torch

### Moonlight System
- Auto-placed near gates, switches, and door/exit
- Spaced at regular intervals along levels (400-1000px, wider in deeper levels)
- Positioned at 35% level height (simulates ceiling cracks)
- Large radius (280px), soft silver-blue glow, no flicker

### Implementation Tasks
- [x] Create DynamicLighting class *(rendering/DynamicLighting.ts - ~500 lines)*
- [x] Implement torch flicker algorithm (multi-sine + random)
- [x] Add light sources for all relevant tiles (torch, crystal, spectral_crystal, owl)
- [x] Create ambient darkness per level (L1: 0.05, L2: 0.12, L3: 0.22, L4: 0.35, L5: 0.45)
- [x] Player torch mechanic (dims over time, relight near wall torches)
- [x] Moonlight system (auto-placed ambient lighting at key areas)
- [x] Performance: offscreen canvas rendering, light culling for off-screen sources
- [x] Colored light glows via 'screen' composite mode

### Implementation Notes (Completed 2026-02-05)
- **File**: `src/games/platform-adventure/rendering/DynamicLighting.ts`
- Uses offscreen canvas + destination-out compositing for light cutouts
- Colored glow layer on top using 'screen' blend mode
- Radial gradient with generous center brightness (40% radius at 90% cutout)
- Ambient darkness overlay is level-specific, progressively darker
- placeMoonlights() in PlatformGame.ts auto-distributes ambient light

---

## 1.3 Particle System Enhancements

### New Particle Effects
| Effect | Trigger | Particles | Lifetime |
|--------|---------|-----------|----------|
| Dust motes | Ambient | 20-30 | Continuous |
| Torch sparks | Torch tiles | 2-4 | 0.5s |
| Crystal shimmer | Crystal tiles | 5-10 | 0.8s |
| Footstep dust | Player running | 3-5 | 0.3s |
| Wall impact | Player hits wall | 5-8 | 0.4s |
| Death dissolve | Enemy death | 30-50 | 1.5s |
| Owl radiance | Owl collected | 100+ | 3s |

### Implementation Tasks
- [x] Add ambient dust particle spawning
- [x] Create torch spark emitter
- [x] Crystal shimmer effect
- [x] Player movement particles (footstep dust, landing impact)
- [x] Enhanced death animations
- [x] Victory celebration particles (owl radiance)

---

## 1.4 Character Animation Polish

### Animation Improvements
| Animation | Current | Target |
|-----------|---------|--------|
| Idle | Static | Subtle breathing, occasional look around |
| Walk | Basic cycle | Weight shift, arm swing |
| Run | Fast walk | Leaning forward, urgent movement |
| Jump | Single frame | Anticipation, apex, landing |
| Attack | Swing | Wind-up, strike, follow-through |
| Block | Raise shield | Brace impact, recovery |
| Hurt | Flash red | Stagger direction, recovery frames |
| Death | Fall | Dramatic collapse, weapon drop |

### Implementation Tasks
- [x] Add breathing to idle animation
- [x] Improve walk/run cycle fluidity
- [x] Jump anticipation and landing squash
- [x] Attack wind-up telegraph
- [x] Directional hurt stagger
- [x] Dramatic death sequence

---

# P3-2: Audio & Music

## 2.1 Music System

### Track List
| Track | Level/Trigger | Mood | BPM |
|-------|---------------|------|-----|
| `cavern_ambience` | Levels 1-2 | Mysterious, foreboding | N/A |
| `tension_builds` | Level 3-4 | Building danger | 80 |
| `boss_approach` | Near Captain/Shadow | Anticipation | 100 |
| `captain_battle` | Captain fight | Intense, martial | 120 |
| `shadow_battle` | Shadow fight | Epic, desperate | 140 |
| `shadow_phase2` | Shadow 30-70% HP | Increasing intensity | 150 |
| `shadow_phase3` | Shadow <30% HP | Frantic, climactic | 160 |
| `victory_fanfare` | Boss defeated | Triumphant | 100 |
| `owl_theme` | Owl collected | Majestic, hopeful | 80 |
| `game_over` | Player death | Somber | 60 |

### Music Transitions
```typescript
class MusicManager {
  crossfade(fromTrack: string, toTrack: string, duration: number): void {
    // Smooth transition between tracks
  }

  onBossApproach(bossType: GuardType): void {
    this.crossfade(this.currentTrack, 'boss_approach', 2.0);
  }

  onBossPhaseChange(phase: number): void {
    if (phase === 2) this.crossfade('shadow_battle', 'shadow_phase2', 0.5);
    if (phase === 3) this.crossfade('shadow_phase2', 'shadow_phase3', 0.5);
  }

  onVictory(): void {
    this.fadeOut(this.currentTrack, 1.0);
    this.play('victory_fanfare');
  }
}
```

### Implementation Tasks
- [ ] Create/source 10 music tracks
- [ ] Implement MusicManager class
- [ ] Add crossfade transitions
- [ ] Hook boss fight music triggers
- [ ] Victory/defeat musical cues
- [ ] Volume controls in settings

---

## 2.2 Sound Effect Polish

### Missing Sound Effects
| Sound | Trigger | Priority |
|-------|---------|----------|
| `gem_pickup` | Collect gem | HIGH |
| `health_restore` | Collect health | HIGH |
| `time_bonus` | Collect time crystal | HIGH |
| `door_open` | Exit door activates | MEDIUM |
| `trap_spike` | Spikes extend | MEDIUM |
| `trap_chomper` | Blade swings | MEDIUM |
| `loose_crumble` | Floor breaks | MEDIUM |
| `story_appear` | Story panel shows | LOW |
| `story_advance` | SPACE pressed | LOW |
| `level_complete` | Door entered | HIGH |
| `owl_collect` | Golden Owl taken | HIGH |

### Sound Variations
```typescript
// Add variation to prevent repetitive sounds
function playSound(name: string): void {
  const variations = SOUND_VARIATIONS[name] ?? 1;
  const variation = Math.floor(Math.random() * variations);
  const pitch = 0.95 + Math.random() * 0.1;  // ±5% pitch variation
  audioManager.play(`${name}_${variation}`, { pitch });
}
```

### Implementation Tasks
- [ ] Create/source all missing sound effects
- [ ] Add pitch variation system
- [ ] Implement sound priorities (important sounds don't get cut)
- [ ] Add collectible pickup jingles
- [ ] Boss-specific sound effects
- [ ] Environmental ambience layers

---

## 2.3 Audio Mixing

### Volume Levels
| Category | Default | Range |
|----------|---------|-------|
| Master | 80% | 0-100% |
| Music | 60% | 0-100% |
| SFX | 80% | 0-100% |
| Ambience | 40% | 0-100% |
| Voice (future) | 80% | 0-100% |

### Audio Settings UI
- [ ] Master volume slider
- [ ] Music volume slider
- [ ] SFX volume slider
- [ ] Mute toggles
- [ ] Save preferences to localStorage

---

# P3-3: Game Feel & Juice

## 3.1 Screen Effects

### Camera Improvements
```typescript
class Camera {
  // Smooth follow with slight lag
  private lerpSpeed: number = 8;

  // Look-ahead when moving
  private lookAheadDistance: number = 50;
  private lookAheadSpeed: number = 4;

  // Slight vertical offset when jumping/falling
  private verticalOffset: number = 0;

  update(dt: number, player: Player): void {
    const targetX = player.centerX + player.facingRight ?
      this.lookAheadDistance : -this.lookAheadDistance;
    const targetY = player.centerY + this.verticalOffset;

    this.x = lerp(this.x, targetX, this.lerpSpeed * dt);
    this.y = lerp(this.y, targetY, this.lerpSpeed * dt);
  }
}
```

### Screen Shake Presets
| Event | Intensity | Duration | Frequency |
|-------|-----------|----------|-----------|
| Player hurt | 5px | 0.2s | High |
| Guard death | 3px | 0.15s | High |
| Captain death | 12px | 1.0s | Medium |
| Shadow death | 20px | 2.0s | Low rumble |
| Trap trigger | 2px | 0.1s | High |
| Landing (high fall) | 4px | 0.15s | High |

### Implementation Tasks
- [x] Implement smooth camera follow *(lerp speed 8)*
- [x] Add look-ahead based on movement direction *(50px ahead)*
- [x] Vertical camera offset for jumping *(±40px)*
- [x] Screen shake preset system *(9 presets: PLAYER_HURT, GUARD_DEATH, CAPTAIN_DEATH, SHADOW_DEATH, LANDING_IMPACT, BLOCK_CLASH, HIT_ENEMY, TRAP_HIT, PHASE_CHANGE)*
- [x] Screen flash effects *(triggerScreenFlash with color, alpha, duration)*
- [ ] Chromatic aberration on big hits (optional - not implemented)

### Implementation Notes (Completed 2026-02-05)
- **File**: `src/games/platform-adventure/rendering/Camera.ts` (235 lines)
- Sine wave oscillation with ease-out decay for screen shake
- Frequency parameter controls shake feel (60Hz = jittery, 15Hz = low rumble)
- Level bounds clamping prevents camera going outside level
- snapTo() used on level start for instant positioning

---

## 3.2 Hit Feedback

### Hit Stop (Frame Freeze)
```typescript
onHitConnect(attacker: Entity, target: Entity, damage: number): void {
  // Freeze game briefly for impact
  const hitStopFrames = Math.min(damage * 2, 6);  // 2-6 frames
  this.freezeFrames = hitStopFrames;

  // Flash target white
  target.flashColor = '#ffffff';
  target.flashDuration = 0.1;

  // Knockback
  const knockbackForce = damage * 100;
  target.velocity.x = (target.x > attacker.x ? 1 : -1) * knockbackForce;

  // Particles
  this.particles.createSwordImpact(target.centerX, target.centerY);
}
```

### Implementation Tasks
- [x] Tune hit stop duration by damage
- [x] White flash on hit
- [x] Directional knockback
- [x] Impact particles with directionality
- [x] Boss hits have extra feedback

---

## 3.3 Movement Polish

### Coyote Time
```typescript
// Allow jump briefly after leaving platform
private coyoteTime: number = 0.1;  // 100ms window
private timeSinceGrounded: number = 0;

update(dt: number): void {
  if (this.grounded) {
    this.timeSinceGrounded = 0;
  } else {
    this.timeSinceGrounded += dt;
  }
}

canJump(): boolean {
  return this.grounded || this.timeSinceGrounded < this.coyoteTime;
}
```

### Jump Buffering
```typescript
// Remember jump input briefly before landing
private jumpBufferTime: number = 0.1;
private timeSinceJumpPressed: number = Infinity;

onJumpPressed(): void {
  this.timeSinceJumpPressed = 0;
}

update(dt: number): void {
  this.timeSinceJumpPressed += dt;

  if (this.grounded && this.timeSinceJumpPressed < this.jumpBufferTime) {
    this.performJump();
    this.timeSinceJumpPressed = Infinity;
  }
}
```

### Implementation Tasks
- [x] Implement coyote time (100ms) *(timeSinceGrounded tracking)*
- [x] Implement jump buffering (100ms) *(bufferJump() + tryBufferedJump() after collision)*
- [x] Variable jump height (release early = lower jump) *(JUMP_CUT_MULTIPLIER = 0.65)*
- [ ] Landing recovery frames
- [ ] Edge correction (push player onto ledge if close)

### Implementation Notes (Completed 2026-02-05)
- **File**: `src/games/platform-adventure/entities/Player.ts`
- **CRITICAL**: Jump buffer check must run AFTER collision resolution in PlatformGame.ts
  - Running it in Player.update() caused wall-sticking and block-phasing bugs
  - PlatformGame calls `player.tryBufferedJump()` after `handlePlayerCollision()`
- Variable jump only cuts velocity when `state === 'jump'` (guard prevents cutting during fall)
- Edge detection pattern: `jumpKeyWasPressed` tracks previous frame, bufferJump() on press edge, onJumpRelease() on release edge

---

# P3-4: Progression Systems

## 4.1 Achievement System

### Achievement Categories

#### Story Achievements
| ID | Name | Description | Icon |
|----|------|-------------|------|
| `first_blood` | First Blood | Defeat your first guard | Sword |
| `captain_slayer` | Captain Slayer | Defeat the Captain | Crown |
| `shadow_vanquished` | Shadow Vanquished | Defeat the Shadow Guardian | Eye |
| `owl_claimed` | Seeker of Truth | Claim the Golden Owl | Owl |
| `story_complete` | Legend Complete | See the victory ending | Book |

#### Skill Achievements
| ID | Name | Description | Icon |
|----|------|-------------|------|
| `flawless_1` | Untouchable I | Complete Level 1 without damage | Shield |
| `flawless_5` | Untouchable V | Complete Level 5 without damage | Diamond |
| `speedrun` | Speed Seeker | Complete game in under 8 minutes | Clock |
| `parry_master` | Parry Master | Block 50 attacks total | Shield+ |
| `counter_king` | Counter King | Land 20 counter-attacks | Sword+ |
| `pacifist` | Path of Peace | Complete Level 1 without attacking | Dove |

#### Collection Achievements
| ID | Name | Description | Icon |
|----|------|-------------|------|
| `gem_hunter` | Gem Hunter | Collect 100 gems total | Gem |
| `gem_perfectionist` | Perfectionist | Collect all gems in a level | Star |
| `time_lord` | Time Lord | Finish with 60+ seconds remaining | Hourglass |
| `completionist` | Completionist | Earn all achievements | Trophy |

### Achievement System
```typescript
class AchievementManager {
  private unlocked: Set<string> = new Set();
  private progress: Map<string, number> = new Map();

  check(id: string, condition: boolean): void {
    if (condition && !this.unlocked.has(id)) {
      this.unlock(id);
    }
  }

  increment(id: string, amount: number = 1): void {
    const current = this.progress.get(id) ?? 0;
    this.progress.set(id, current + amount);

    const achievement = ACHIEVEMENTS[id];
    if (current + amount >= achievement.target) {
      this.unlock(id);
    }
  }

  unlock(id: string): void {
    this.unlocked.add(id);
    this.save();
    this.showNotification(ACHIEVEMENTS[id]);
  }

  showNotification(achievement: Achievement): void {
    // Animated popup: icon + name + description
    // Plays unlock sound
    // Auto-dismisses after 3 seconds
  }
}
```

### Implementation Tasks
- [ ] Create AchievementManager class
- [ ] Define all achievements with requirements
- [ ] Achievement unlock notification UI
- [ ] Achievement gallery/viewer screen
- [ ] Persist to localStorage
- [ ] Progress tracking (X/50 blocks)

---

## 4.2 Leaderboard System

### Leaderboard Entry
```typescript
interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  time: number;      // Seconds remaining
  deaths: number;
  date: string;      // ISO date
  achievements: number;  // Count unlocked during run
}
```

### Scoring Breakdown
| Action | Points | Notes |
|--------|--------|-------|
| Gem collected | 100 | Base value |
| Time remaining | 10/sec | At level end |
| Speed bonus | x2 | < 60 seconds on level |
| No-hit bonus | 500 | Per level completed flawless |
| Guard defeated | 200 | Regular guards |
| Captain defeated | 500 | Mini-boss |
| Shadow defeated | 2000 | Final boss |
| Perfect block | 50 | Timed block |
| Counter attack | 100 | Hit after perfect block |

### Score Multiplier System
```typescript
class ScoreMultiplier {
  current: number = 1.0;
  private comboTimer: number = 0;
  private comboWindow: number = 3.0;  // Seconds

  onScoreAction(): void {
    this.comboTimer = this.comboWindow;
    this.current = Math.min(this.current + 0.1, 3.0);  // Max 3x
  }

  update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
    } else {
      this.current = Math.max(1.0, this.current - dt * 0.5);  // Decay
    }
  }

  getScore(base: number): number {
    return Math.floor(base * this.current);
  }
}
```

### Implementation Tasks
- [x] Create Leaderboard class
- [x] Score breakdown screen at level end
- [x] Score multiplier system with UI indicator
- [x] Top 10 local leaderboard
- [x] Name entry on high score
- [x] Persist to localStorage

---

## 4.3 End-of-Level Summary

### Level Complete Screen
```
╔══════════════════════════════════════════════╗
║       LEVEL 3 COMPLETE - GAUNTLET OF FALLEN  ║
╠══════════════════════════════════════════════╣
║                                              ║
║   GEMS COLLECTED      15/18    1,500 pts     ║
║   TIME REMAINING      47 sec     470 pts     ║
║   GUARDS DEFEATED      4          800 pts    ║
║   CAPTAIN BONUS       x1          500 pts    ║
║   NO-HIT BONUS        x0            0 pts    ║
║   ─────────────────────────────────────────  ║
║   SUBTOTAL                      3,270 pts    ║
║   MULTIPLIER                      x1.4       ║
║   ─────────────────────────────────────────  ║
║   LEVEL SCORE                   4,578 pts    ║
║   TOTAL SCORE                  12,847 pts    ║
║                                              ║
║          [PRESS SPACE TO CONTINUE]           ║
╚══════════════════════════════════════════════╝
```

### Implementation Tasks
- [x] Design level complete UI
- [x] Animate score counting up
- [x] Show item-by-item breakdown
- [x] Display any achievements unlocked
- [x] Continue to next level or credits

---

# P3-5: Level Design Polish

## 5.1 Level-by-Level Review

### Level 1: The Forgotten Threshold
**Target Time**: 90-120 seconds
**Difficulty**: Tutorial

| Check | Item | Status |
|-------|------|--------|
| [ ] | Teaches movement naturally | |
| [ ] | First guard is easy to defeat | |
| [ ] | Story elements clearly visible | |
| [ ] | Switch/gate mechanic introduced | |
| [ ] | Traps are telegraphed | |
| [ ] | Door is clearly marked | |
| [ ] | Gem placement guides path | |

### Level 2: Hall of Whispers
**Target Time**: 90-120 seconds
**Difficulty**: Easy-Medium

| Check | Item | Status |
|-------|------|--------|
| [ ] | Crystal mood established | |
| [ ] | Spectral crystal clearly visible | |
| [ ] | Multiple route options | |
| [ ] | Traps increase in complexity | |
| [ ] | Guards patrol effectively | |

### Level 3: Gauntlet of the Fallen
**Target Time**: 100-140 seconds
**Difficulty**: Medium

| Check | Item | Status |
|-------|------|--------|
| [ ] | Captain arena has clear boundaries | |
| [ ] | Locked door visual is obvious | |
| [ ] | Checkpoint feeling before boss | |
| [ ] | Retreat space during fight | |
| [ ] | Story impact of Captain fight | |

### Level 4: Labyrinth of Choices
**Target Time**: 120-180 seconds
**Difficulty**: Medium-Hard

| Check | Item | Status |
|-------|------|--------|
| [ ] | Multiple paths visible | |
| [ ] | Fallen seeker emotionally impactful | |
| [ ] | Risk/reward choices clear | |
| [ ] | Final gate inscription atmospheric | |
| [ ] | Not frustratingly maze-like | |

### Level 5: Heart of Crystal
**Target Time**: 150-240 seconds
**Difficulty**: Hard (Boss)

| Check | Item | Status |
|-------|------|--------|
| [ ] | Owl visible from start | |
| [ ] | Shadow arena has room to maneuver | |
| [ ] | Phase transitions feel dramatic | |
| [ ] | Victory path clear after defeat | |
| [ ] | Emotional payoff satisfying | |

---

## 5.2 Secret Areas

### Hidden Content Ideas
| Level | Secret | Reward |
|-------|--------|--------|
| 1 | Hidden alcove behind crumbling wall | Extra gems + lore inscription |
| 2 | Crystal-lit side passage | Health potion + time crystal |
| 3 | Fallen warrior's cache | Max HP upgrade |
| 4 | Alternate shortcut route | Skip trap gauntlet |
| 5 | Pre-fight meditation spot | Full heal before Shadow |

### Implementation Tasks
- [ ] Design secret areas for each level
- [ ] Add hidden walls/passages
- [ ] Place meaningful rewards
- [ ] Optional lore for completionists

---

## 5.3 Visual Landmarks

Each level needs **memorable visual moments**:

| Level | Landmark | Purpose |
|-------|----------|---------|
| 1 | Giant carved face on wall | "This place is ancient" |
| 2 | Massive crystal formation | "Beauty in danger" |
| 3 | Graveyard of weapons | "Many have failed" |
| 4 | Crumbling bridge | "Point of no return" |
| 5 | Owl pedestal light beam | "The goal is real" |

---

# P3-6: UI/UX Refinement

## 6.1 HUD Improvements

### Current HUD Elements
- Health hearts (top-left)
- Score (top-right)
- Timer (top-center)
- Boss health bar (when applicable)

### HUD Polish Tasks
- [x] Animate health changes (pulse on damage/heal)
- [x] Score pop-ups when collecting items
- [x] Timer warning (flash when <30 seconds)
- [x] Multiplier indicator (when active)
- [x] Subtle gem counter
- [ ] Mini-map (optional, togglable) — deferred

---

## 6.2 Menu System

### Main Menu
```
╔══════════════════════════════════════╗
║         CRYSTAL CAVERNS              ║
║     Seek the Light. Face the Shadow. ║
╠══════════════════════════════════════╣
║                                      ║
║          ▶ NEW GAME                  ║
║            CONTINUE                  ║
║            LEVEL SELECT              ║
║            LEADERBOARDS              ║
║            ACHIEVEMENTS              ║
║            SETTINGS                  ║
║                                      ║
╚══════════════════════════════════════╝
```

### Pause Menu
- Resume
- Restart Level
- Settings
- Quit to Menu

### Settings Menu
- Audio (Master, Music, SFX sliders)
- Controls (show keybindings)
- Display (screen shake toggle, particles toggle)

### Implementation Tasks
- [x] Design main menu with game logo
- [x] Implement level select screen
- [x] Create settings panel
- [x] Pause menu functionality
- [x] Save/load game state

---

## 6.3 Story Presentation

### Story Panel Polish
- [ ] Add character portrait (Kael, Captain, Shadow, Owl) — deferred
- [x] Typewriter text effect (skippable)
- [x] Background dim during story
- [ ] Sound effect on text appearance — needs audio sprint
- [x] Smooth fade in/out transitions

### Loading Screens
- [x] Level name and subtitle (level_intro state)
- [x] Atmospheric quote or hint
- [x] Progress indicator
- [ ] Quick tip rotation — deferred

---

# P3-7: Performance & QA

## 7.1 Performance Targets

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Frame Rate | 60 FPS | TBD | Stable, no drops |
| Input Latency | <50ms | TBD | Responsive controls |
| Load Time | <2s | TBD | Per level |
| Memory | <150MB | TBD | No leaks |
| Bundle Size | <5MB | TBD | Initial load |

### Optimization Tasks
- [ ] Profile rendering performance
- [ ] Implement object pooling for particles
- [ ] Lazy load audio assets
- [ ] Optimize collision detection
- [ ] Reduce draw calls where possible
- [ ] Test on low-end devices

---

## 7.2 Bug Severity & Tracking

### Severity Levels
| Severity | Definition | Response |
|----------|------------|----------|
| **CRITICAL** | Game crashes, data loss | Fix immediately |
| **HIGH** | Progression blocked, major feature broken | Fix before release |
| **MEDIUM** | Gameplay affected but workaround exists | Fix if time permits |
| **LOW** | Minor visual/audio glitch | Backlog |
| **COSMETIC** | Polish issue | Nice to have |

### Known Issues to Verify
- [ ] Guards can't get stuck in walls
- [ ] Player can't clip through floors
- [ ] Boss phases trigger correctly
- [ ] All story events fire
- [ ] Score calculates accurately
- [ ] Achievements unlock properly
- [ ] Saves persist correctly

---

## 7.3 Playtesting Protocol

### Test Scenarios
1. **Fresh playthrough** - New player, no prior knowledge
2. **Speedrun attempt** - Rush through all levels
3. **100% completion** - Find all secrets, gems, achievements
4. **Death testing** - Intentionally die in various ways
5. **Edge cases** - Pause during transitions, spam inputs

### Feedback Collection
- Time to complete each level
- Deaths per level
- Points of confusion
- Moments of frustration
- Moments of satisfaction
- Overall difficulty rating

---

# P3-8: Launch Preparation

## 8.1 Final Checklist

### Content Complete
- [ ] All 5 levels finalized
- [ ] All story events written
- [ ] All achievements defined
- [ ] All sounds implemented
- [ ] All music tracks in place

### Quality Assurance
- [ ] Zero critical bugs
- [ ] Zero high-severity bugs
- [ ] Performance meets targets
- [ ] Controls feel tight
- [ ] Audio mix balanced

### Polish
- [ ] Tutorial teaches all mechanics
- [ ] Difficulty curve smooth
- [ ] Story emotionally impactful
- [ ] Victory feels earned
- [ ] Players want to replay

---

## 8.2 Marketing Assets

### Screenshots (10+)
1. Title screen with logo
2. Level 1 first moments
3. Combat action shot
4. Story dialogue moment
5. Crystal environment beauty shot
6. Captain boss fight
7. Shadow Guardian reveal
8. Golden Owl discovery
9. Victory celebration
10. Achievement unlock

### Trailer Moments
- Opening story hook
- Gameplay montage
- Boss fight clips
- Story quotes on screen
- Victory moment
- "Available Now" end card

### Store Description
> **Crystal Caverns: The Legend of the Golden Owl**
>
> Descend into the Crystal Caverns as Kael, a royal spy seeking redemption. Navigate treacherous traps, duel undead guardians, and face your own shadow in this atmospheric action-platformer.
>
> **Features:**
> - Tight, responsive Prince of Persia-style controls
> - Strategic sword combat with blocking and counters
> - Two epic boss battles
> - Rich narrative with branching dialogue
> - Hidden secrets and achievements
> - Local leaderboards

---

## 8.3 Future Content Hooks

### DLC Ideas (Post-Launch)
| Name | Content | Hook in Base Game |
|------|---------|-------------------|
| **Thornhold Rising** | Prequel - Captain's story | Captain's death dialogue |
| **The Hollow's Reach** | Sequel - Fight Malachar | Oracle Flame subplot |
| **Echoes of Seekers** | Side stories - Other Guardians | Skeleton remains, journals |
| **Time Trial Mode** | Speedrun challenges | Leaderboard system |
| **Boss Rush** | Fight all bosses | Achievement unlock |

### Expansion Tile Types
- `moving_platform` - Horizontal/vertical platforms
- `teleporter` - Warp between points
- `pressure_bridge` - Timed bridge appearance
- `dark_zone` - No torch light, use sound
- `mirror` - Reflects player for puzzles

---

# Appendix: Implementation Priority

## Must Have (Release Blockers)
1. Performance stable at 60 FPS
2. All critical bugs fixed
3. Complete audio (music + SFX)
4. ~~Level design balanced~~ **DONE** (all 5 levels revamped, L5 redesigned)
5. ~~Story triggers working correctly~~ **DONE**
6. ~~Save system functional~~ **DONE** (localStorage persistence)

## Should Have (High Value)
1. Achievement system
2. ~~Leaderboards~~ **DONE** (top 10, name entry, persist)
3. ~~Parallax backgrounds~~ **DONE**
4. ~~Dynamic lighting~~ **DONE** (with player torch + moonlight)
5. ~~Score breakdown screen~~ **DONE** (level complete + game over)
6. ~~Menu system polish~~ **DONE** (main menu, pause, level select)

## Nice to Have (Post-Launch)
1. Secret areas
2. ~~Additional particle effects~~ **DONE** (7 types)
3. ~~Character animation improvements~~ **DONE** (breathing, squash, stagger, death)
4. Speedrun mode
5. Controller support
6. Accessibility options

---

*"The difference between a good game and a great game is 1000 small decisions made with care."*

**End of Phase 3 Document**
*Crystal Caverns v1.0 Target: Q1 2026*
