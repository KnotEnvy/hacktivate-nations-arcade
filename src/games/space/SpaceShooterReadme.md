# 🚀 Space Shooter - Tier 2 Game

A complete, feature-rich space shooter game for the HacktivateNations Arcade platform. This is the first **Tier 2** game, featuring advanced gameplay mechanics and impressive CPU-generated graphics.

## 🎮 The 7 Key Features

### 1. **Fluid Ship Controls**
- Smooth acceleration-based physics with proper drag
- 8-directional movement using WASD or Arrow keys
- Responsive velocity-capped movement that feels tight and responsive
- Engine particle trails that react to movement

### 2. **Weapon Systems & Power-ups**
- **5 Weapon Levels**: Progressive power upgrades
  - Level 1: Single shot
  - Level 2: Triple shot
  - Level 3: Spread shot (angled bullets)
  - Level 4: Piercing shots
  - Level 5: Rear-firing guns!
- **Power-up Types**:
  - 🔶 **P** - Weapon Power Up
  - 🔷 **S** - Spread Shot
  - 🟡 **R** - Rapid Fire (10 seconds)
  - 🔵 **O** - Shield (8 seconds)
  - 🔴 **B** - +1 Bomb
  - 🟢 **+** - Health Restore

### 3. **Enemy Variety & AI** (6 Unique Types)
| Enemy | Behavior | HP | Points |
|-------|----------|-----|--------|
| **Basic** | Straight descent | 1 | 100 |
| **Sine** | Wavy side-to-side movement | 2 | 150 |
| **Shooter** | Slows down and fires aimed shots | 3 | 200 |
| **Diver** | Locks onto player and dives | 2 | 175 |
| **Spinner** | Circular orbit while descending | 4 | 250 |
| **Tanker** | Heavy armor, burst fire | 8 | 400 |

### 4. **Epic Boss Battles**
- Multi-phase boss fights after every 5 waves
- **Phase 1**: Spread shot attacks
- **Phase 2**: Aimed bursts + dense bullet patterns
- **Phase 3**: Chaos spiral + high-speed tracking shots
- Visual phase transitions with explosions
- Dynamic difficulty scaling across levels

### 5. **Particle Effects & Visual Polish**
- **Explosions**: Multi-layered with sparks, debris, and smoke
- **Engine trails**: Dynamic flame particles
- **Hit sparks**: Immediate feedback on damage
- **Screen shake**: Impact feedback for hits and bombs
- **Screen flash**: Visual feedback for damage taken
- **Ring explosions**: Bomb activation effect
- **Parallax starfield**: 3-layer depth with nebulae

### 6. **Wave-Based Progression**
- 5 waves per level, increasing difficulty
- Multiple spawn patterns:
  - **Line**: Horizontal formation
  - **Arc**: Curved formation
  - **V-Shape**: Arrow formation
  - **Random**: Scattered entry
- Timed spawns within each wave
- Boss appears after wave 5
- Level progression increases enemy HP

### 7. **Combo Scoring System**
- Kill streaks build combo multiplier
- Up to **3x multiplier** for sustained kills
- 2-second combo timeout
- Visual combo counter with color changes:
  - White: 2-3x combo
  - Orange: 4-5x combo
  - Yellow: 6x+ combo
- Score popups show combo bonus
- Max combo tracked for achievements

## 🎯 Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move ship |
| Space / J / Z | Fire weapon |
| B | Use Bomb (clears bullets, damages all enemies) |
| R | Restart (when game over) |

**Note:** Auto-fire only activates during the Rapid Fire power-up. Otherwise, hold the fire button to shoot.

## 📊 Level Complete Stats Screen

After defeating each boss, a detailed stats screen shows your performance:

- **Accuracy %** - Shots hit vs shots fired
- **Shots Fired/Hit** - Total projectiles
- **Enemies Destroyed** - Kill count for the level
- **Max Combo** - Highest kill streak achieved
- **Damage Taken** - Hits received (0 = perfect!)
- **Power-ups Collected** - Items grabbed
- **Boss Fight Time** - How long to defeat the boss
- **Grade** - S/A/B/C/D rating based on overall performance

### Grading Criteria:
- **S Rank**: 90+ points (Perfect accuracy, no damage, high combo, fast boss kill)
- **A Rank**: 80-89 points
- **B Rank**: 70-79 points
- **C Rank**: 50-69 points
- **D Rank**: Below 50 points

## 📊 HUD Elements

- **Score**: Top-left with comma formatting
- **Level/Wave**: Current progress indicator
- **Combo Counter**: Active combo multiplier
- **HP Bar**: Visual health with color warning
- **Bombs**: Available bomb count
- **Weapon Level**: Current weapon power
- **Power-up Timers**: Shield/Rapid fire duration
- **Coins**: Current pickups for currency

## 🛠️ Installation

### 1. Copy game files:
```
src/games/space/
├── SpaceShooterGame.ts    # Main game class
└── index.ts               # Module export

public/games/space/
└── space-thumb.svg        # 512x512 thumbnail
```

### 2. Register in `src/games/registry.ts`:
```typescript
gameLoader.registerGame('space', async () => {
  const { SpaceShooterGame } = await import('./space/SpaceShooterGame');
  return new SpaceShooterGame();
});
```

### 3. Verify entry in `src/data/Games.ts`:
```typescript
{
  id: 'space',
  title: 'Space Shooter',
  thumbnail: '/games/space/space-thumb.svg',
  inputSchema: ['keyboard'],
  assetBudgetKB: 100,
  tier: 2,
  description: "Defend the galaxy from alien waves! Features 6 enemy types, boss battles, power-ups, and combo scoring."
}
```

## 🎨 Graphics

All graphics are **100% CPU-generated** using Canvas 2D API:
- Vector-based ship with gradients
- Procedural enemy designs
- Dynamic particle systems
- Parallax star field with nebulae
- Smooth animations at 60fps

## 💰 Economy Integration

- **Pickups**: +1 per enemy killed
- **Boss Bonus**: +20 pickups for boss kill
- **Currency Formula**: `pickups * 10` coins
- Uses existing `CurrencyService` integration
- Tracked achievements: `maxCombo`, `totalKills`, `level`, `wave`

## 📈 Difficulty Scaling

| Level | Enemy HP Bonus | Boss HP |
|-------|----------------|---------|
| 1 | +0 | 50 |
| 2 | +0.5 | 70 |
| 3 | +1 | 90 |
| 4+ | +0.5 per level | +20 per level |

## 🏆 Achievement Data

The game tracks and reports extended data for achievements:
```typescript
{
  maxCombo: number,    // Highest combo achieved
  totalKills: number,  // Total enemies destroyed
  level: number,       // Level reached
  wave: number         // Wave reached within level
}
```

---

Built with ❤️ for HacktivateNations Arcade