# 🏗️ Tower Builder - Tier 1 Game

A precision block-stacking game for the HacktivateNations Arcade platform. Build the tallest tower possible by timing your block drops perfectly! This is a **Tier 1 game** featuring addictive one-button gameplay with beautiful CPU-generated graphics.

## 🎮 The 7 Key Features

### 1. **Swinging Block Placement**
The core mechanic that makes Tower Builder addictive:
- Blocks swing back and forth above the tower
- Speed increases progressively with each successful placement
- Starting speed: 250 px/s
- Maximum speed: 500 px/s (+8 px/s per block)
- Players must time their taps perfectly to land blocks precisely

**Mechanics:**
- Block bounces off screen edges
- Visual indicator line shows drop trajectory
- Audio click on direction change

### 2. **Physics & Balance System**
Realistic stacking with consequences for imprecise placement:

| Placement Type | Overlap | Result |
|---------------|---------|--------|
| **Perfect** | ≤5px offset | Full block retained, combo builds |
| **Good** | ≤15px offset | Block retained, combo resets |
| **Normal** | Partial overlap | Block trimmed to overlap area |
| **Miss** | No overlap | Game Over! |

- Blocks shrink when not perfectly aligned
- Smaller blocks = harder to land next block
- Minimum block width: 20px (very challenging!)
- Creates natural difficulty curve

### 3. **Height Progression & Scoring**
Score system rewards precision over luck:

| Action | Points | Coins |
|--------|--------|-------|
| Perfect landing | 100 + (combo × 50) | Points ÷ 50 |
| Good landing | 50 | 1 |
| Normal landing | 20 × precision% | 0 |

- Height = number of blocks successfully placed
- Score multiplied by active combo
- Coins calculated: `floor(score/100) + (pickups)`
- Extended stats tracked for achievements

### 4. **Perfect Landing Combos**
Build massive combos for huge scores:

| Combo | Bonus Multiplier | Visual Effect |
|-------|-----------------|---------------|
| 1 | 1.0x | None |
| 2 | 1.5x | Small shake |
| 3+ | 2.0x+ | Golden flash + stars |
| 5+ | 3.0x+ | Screen shake + sparkles |
| 10+ | 5.0x+ | Massive celebration! |

- Perfect threshold: ≤5px offset from center
- Combo counter displays with animated scaling
- Achievement sound plays at 3+ combo
- Maximum combo tracked for stats

### 5. **Visual Effects & Polish**
Satisfying feedback for every action:

**Particle Systems:**
- Golden star burst on perfect landings
- White sparkles for combos
- Colored dust on normal landings
- Confetti debris for block trimming
- Rainbow explosion on power-up use

**Screen Effects:**
- Dynamic screen shake (scales with combo)
- Golden flash overlay on perfects
- Slow-motion visual filter
- Animated combo counter scaling

**Block Rendering:**
- Gradient shading with highlights
- Shadow effects for depth
- Golden border on perfect blocks
- Sparkle indicators on perfect tower blocks

### 6. **Power-ups System**
Three power-ups spawn randomly (15% chance after block 2):

| Power-up | Icon | Color | Effect |
|----------|------|-------|--------|
| **Slow Motion** | ⏱ | Cyan | Slows block swing to 40% for 5 seconds |
| **Widen** | ↔ | Green | Next block is 40px wider |
| **Auto-Perfect** | ★ | Gold | Next drop automatically centers |

**Power-up Mechanics:**
- Float with bobbing animation
- Collected when block lands nearby
- Timer display for slow motion
- One-time use for widen/perfect
- Particle burst on collection

### 7. **Dynamic Camera & Parallax Background**
Immersive visuals that respond to tower height:

**Camera System:**
- Smooth following as tower grows
- Eased transitions (5× interpolation)
- Keeps action centered on screen
- Shows ~8 blocks at a time

**Parallax Cityscape:**
Three layers of buildings with different scroll speeds:
| Layer | Speed | Color | Features |
|-------|-------|-------|----------|
| Far | 10% | #1a1a2e | Simple silhouettes |
| Mid | 20% | #16213e | Windows (lit at night) |
| Near | 35% | #0f3460 | Detailed windows |

**Dynamic Sky:**
Sky transitions based on tower height:
| Height | Sky Theme |
|--------|-----------|
| 0-25 | Day (blue gradient) |
| 25-50 | Sunset (orange/pink) |
| 50+ | Night (dark with stars) |

**Additional Elements:**
- Animated clouds (8 parallax clouds)
- Twinkling stars (appear at night)
- Building windows light up at sunset/night

## 🎯 Scoring System

### Base Scoring
- **100 points** per perfect landing
- **50 points** per good landing
- **20 × precision%** for normal landings
- Combo multiplier applied to all points

### Combo Calculation
```
bonus = min(perfectStreak, 10) × 50
totalPoints = 100 + bonus
```

### Coin Rewards
```
coins = floor(score / 100) + directPickups
```
Multiplied by daily challenge bonus when active.

## 🎨 Visual Style

### Block Color Palette
Colors cycle through 10 vibrant options:
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Coral Red | #FF6B6B |
| 1 | Teal | #4ECDC4 |
| 2 | Sky Blue | #45B7D1 |
| 3 | Mint | #96CEB4 |
| 4 | Cream | #FFEAA7 |
| 5 | Lavender | #DDA0DD |
| 6 | Seafoam | #98D8C8 |
| 7 | Golden | #F7DC6F |
| 8 | Purple | #BB8FCE |
| 9 | Light Blue | #85C1E9 |

### Foundation Block
- Color: #2C3E50 (Dark slate)
- Width: 200px (maximum)
- Always present as base

## 🕹️ Controls

### Touch/Click
- **Tap anywhere** → Drop block

### Keyboard
- **Space** → Drop block
- **Enter** → Drop block

### Game Over Screen
- **Tap/Space** → Restart (after 1 second delay)

## 📊 Statistics Tracked

The game reports these stats for achievements:
- `height_reached` - Maximum tower height
- `perfect_streak` - Best combo achieved
- `total_perfects` - Lifetime perfect landings
- `blocks_placed` - Total blocks successfully placed

## 🏆 Achievement Integration

Compatible with the achievement system:
- Height milestone achievements
- Perfect streak achievements (3x, 5x, 10x)
- Total blocks placed milestones
- Power-up collection achievements

## 🔧 Technical Details

### Canvas Configuration
- **Canvas size**: 520×600 pixels
- **Block height**: 30px
- **Initial block width**: 200px
- **Minimum block width**: 20px
- **Ground Y position**: 540px

### Animation Timing
- Base swing speed: 250 px/s
- Max swing speed: 500 px/s
- Drop speed: 800 px/s
- Gravity: 1200 px/s²
- Camera interpolation: 5× per second

### Performance
- Efficient particle pooling
- Parallax rendering optimization
- 60 FPS target with delta-time smoothing
- Smooth animations on mobile devices

### Thresholds
- Perfect: ≤5px offset
- Good: ≤15px offset
- Power-up spawn: 15% chance

## 📁 File Structure

```
src/games/tower-builder/
├── TowerBuilderGame.ts     # Main game class (~900 lines)
├── index.ts                # Module export
└── TowerBuilderReadme.md   # This documentation
```

## 🎮 How to Play

1. **Start**: Block automatically begins swinging
2. **Aim**: Watch the block swing left to right
3. **Time**: Tap when block is centered over tower
4. **Stack**: Land as perfectly as possible
5. **Combo**: Chain perfect landings for big scores
6. **Power-ups**: Collect floating items for bonuses
7. **Survive**: Don't miss or tower gets too narrow!

## 💡 Tips for High Scores

1. **Focus on the edges** - Watch where your block aligns with the tower edges
2. **Build combo early** - Perfect landings are easier when blocks are wide
3. **Save power-ups** - Use slow-mo when blocks get narrow
4. **Stay calm** - Speed increases but patterns stay consistent
5. **Practice timing** - Learn the rhythm at each speed level

## 🎵 Sound Effects Used

- `click` - Block direction change / normal landing
- `coin` - Good landing
- `powerup` - Perfect landing / power-up collect
- `achievement` - 3+ combo streak
- `whoosh` - Block drop
- `game_over` - Game end

## 🔄 Game States

```
ready → swinging → dropping → landing → wobbling → swinging
                                    ↓
                                gameOver
```

- **ready**: Brief pause before first swing
- **swinging**: Block moving, awaiting input
- **dropping**: Block falling to tower
- **landing**: Processing collision result
- **wobbling**: Brief pause before next block
- **gameOver**: Final stats display

---

*Tower Builder is part of the HacktivateNations Arcade platform. Build tall, stack smart, and aim for perfection!* 🏗️✨
