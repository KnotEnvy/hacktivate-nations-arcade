# Retro Strike Bowling - Development Handoff

## Project Overview
**Game:** Retro Strike Bowling - A Tier 2 physics-based bowling game for HacktivateNations Arcade
**Status:** Nearly complete, needs physics fine-tuning and bug fixes

## File Structure
```
src/games/bowling/
├── BowlingGame.ts          # Main game class (extends BaseGame)
├── entities/
│   ├── Ball.ts             # Bowling ball with spin/hook mechanics
│   ├── Pin.ts              # Pin physics, rendering, knockdown logic
│   ├── Lane.ts             # Lane layout, oil patterns, pin positions
│   └── AimIndicator.ts     # Click-power-click input system UI
├── systems/
│   ├── PhysicsSystem.ts    # Ball-pin and pin-pin collision physics
│   ├── ScoreSystem.ts      # 10-frame bowling scoring logic
│   └── ParticleSystem.ts   # Visual effects (impacts, celebrations)
└── HANDOFF.md              # This file
```

## Current Implementation Status

### Completed Features
- [x] Lane rendering with gutters, oil zones, arrows, approach dots
- [x] Pin triangle layout (head pin at bottom, row of 4 at top)
- [x] Click-power-click input system (Position → Aim → Power → Spin → Throw)
- [x] Ball physics with spin/hook in dry zone
- [x] 10-frame scoring with strikes, spares, 10th frame logic
- [x] Scorecard UI on right side
- [x] Aiming UI panels on left side (power meter, phase indicator)
- [x] Particle effects for impacts
- [x] Sound effects (pin_hit, pin_scatter, gutter)
- [x] 13 bowling achievements in achievements.ts
- [x] Game registered in registry.ts and Games.ts

### Known Bugs / Issues to Fix
1. **Physics still needs tweaking** - Ball/pin interaction feel not quite perfect yet
2. **Pin-pin collisions** - Chain reactions could be more consistent
3. **Ball deflection** - Sometimes ball still bounces off pins instead of plowing through
4. **Wall bounces** - Pins bouncing off walls to hit other pins works but could be better
5. **Frame logic** - Split detection may show at unexpected times

## Key Physics Values (in PhysicsSystem.ts)
```typescript
BALL_PIN_RESTITUTION = 0.85   // Pin bounce off ball
PIN_PIN_RESTITUTION = 0.85    // Pin-pin bounce
BALL_VELOCITY_RETENTION = 0.88 // Ball keeps 88% speed per pin hit
PIN_IMPULSE_MULTIPLIER = 2.0   // How hard pins get hit
```

## Key Physics Values (in Pin.ts)
```typescript
SLIDE_FRICTION = 0.94         // Pin sliding friction
ANGULAR_DAMPING = 0.90        // Rotation slowdown
maxVel = 220                  // Max pin velocity
bounceRestitution = 0.65      // Wall bounce strength
```

## Input System (AimIndicator.ts)
The game uses a 4-phase click sequence:
1. **POSITION** - Use A/D or Left/Right arrows to move ball position
2. **AIM** - Click to lock oscillating aim angle
3. **POWER** - Click to lock oscillating power meter
4. **SPIN** - Click to select Left/Straight/Right hook

## Lane Orientation
- Ball starts at **BOTTOM** of screen (approach area)
- Pins are at **TOP** of screen (pin deck)
- Ball rolls **UPWARD** (negative Y velocity)
- Head pin (pin 1) is at **BOTTOM** of triangle (closest to ball)
- Back row (pins 7,8,9,10) is at **TOP** of triangle

## Scoring System (ScoreSystem.ts)
- Standard 10-frame bowling rules
- Strikes: all 10 pins on first ball
- Spares: remaining pins on second ball
- 10th frame: up to 3 rolls if strike/spare
- Tracks consecutive strikes for Turkey/combos

## Audio (in AudioManager.ts)
Added sounds:
- `pin_hit` - Crack/clatter on ball-pin impact
- `pin_scatter` - Multiple pin collision sounds
- `gutter` - Disappointed thud for gutter ball

## Achievements (in achievements.ts)
13 bowling achievements including:
- first_strike, first_spare, lane_debut
- double_trouble, turkey, clean_game
- century_club (100+), 150_club, 200_club, high_roller (250+), perfect_game (300)
- gutter_ball, gutter_master

## Quick Start for Next Session
1. Run `npm run dev` to start dev server
2. Navigate to the bowling game in the arcade
3. Test physics by throwing balls at different angles/speeds
4. Key files to modify for physics: `PhysicsSystem.ts`, `Pin.ts`, `Ball.ts`

## Physics Tuning Tips
- Increase `PIN_IMPULSE_MULTIPLIER` for pins to fly further
- Decrease `BALL_VELOCITY_RETENTION` for ball to slow more
- Adjust `bounceRestitution` in Pin.ts for wall bounces
- Lower knockdown threshold (currently 6) for easier chain reactions

## User's Feedback from Last Session
- Pins were flying too far (reduced impulse multiplier)
- Ball should slow down more through pins (done)
- Pins should bounce off walls and hit other pins (improved)
- Pin-pin chain reactions need more work
- Overall feel is "very close" to being right

## Commands
```bash
npm run dev          # Start dev server
npm run type-check   # Check for TypeScript errors
npm run build        # Production build
```
