# Frog Hop Game - Session Handoff Document

## Current Status: FULLY PLAYABLE - Enhanced & Polished

The Frog Hop game is complete and fully functional with extensive visual and gameplay enhancements.

---

## CRITICAL BUG (FIXED)

### The Original Problem
In `src/games/frog-hop/FrogHopGame.ts`, the delta time was being divided by 1000 when it was already in seconds:
```typescript
// WRONG - dt is ALREADY in seconds!
const dtSeconds = dt / 1000;
```

### The Fix Applied
```typescript
protected onUpdate(dt: number): void {
  dt = Math.min(dt, 0.033); // Clamp to prevent huge jumps - dt is already in seconds
  const dtMs = dt * 1000;   // Convert to milliseconds for timer-based logic
  // ... use dt for physics, dtMs for millisecond timers
}
```

**Key insight**: The game loop in `useGameModule.ts` passes dt in SECONDS. Use `dt` directly for physics/movement, and `dt * 1000` (dtMs) for millisecond-based timers.

---

## Files & Structure

### Main Game File
**`src/games/frog-hop/FrogHopGame.ts`** (~3000 lines)

### Code Structure
```
FrogHopGame.ts Structure:
├── Types & Interfaces (lines 1-150)
│   ├── GameState, Direction, VehicleType, PowerUpType
│   ├── Frog (with hopHeight for arc animation)
│   ├── Vehicle, Log, Turtle (with canSubmerge), Crocodile
│   ├── LilyPad, PowerUp, Particle (with 'ripple' type)
│   ├── Cloud, Tree (parallax background)
│   ├── ScorePopup, LadyFrog (gameplay enhancements)
│
├── Constants (lines 150-230)
│   ├── GRID_SIZE (40), CANVAS_WIDTH (600), CANVAS_HEIGHT (680)
│   ├── COLORS object (frog, vehicles, water, UI colors)
│   ├── LANE_CONFIG (road lanes, river lanes with speeds)
│
├── State Variables (lines 240-295)
│   ├── Game state, round, lives, score, timer
│   ├── Visual effects (waterOffset, screenShake, flashTimer)
│   ├── Celebration state (celebrationTimer, celebrationPhase, dancingFrogY)
│   ├── Parallax (clouds[], trees[])
│   ├── Gameplay (scorePopups[], ladyFrog, comboCount, nearMissCombo)
│
├── Lifecycle Methods
│   ├── onInit, onUpdate, onRender, onRestart, onDestroy
│
├── Update Methods
│   ├── updatePlaying - main game logic
│   ├── updateFrogMovement - hop arc, landing particles
│   ├── updateVehicles, updateRiverPlatforms
│   ├── updateParticles, updatePowerUps
│   ├── updateClouds (parallax)
│   ├── updateScorePopups, updateLadyFrog, updateCombo
│   ├── updateCelebration - round complete animation
│
├── Collision & Game Logic
│   ├── checkCollisions - vehicles, crocs, near-miss detection
│   ├── reachLilyPad - with combo system
│   ├── killFrog, respawnFrog
│   ├── rescueLadyFrog
│
├── Particle Spawners
│   ├── spawnSplash, spawnExplosion, spawnSparkles
│   ├── spawnDust (landing on ground)
│   ├── spawnRipple (landing on water)
│   ├── spawnScorePopup
│
├── Render Methods
│   ├── renderBackground, renderClouds, renderTrees
│   ├── renderWater (with shimmer effect)
│   ├── renderRoad, renderMedian, renderGoalZone
│   ├── renderLilyPads (with glow for unfilled)
│   ├── renderLogs, renderTurtles, renderCrocodiles
│   ├── renderVehicles (with shadows)
│   ├── renderPowerUps (with glow)
│   ├── renderFrog (with shadow, hop height offset)
│   ├── renderLadyFrog (pink frog with bow)
│   ├── renderParticles (handles ripples specially)
│   ├── renderScorePopups
│   ├── renderHUD (with combo indicator)
│   ├── renderCelebration (dancing frog, confetti)
│   ├── renderGameOver
```

---

## Features Implemented

### Core Gameplay (Original)
- [x] 4 road lanes with vehicles (cars, trucks, buses, motorcycles)
- [x] 5 river lanes with logs and turtles
- [x] Turtles periodically submerge (staggered, some stable)
- [x] Crocodiles appear round 3+ (dangerous mouth)
- [x] 5 lily pads to fill per round
- [x] 3 lives, death types: hit, drowned, eaten, timeout
- [x] 30-second timer with visual bar
- [x] Power-ups: coins, time extend, shield, speed boost

### Visual Enhancements (Added)
- [x] **Parallax background** - 3 layers of clouds at different speeds
- [x] **Trees** - Pine, oak, bush along goal zone
- [x] **Frog shadow** - Dynamic size based on hop state
- [x] **Vehicle shadows** - Under all vehicles
- [x] **Water shimmer** - Animated sparkles on water surface
- [x] **Power-up glow** - Pulsing glow around power-ups
- [x] **Lily pad glow** - Unfilled pads glow to guide player
- [x] **Hop arc animation** - Frog rises 15px at peak of jump
- [x] **Landing particles** - Dust on ground, ripples on water

### Gameplay Enhancements (Added)
- [x] **Score popups** - Floating text for points earned
- [x] **Combo system** - Quick lily pad fills = multiplier (x2, x3...)
- [x] **Combo HUD** - Pulsing indicator with timer bar
- [x] **Lady Frog** - Pink frog on logs, 500 points to rescue
- [x] **Near-miss bonus** - "CLOSE CALL!" for near vehicle misses
- [x] **Round celebration** - Dancing frog, confetti, "ROUND COMPLETE!"

### Difficulty Balance (Tuned)
- [x] **Round 1**: 1 slow vehicle per lane (easy intro)
- [x] **Round 2**: Motorcycle lane gets 2 fast vehicles
- [x] **Round 3**: Most lanes get 2 vehicles
- [x] **Round 4-5**: 2 vehicles per lane
- [x] **Round 6+**: 2-3 vehicles, gradually increasing
- [x] **Fast log lane**: Middle log lane (y:240) moves at 70 speed

### Turtle Submerge Logic (Fixed)
- First turtle in each lane is STABLE (never submerges)
- In rounds 1-2, second turtle is also stable
- Submerge timers are staggered (3000 + i*2000 + random)
- Prevents impossible situations

---

## Key Interfaces

```typescript
interface Frog {
  x, y, targetX, targetY: number;
  direction: Direction;
  isMoving: boolean;
  moveProgress: number;
  hasShield, hasSpeedBoost, isInvincible: boolean;
  shieldTimer, speedBoostTimer, invincibleTimer: number;
  hopSquash: number;    // Squash/stretch animation
  hopHeight: number;    // Vertical arc offset
  idleTimer: number;
}

interface Turtle {
  x, y: number;
  count: 1 | 2 | 3;
  speed: number;
  direction: 1 | -1;
  lane: number;
  submergeTimer, submergePhase: number;
  isSubmerged: boolean;
  canSubmerge: boolean;  // Some turtles are stable
}

interface ScorePopup {
  x, y: number;
  text: string;
  color: string;
  lifetime, maxLifetime: number;
  scale: number;
}

interface LadyFrog {
  x, y: number;
  logIndex: number;
  lifetime: number;
  rescued: boolean;
  bobPhase: number;
}
```

---

## Lane Configuration

```typescript
const LANE_CONFIG = {
  startZone: { y: 560, height: 80, type: 'safe' },
  roadLanes: [
    { y: 520, direction: 1, baseSpeed: 60, vehicleType: 'truck' },
    { y: 480, direction: -1, baseSpeed: 100, vehicleType: 'motorcycle' },
    { y: 440, direction: 1, baseSpeed: 50, vehicleType: 'bus' },
    { y: 400, direction: -1, baseSpeed: 80, vehicleType: 'car' },
  ],
  medianZone: { y: 360, height: 40, type: 'safe' },
  riverLanes: [
    { y: 320, direction: 1, baseSpeed: 45, platformType: 'log' },
    { y: 280, direction: -1, baseSpeed: 50, platformType: 'turtle' },
    { y: 240, direction: 1, baseSpeed: 70, platformType: 'log' },  // FAST lane
    { y: 200, direction: -1, baseSpeed: 45, platformType: 'turtle' },
    { y: 160, direction: 1, baseSpeed: 50, platformType: 'log' },
  ],
  goalZone: { y: 100, height: 60, type: 'goal' },
};
```

---

## Known Working Behaviors

1. **Near-miss detection**: 25px margin around vehicles, 500ms cooldown, awards points with "CLOSE CALL!" popup and small screen shake

2. **Combo system**: 5-second window to maintain combo, resets on death, multiplier shown in HUD

3. **Lady Frog**: Spawns on random log after 20 seconds, 15-second lifetime, shows "HELP!" when urgent (<3s), awards 500 points

4. **Round celebration**: 3-second animation with dancing frog (bouncing, wobbling, happy face), confetti particles, fades to "GET READY FOR ROUND X"

5. **Particle types**: 'splash', 'explosion', 'sparkle', 'leaf' (used for dust), 'ripple' (expanding rings)

---

## Potential Future Enhancements

### Not Yet Implemented
- [ ] Snake hazard on logs (later rounds)
- [ ] Vehicle headlights at night (aesthetic for later rounds)
- [ ] More sound effect variety
- [ ] Achievement system integration

### Polish Ideas
- [ ] Tongue animation when eating flies
- [ ] Splash effect when frog enters water
- [ ] Tire tracks on road
- [ ] Log wake effects in water

---

## Important Code Patterns

### Delta Time Usage
```typescript
// In onUpdate:
dt = Math.min(dt, 0.033);  // Clamp to ~30fps max step
const dtMs = dt * 1000;     // For millisecond timers

// Physics/movement:
vehicle.x += vehicle.speed * vehicle.direction * dt;

// Timers:
this.timer -= dtMs;
this.comboTimer -= dtMs;
```

### Null Safety for Lady Frog
```typescript
private updateLadyFrog(dt: number, dtMs: number): void {
  if (!this.ladyFrog) return;
  // ... update logic
  if (dx < 25 && dy < 25) {
    this.rescueLadyFrog();
    return;  // IMPORTANT: Exit early, ladyFrog is now null
  }
  if (this.ladyFrog.lifetime <= 0) {
    this.ladyFrog = null;
  }
}
```

### Spawning Particles
```typescript
this.particles.push({
  x, y,
  vx: Math.cos(angle) * speed,
  vy: Math.sin(angle) * speed,
  lifetime: 0.5,
  maxLifetime: 0.5,
  color: '#FFFFFF',
  size: 5,
  type: 'sparkle',  // or 'splash', 'explosion', 'ripple', 'leaf'
});
```

---

## Commands

```bash
# Start dev server
npm run dev

# Type check (expect pre-existing errors in other games, FrogHop should be clean)
npx tsc --noEmit 2>&1 | grep -i "frog-hop"

# Full type check
npm run type-check

# Build
npm run build
```

---

## Testing Checklist

- [x] Frog moves with arrow keys/WASD
- [x] Frog moves with touch/swipe
- [x] Vehicles move and wrap around screen
- [x] Logs and turtles move correctly
- [x] Some turtles submerge (not all at once)
- [x] Frog rides on platforms in water
- [x] Death triggers on vehicle collision
- [x] Death triggers when falling in water
- [x] Lily pads fill when reached
- [x] Round completes when all 5 filled
- [x] Round celebration shows dancing frog
- [x] Difficulty increases each round
- [x] Near-miss popup shows when close to vehicles
- [x] Combo multiplier works for quick fills
- [x] Lady Frog appears and can be rescued
- [x] Game over works correctly

---

## Session History

### Session 1 (Original)
- Created complete FrogHopGame with 7 key features
- Had critical dt bug (dividing by 1000 twice)

### Session 2 (Current)
1. Fixed dt bug - game now moves correctly
2. Fixed turtle submerge logic - staggered timers, some stable
3. Added visual enhancements:
   - Parallax clouds and trees
   - Shadows under frog and vehicles
   - Glow effects on power-ups and lily pads
   - Water shimmer effects
4. Added gameplay enhancements:
   - Score popup system
   - Combo system with HUD indicator
   - Lady Frog bonus character
   - Near-miss bonus detection
5. Added polish:
   - Hop arc animation (frog rises during jump)
   - Landing particles (dust on ground, ripples on water)
6. Fixed Lady Frog null reference error
7. Rebalanced difficulty (Frogger-style progression)
8. Increased middle log lane speed
9. Added round celebration with dancing frog

---

*Document updated: Session 2 complete - game fully playable and polished*
