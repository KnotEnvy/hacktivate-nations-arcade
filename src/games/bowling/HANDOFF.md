# Retro Strike Bowling - Development Handoff

## Project Overview

**Game:** Retro Strike Bowling - A Tier 2 physics-based bowling game for HacktivateNations Arcade
**Status:** Beta quality - Physics polished with Wii-style effects, visual juice added

## Recent Enhancements (v2.0 - Wii-Style Polish)

### Pin Physics Improvements

- **Wobble animation** - Pins wobble when nearly hit (near-miss feedback)
- **Air-time simulation** - Pins briefly "pop up" before falling on hard hits
- **Enhanced tumbling** - More dramatic rotation (up to 12 rad/s vs previous 3)
- **Slower fall animation** - Falls at dt*2.0 instead of dt*5 for visibility
- **Better chain reactions** - Knockdown threshold lowered (4 vs 6)

### Visual Effects

- **Wood splinter particles** - Tumbling elongated wood pieces on impacts
- **Shockwave effect** - Expanding ring on high-intensity (>0.6) collisions
- **Dust clouds** - Rising dust puffs at impact points
- **Slow-motion** - 0.5s slow-mo on first big hit (potential strikes)
- **Directional screen shake** - Shake direction follows ball velocity

### Physics Constants (PhysicsSystem.ts)

```typescript
PIN_PIN_RESTITUTION = 0.9     // Up from 0.85 - bouncier pins
BALL_VELOCITY_RETENTION = 0.85 // Down from 0.88 - ball loses more energy  
PIN_IMPULSE_MULTIPLIER = 2.8   // Up from 2.0 - bigger scatter
knockdownThreshold = 4         // Down from 6 - easier chain reactions
```

### Pin Constants (Pin.ts)

```typescript
SLIDE_FRICTION = 0.92     // Down from 0.94 - pins slide further
ANGULAR_DAMPING = 0.85    // Down from 0.90 - more visible rotation
rotationVel cap = 12      // Up from 3 - allows tumbling
airTime max = 0.4s        // NEW - pins pop up briefly
```

---

## File Structure

```
src/games/bowling/
├── BowlingGame.ts          # Main game class (slow-mo, shockwaves)
├── entities/
│   ├── Ball.ts             # Bowling ball with spin/hook
│   ├── Pin.ts              # Pin physics, wobble, air-time
│   ├── Lane.ts             # Lane layout, oil patterns
│   └── AimIndicator.ts     # Click-power-click input UI
├── systems/
│   ├── PhysicsSystem.ts    # Collision physics (enhanced chain reactions)
│   ├── ScoreSystem.ts      # 10-frame bowling scoring
│   └── ParticleSystem.ts   # Effects (splinters, shockwaves, dust)
└── HANDOFF.md              # This file
```

## Input System

4-phase click sequence:

1. **POSITION** - A/D or arrows to move ball
2. **AIM** - Click to lock oscillating aim angle
3. **POWER** - Click to lock power meter
4. **SPIN** - Click for Left/Straight/Right hook

## Commands

```bash
npm run dev          # Start dev server
npm run type-check   # Check TypeScript
npm run build        # Production build
```

## Next Steps (Potential Future Work)

- [ ] Add pin velocity trails for fast-moving pins
- [ ] Camera zoom towards pins on big impacts  
- [ ] Animated "STRIKE!" text with scale effect
- [ ] Escalating audio intensity based on pin count
- [ ] Pin clatter sounds during settling phase
