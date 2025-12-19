# 💎 Color Drop - Tier 1 Game

A complete, feature-rich Bejeweled-style match-3 gem puzzle game for the HacktivateNations Arcade platform. This is a **Tier 1 game**, featuring addictive gem-swapping gameplay with beautiful CPU-generated graphics.

## 🎮 The 7 Key Features

### 1. **Gem Grid & Swapping System**
- **8x8 grid** of colorful hexagonal gems
- **6 gem types**: Red, Blue, Green, Yellow, Purple, Orange
- Click-to-select and click-to-swap adjacent gems
- Visual feedback with selection highlights and hover effects
- Smooth swap animations with easing curves
- Invalid swap detection with bounce-back animation

### 2. **Match Detection & Cascading**
- Detects **3+ gems in a row** horizontally or vertically
- **Automatic cascade system** - gems fall to fill gaps
- New gems spawn from above with spawn animation
- Chain reactions when falling gems create new matches
- Efficient match-finding algorithm handles complex patterns
- **No initial matches** - board always starts playable

### 3. **Combo System**
| Combo | Multiplier | Visual Effect |
|-------|------------|---------------|
| 1x | 1.0x | Normal |
| 2x | 1.5x | Small shake |
| 3x | 2.0x | Medium shake + particles |
| 4x | 2.5x | Large shake + more particles |
| 5x+ | 3.0x+ | Screen shake + fireworks |

- **2-second combo window** - keep matching to maintain combo
- Visual combo counter with timer bar
- Higher pitch sounds for bigger combos
- Combo resets after cascade completes without new matches

### 4. **Special Gems & Power-ups**
Create special gems by matching 4+ in a row:

| Match Size | Special Gem | Icon | Effect |
|------------|-------------|------|--------|
| **4 in a row** | Line Clear | ↔ or ↕ | Clears entire row OR column |
| **5 in a row** | Bomb | ✦ | Clears 3x3 area around gem |
| **L/T shape** | Bomb | ✦ | Clears 3x3 area around gem |
| **Level reward** | Rainbow | 🌈 | Clears all gems of one type |

- Special gems trigger on match
- Chain special gems for massive combos
- Glowing visual indicators for each special type
- +50 bonus points per special gem created

### 5. **Level Progression System**
| Level | Target Score | Notes |
|-------|--------------|-------|
| 1 | 1,000 | Starting level |
| 2 | 1,500 | +500 per level |
| 3 | 2,000 | Rainbow gem reward |
| 4 | 2,500 | Difficulty increases |
| 5+ | +500 each | Rainbow gems every 3 levels |

- **Level-up celebration** with particle burst
- Progress bar shows score towards next level
- Level score resets, total score accumulates
- Special gem rewards for milestone levels

### 6. **Visual Polish & Effects**
- **CPU-generated hexagonal gems** with gradient fills
- **Animated sparkle highlights** on each gem
- **Particle systems**:
  - Match explosions (8 particles per gem)
  - Star sparkles (4 per match)
  - Level-up fireworks (50 particles)
- **Screen shake** scales with combo size
- **Animated starfield background** with parallax
- **Glowing selection ring** with pulse animation
- **Smooth gem falling** physics with proper easing
- **Special gem indicators** with glow effects

### 7. **Hint System & Board Management**
- **Automatic hints** after 5 seconds of inactivity
- Press **H key** to manually request hint
- Hint shows with golden pulsing ring
- **Board shuffle** when no valid moves remain
- Shuffle preserves special gems
- Post-shuffle validation ensures playability
- Hint resets on any player interaction

## 🎯 Scoring System

### Base Scoring
- **10 points** per gem cleared
- **50 bonus points** for creating special gems
- Combo multiplier applied to all points

### Coin Rewards
- Coins calculated from: `floor(score/100) + (pickups * 10)`
- Pickups generated from score: `floor(finalScore / 50)`
- Multiplied by daily challenge bonus when active

## 🎨 Gem Color Palette

| Gem | Primary | Highlight | Shadow |
|-----|---------|-----------|--------|
| Red | #FF4444 | #FF8888 | #880000 |
| Blue | #4488FF | #88BBFF | #002288 |
| Green | #44FF44 | #88FF88 | #008800 |
| Yellow | #FFDD44 | #FFEE88 | #886600 |
| Purple | #AA44FF | #CC88FF | #440088 |
| Orange | #FF8844 | #FFAA88 | #883300 |

## 🕹️ Controls

### Mouse/Touch
- **Click gem** → Select gem
- **Click adjacent gem** → Swap gems
- **Click same gem** → Deselect

### Keyboard
- **H** → Show hint

## 📊 Statistics Tracked

The game tracks the following for achievements:
- `level_reached` - Highest level achieved
- `max_combo` - Highest combo in a session
- `total_matches` - Total matches made
- `special_gems` - Special gems created
- `gems_cleared` - Total gems cleared
- `total_cascades` - Maximum cascade chains

## 🏆 Achievement Integration

The game reports stats compatible with the achievement system:
- High combo achievements (3x, 5x, 10x combos)
- Level milestone achievements
- Special gem creation achievements
- Total gems cleared milestones

## 🔧 Technical Details

### Canvas Rendering
- **Canvas size**: 520x600 pixels
- **Grid offset**: (80, 90)
- **Cell size**: 54px (50px gem + 4px spacing)
- **60 FPS** target with delta-time smoothing

### Animation Timing
- Swap duration: 200ms
- Match delay: 150ms
- Cascade speed: 600px/second
- Level-up display: 2 seconds

### Performance
- Efficient particle pooling
- Optimized match-finding algorithm
- Minimal garbage collection
- Smooth animations on mobile

## 📁 File Structure

```
src/games/color-drop/
├── ColorDropGame.ts     # Main game class (~1200 lines)
├── index.ts             # Module export
└── ColorDropReadme.md   # This documentation
```

## 🎮 How to Play

1. **Start**: Click any gem to select it
2. **Swap**: Click an adjacent gem to swap positions
3. **Match**: If 3+ gems align, they explode and score!
4. **Cascade**: New gems fall, may create more matches
5. **Combo**: Keep matching before the timer runs out
6. **Level Up**: Reach the target score to advance
7. **Special**: Match 4+ to create powerful special gems

## 💡 Pro Tips

- **Plan ahead**: Look for potential chain reactions
- **Build combos**: Quick successive matches multiply score
- **Use specials**: Save special gems for tough spots
- **Watch corners**: Matches in corners can cascade nicely
- **Request hints**: Press H when stuck (no penalty!)
- **Go for 4+**: Always prioritize bigger matches for specials

---

*Color Drop - A HacktivateNations Arcade Production* 💎✨
