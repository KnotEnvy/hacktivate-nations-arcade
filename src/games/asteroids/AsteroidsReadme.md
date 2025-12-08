# 🚀 Asteroids - Tier 2 Game

A complete, feature-rich classic asteroids game for the HacktivateNations Arcade platform. This is the **second Tier 2 game**, featuring authentic arcade-style gameplay with modern visual polish and all CPU-generated graphics.

## 🎮 The 7 Key Features

### 1. **Thrust-Based Ship Physics**
- Realistic momentum with rotation, acceleration, and drag
- Smooth velocity-capped movement that feels tight and responsive
- Engine particle trails that react to thrust input
- WASD or Arrow keys for rotation and thrust

### 2. **Screen Wraparound**
- Classic edge-to-edge teleportation
- Ship, bullets, and asteroids all wrap seamlessly
- Authentic arcade feel with continuous play area

### 3. **Asteroid Splitting System**
- **Large Asteroids**: 45px radius, 3 HP, splits into 2 medium
- **Medium Asteroids**: 25px radius, 2 HP, splits into 2 small
- **Small Asteroids**: 12px radius, 1 HP, destroyed completely
- Procedurally generated irregular polygon shapes
- Physics inheritance on split (momentum transfer)

### 4. **Multi-Weapon System & Power-ups**
| Power-up | Icon | Effect | Duration |
|----------|------|--------|----------|
| **Rapid Fire** | R | 3x fire rate | 8 seconds |
| **Spread Shot** | S | 5-bullet fan pattern | 10 seconds |
| **Shield** | O | Invulnerability bubble | 8 seconds |
| **Extra Life** | + | +1 life | Instant |
| **Bomb** | B | Destroys all on-screen enemies | Instant |

### 5. **UFO Encounters**
| UFO Type | Behavior | HP | Points |
|----------|----------|-----|--------|
| **Large UFO** | Random firing, slow | 3 | 200 |
| **Small UFO** | Aims at player, fast | 2 | 1,000 |

- Dynamic spawn chance increases with wave
- Direction changes and evasive patterns
- Higher power-up drop rates

### 6. **Shield & Lives System**
- Start with 3 lives
- Spawn invincibility (3 seconds with visual flicker)
- Collectible shield power-up
- Extra life every 10,000 points
- Visual indicators for remaining lives

### 7. **Wave Progression & Scoring**
- Base points: Large (20), Medium (50), Small (100)
- **Combo System**: Multiplier increases with consecutive kills (up to 3x)
- **Wave Bonus**: +500 × wave number on completion
- **Difficulty Scaling**:
  - More asteroids each wave (+1 per wave)
  - Increased asteroid health every 2 waves
  - Faster asteroid speeds (+5% per wave)
  - Higher UFO spawn chance

## 🎨 Graphics

All graphics are **100% CPU-generated** using Canvas 2D API:
- Vector-based ship with glow effects
- Procedurally generated irregular asteroid polygons
- Dynamic particle systems (thrust, explosions, debris)
- Neon retro color scheme with bloom effects
- Smooth 60fps rendering

## 🕹️ Controls

| Key | Action |
|-----|--------|
| **↑ / W** | Thrust forward |
| **← / A** | Rotate left |
| **→ / D** | Rotate right |
| **SPACE** | Fire weapon |

## 💰 Economy Integration

- **Pickups**: +1 per asteroid destroyed
- **UFO Bonus**: +2 (large) or +5 (small) pickups
- **Wave Bonus**: +wave number pickups
- **Currency Formula**: `pickups * 10` coins
- Uses existing `CurrencyService` integration

## 📈 Difficulty Scaling

| Wave | Asteroid Count | Health Bonus | Speed Bonus |
|------|----------------|--------------|-------------|
| 1 | 4 | +0 | +0% |
| 2 | 5 | +0 | +5% |
| 3 | 6 | +1 | +10% |
| 4 | 7 | +1 | +15% |
| 5+ | 3+wave | +floor((wave-1)/2) | +(wave×5)% |

## 🏆 Achievement Data

The game tracks and reports extended data for achievements:
```typescript
{
  score: number,      // Final score
  pickups: number,    // Total pickups collected
  maxCombo: number,   // Highest combo achieved
  totalKills: number, // Total enemies destroyed
  wave: number,       // Wave reached
  lives: number,      // Lives remaining
  timePlayedMs: number, // Session duration
  coinsEarned: number   // Currency earned
}
```

## 🔧 Installation

### 1. Copy game files to `src/games/asteroids/`:
```
src/games/asteroids/
├── AsteroidsGame.ts
└── AsteroidsReadme.md
```

### 2. Register in `src/games/registry.ts`:
```typescript
gameLoader.registerGame('asteroids', async () => {
  const { AsteroidsGame } = await import('./asteroids/AsteroidsGame');
  return new AsteroidsGame();
});
```

### 3. Verify entry in `src/data/Games.ts`:
```typescript
{
  id: 'asteroids',
  title: 'Asteroids',
  thumbnail: '/games/asteroids/asteroids-thumb.svg',
  inputSchema: ['keyboard'],
  assetBudgetKB: 120,
  tier: 2,
  description: 'Blast space rocks in this retro shooter!'
}
```

### 4. Add thumbnail at `public/games/asteroids/asteroids-thumb.svg`

## 🎯 Visual Theme

The game uses a **Neon Retro** color palette:
- Ship: `#00ffff` (Cyan)
- Thrust: `#ff6600` (Orange)
- Bullets: `#ffff00` (Yellow)
- Asteroids: `#00ff88` (Green)
- Large UFO: `#ff00ff` (Magenta)
- Small UFO: `#ff4466` (Pink)
- Shield: `#00ccff` (Light Blue)
- Background: `#0a0a1a` (Deep Space)

---

Built with ❤️ for HacktivateNations Arcade
