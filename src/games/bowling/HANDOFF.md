# Retro Strike Bowling - Development Handoff

## Project Status: Beta Ready ✅

**Game:** Retro Strike Bowling - A Tier 2 physics-based bowling game  
**Last Updated:** January 2026

---

## Recent Enhancements

### Wii-Style Pin Physics

| Feature | Description |
|---------|-------------|
| **Rolling Physics** | Pins rotate based on velocity - looks like rolling, not sliding |
| **Wobble Animation** | Near-miss pins wobble before settling |
| **Increased Collision Radius** | Pins now 10px radius (prevents flying over) |
| **Lower Friction** | `SLIDE_FRICTION = 0.975` - pins slide much further |
| **Chain Reactions** | Knockdown threshold lowered to 4 for easier chains |

### Pin Setter Animation

- Mechanical descend/sweep/ascend animation between rolls
- Metallic visual with cables, pin slots, warning stripes
- Properly handles 10th frame bonus roll resets

### Visual Effects

- Wood splinter particles on impacts
- Shockwave rings on high-intensity collisions
- Slow-motion moment on first big hit (potential strikes)
- Directional screen shake follows ball velocity

### 10th Frame Logic

- Proper pin reset for strikes/spares (all 10 pins return)
- Correct roll numbering ("2nd Ball" / "3rd Ball")
- Uses ScoreSystem's standingPins for accurate state

---

## Key Physics Constants

```typescript
// PhysicsSystem.ts
PIN_IMPULSE_MULTIPLIER = 2.8    // Scatter force
BALL_VELOCITY_RETENTION = 0.85  // Ball energy loss per pin
knockdownThreshold = 4          // Chain reaction sensitivity

// Pin.ts
radius = 10                     // Collision radius (px)
SLIDE_FRICTION = 0.975          // Very low - pins slide far
ANGULAR_DAMPING = 0.92          // Rotation decay

// BowlingGame.ts
MAX_BALL_SPEED = 180           // Max ball velocity
```

---

## File Structure

```
src/games/bowling/
├── BowlingGame.ts          # Main game, pin setter animation
├── entities/
│   ├── Ball.ts             # Ball physics, spin, hook
│   ├── Pin.ts              # Pin physics, wobble, rolling
│   ├── Lane.ts             # Lane layout, oil patterns
│   └── AimIndicator.ts     # 4-phase input UI
├── systems/
│   ├── PhysicsSystem.ts    # Collision handling
│   ├── ScoreSystem.ts      # 10-frame scoring
│   └── ParticleSystem.ts   # Visual effects
└── HANDOFF.md
```

---

## Commands

```bash
npm run dev          # Start dev server
npm run type-check   # TypeScript validation
npm run build        # Production build
```

---

## Future Build Ideas 💡

### Gameplay Enhancements

- [ ] **Multiple Ball Types** - Different weights/colors with varying physics
- [ ] **Skill Shots** - Bonus points for Brooklyn strikes, washouts
- [ ] **Trick Shots Mode** - Split challenges, specific pin targets
- [ ] **Tournament Mode** - Multiple games tracking, leaderboards

### Visual Polish

- [ ] **Ball Customization** - Unlockable skins, patterns, trails
- [ ] **Lane Themes** - Neon, retro arcade, cosmic bowling
- [ ] **Crowd Reactions** - Background cheers/groans based on rolls
- [ ] **Camera Zoom** - Follow ball into pins on big hits

### Physics & Realism

- [ ] **Oil Pattern Editor** - Custom patterns for advanced players
- [ ] **Ball Spin Visualization** - Show rotation during travel
- [ ] **Pin Action Replays** - Slow-mo replay of strike attempts
- [ ] **Detailed Split Detection** - Named splits (7-10, 4-6-7-10, etc.)

### Multiplayer & Social

- [ ] **Local 2-4 Player** - Turn-based multiplayer
- [ ] **Online Leaderboards** - Daily/weekly high scores
- [ ] **Ghost Replays** - Race against saved throws
- [ ] **Challenge Friends** - Share specific frames to beat

### Accessibility

- [ ] **Aim Assist Mode** - Visual trajectory prediction
- [ ] **One-Click Mode** - Simplified controls for younger players
- [ ] **Colorblind Options** - Pin/UI color adjustments
