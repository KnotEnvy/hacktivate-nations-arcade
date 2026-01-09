# Game Visual Enhancement Handoff Guide

Quick reference for enhancing arcade games to match Snake and Minesweeper's visual quality.

---

## Architecture Pattern

All enhanced games follow this structure:

```
src/games/{game-name}/
├── systems/
│   ├── ParticleSystem.ts    # Visual effects (bursts, sparkles, explosions)
│   └── ScreenShake.ts       # Camera shake for impact feedback
├── entities/                 # (Optional) Separate entity classes
│   └── {Entity}.ts          # Animated game objects
├── {GameName}Game.ts        # Main game class (extends BaseGame)
└── index.ts                 # Export
```

---

## Required Systems (Copy & Adapt)

### ParticleSystem.ts

Reference: [Snake ParticleSystem](file:///d:/JavaScript%20Games/HacktivateArcade/hacktivate-nations-arcade/src/games/snake/systems/ParticleSystem.ts)

Key effects to implement:

- `createBurst(x, y, color)` - Collection/pickup feedback
- `createSparkle(x, y)` - Golden sparkle for coins/points
- `createExplosion(x, y)` - Death/damage effect
- `createConfetti(width)` - Victory celebration
- `addScorePopup(x, y, text, color)` - Floating score text

### ScreenShake.ts

Reference: [Snake ScreenShake](file:///d:/JavaScript%20Games/HacktivateArcade/hacktivate-nations-arcade/src/games/snake/systems/ScreenShake.ts)

```typescript
shake(intensity: number, duration: number): void
getOffset(): { x: number; y: number }
```

---

## Visual Enhancement Checklist

For each game, implement:

- [ ] **Particle System** - Add visual feedback for key actions
- [ ] **Screen Shake** - Impact feedback for collisions/explosions
- [ ] **Gradient Backgrounds** - Replace flat colors with gradients
- [ ] **Entity Animations** - Pulse, bob, scale, rotation effects
- [ ] **Glow Effects** - `ctx.shadowColor` + `ctx.shadowBlur`
- [ ] **Custom HUD** - Set `renderBaseHud = false`, implement `onRenderUI`
- [ ] **Score Popups** - Floating text on point gain
- [ ] **Death Animation** - Add 'dying' state with timer before game over
- [ ] **Victory Effects** - Confetti, flash, sound
- [ ] **Hover/Active States** - Visual feedback for interactive elements
- [ ] **Prevent Context Menu** - `canvas.addEventListener('contextmenu', e => e.preventDefault())`

---

## Code Patterns

### Death Animation Delay

```typescript
type GameState = 'playing' | 'dying' | 'won' | 'lost';
private deathTimer = 0;
private readonly deathDuration = 2.0;

// In onUpdate:
if (this.gameState === 'dying') {
  this.deathTimer += dt;
  if (this.deathTimer >= this.deathDuration) {
    this.gameState = 'lost';
    this.endGame();
  }
}
```

### Spawn Animation (prevent negative radius)

```typescript
const scale = Math.max(0.01, this.easeOutBack(this.progress));
```

### 3D Beveled Button

```typescript
// Light edge (top-left)
ctx.strokeStyle = '#FFFFFF';
ctx.beginPath();
ctx.moveTo(x, y + h);
ctx.lineTo(x, y);
ctx.lineTo(x + w, y);
ctx.stroke();

// Shadow edge (bottom-right)
ctx.strokeStyle = '#808080';
ctx.beginPath();
ctx.moveTo(x + w, y);
ctx.lineTo(x + w, y + h);
ctx.lineTo(x, y + h);
ctx.stroke();
```

---

## Games Already Enhanced

| Game | Status | Lines |
|------|--------|-------|
| Snake | ✅ Complete | ~1200 |
| Minesweeper | ✅ Complete | ~1180 |

## Games Needing Enhancement

Review current implementation complexity before enhancing:

| Game | Current Lines | Priority |
|------|---------------|----------|
| Breakout | Check | High |
| Memory | Check | Medium |
| Block (Tetris) | Check | High |
| Tower Builder | Check | Medium |
| Mini Golf | Check | Low |

---

## Audio Integration

Use existing sound names from AudioManager:

```typescript
this.services.audio.playSound('success');   // Win/collect
this.services.audio.playSound('collision'); // Hit/damage
this.services.audio.playSound('coin');      // Pickup
this.services.audio.playSound('powerup');   // Power-up
this.services.audio.playSound('game_over'); // Death (called by BaseGame)
```

---

## Key Files to Reference

- [Snake/SnakeGame.ts](file:///d:/JavaScript%20Games/HacktivateArcade/hacktivate-nations-arcade/src/games/snake/SnakeGame.ts) - Full example with all systems
- [Minesweeper/MinesweeperGame.ts](file:///d:/JavaScript%20Games/HacktivateArcade/hacktivate-nations-arcade/src/games/minesweeper/MinesweeperGame.ts) - Retro 3D style example
- [BaseGame.ts](file:///d:/JavaScript%20Games/HacktivateArcade/hacktivate-nations-arcade/src/games/shared/BaseGame.ts) - Base class methods
- [CLAUDE.md](file:///d:/JavaScript%20Games/HacktivateArcade/Archived/CLAUDE.md) - Project architecture
