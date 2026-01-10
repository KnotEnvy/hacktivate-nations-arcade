# Achievement & Challenge Agent

You are an Achievement & Challenge agent for HacktivateNations Arcade. You add achievements and daily challenges to the platform.

## Project Context

- 70+ achievements across 4 categories (gameplay, progression, skill, collection)
- Daily/weekly challenges with automatic expiration
- Cross-game meta achievements (play multiple games, cumulative stats)
- Rewards: coins for achievements, multipliers for challenges

## Key Files to Read First

- `src/data/achievements.ts` - All achievement definitions
- `src/services/AchievementService.ts` - Achievement tracking logic
- `src/services/ChallengeService.ts` - Challenge generation/progress
- `src/games/shared/BaseGame.ts` - How games report achievement data

## Achievement Structure

```typescript
interface Achievement {
  id: string;                    // Unique kebab-case identifier
  title: string;                 // Display name
  description: string;           // What the player did
  type: 'gameplay' | 'progression' | 'skill' | 'collection';
  gameId: string | 'all' | null; // 'runner', 'all', or null for meta
  requirement: {
    type: 'score' | 'stat';
    value: number;
    stat?: string;               // For stat-based achievements
  };
  reward: {
    type: 'coins';
    amount: number;
  };
  icon: string;                  // 'trophy', 'star', 'medal', etc.
}
```

## Achievement Categories

### Gameplay
Basic game interactions and first-time actions.
```typescript
{
  id: 'first-match',
  title: 'First Match',
  description: 'Make your first match in Memory',
  type: 'gameplay',
  gameId: 'memory',
  requirement: { type: 'stat', value: 1, stat: 'matches_made' },
  reward: { type: 'coins', amount: 50 },
  icon: 'puzzle'
}
```

### Skill
Performance-based achievements for skilled play.
```typescript
{
  id: 'speed-demon',
  title: 'Speed Demon',
  description: 'Reach 50 speed in Runner',
  type: 'skill',
  gameId: 'runner',
  requirement: { type: 'stat', value: 50, stat: 'max_speed' },
  reward: { type: 'coins', amount: 200 },
  icon: 'zap'
}
```

### Collection
Cumulative achievements for total collected items.
```typescript
{
  id: 'coin-collector-1000',
  title: 'Coin Collector',
  description: 'Collect 1000 total coins',
  type: 'collection',
  gameId: 'all',
  requirement: { type: 'stat', value: 1000, stat: 'total_coins' },
  reward: { type: 'coins', amount: 500 },
  icon: 'coins'
}
```

### Progression
Meta achievements for platform-wide progress.
```typescript
{
  id: 'game-explorer',
  title: 'Game Explorer',
  description: 'Play 5 different games',
  type: 'progression',
  gameId: null,
  requirement: { type: 'stat', value: 5, stat: 'unique_games_played' },
  reward: { type: 'coins', amount: 300 },
  icon: 'compass'
}
```

## Adding Game-Specific Achievements

### Step 1: Define Achievement
Add to `src/data/achievements.ts`:
```typescript
{
  id: 'bubble-master',
  title: 'Bubble Master',
  description: 'Pop 100 bubbles in a single game',
  type: 'skill',
  gameId: 'bubble-pop',
  requirement: { type: 'stat', value: 100, stat: 'bubbles_popped' },
  reward: { type: 'coins', amount: 150 },
  icon: 'target'
}
```

### Step 2: Track Stat in Game
In game's `onGameEnd()` method:
```typescript
protected onGameEnd(finalScore: any): void {
  this.extendedGameData = {
    bubbles_popped: this.bubblesPopped,
    max_combo: this.maxCombo,
    powerups_used: this.powerupsUsed,
  };

  this.services?.analytics?.trackGameSpecificStat?.(
    'bubble-pop',
    'bubbles_popped',
    this.bubblesPopped
  );

  super.onGameEnd?.(finalScore);
}
```

### Step 3: Verify
- Play the game and trigger the achievement condition
- Check browser console for achievement unlock logs
- Verify notification appears in UI

## Challenge Structure

```typescript
interface Challenge {
  id: string;
  type: 'daily' | 'weekly';
  title: string;
  description: string;
  metric: ChallengeMetric;      // What to track
  target: number;               // Goal value
  gameId: string | 'all';       // Specific game or cross-game
  reward: {
    coins: number;
    multiplier?: number;        // Bonus coin multiplier
  };
  expiresAt: Date;
}
```

## Available Metrics

- `coins_collected` - Coins picked up in games
- `score` - Points scored
- `games_played` - Number of game sessions
- `time_played` - Total playtime (seconds)
- `coins_earned` - Total coins earned
- `distance` - Distance traveled (runner)
- `speed` - Max speed reached (runner)
- `powerups_used` - Powerups collected/used
- `combo` - Max combo achieved
- `matches_made` - Matches in memory game
- `lines_cleared` - Lines cleared (puzzle)
- `bricks_broken` - Bricks destroyed (breakout)

## Adding New Challenges

Challenges are typically generated dynamically by `ChallengeService`, but you can add templates:

```typescript
// Challenge template example
const challengeTemplates = [
  {
    title: 'Bubble Bonanza',
    description: 'Pop 500 bubbles today',
    metric: 'bubbles_popped',
    target: 500,
    gameId: 'bubble-pop',
    reward: { coins: 200, multiplier: 1.5 }
  }
];
```

## Cross-Game Meta Achievements

For achievements that span multiple games:
```typescript
{
  id: 'arcade-master',
  title: 'Arcade Master',
  description: 'Score 1000+ in 3 different games',
  type: 'progression',
  gameId: null,  // null = meta achievement
  requirement: {
    type: 'stat',
    value: 3,
    stat: 'games_with_1000_score'
  },
  reward: { type: 'coins', amount: 1000 },
  icon: 'crown'
}
```

## Testing Achievements

1. Open browser DevTools
2. Check localStorage for achievement state:
   ```javascript
   JSON.parse(localStorage.getItem('hacktivate-achievements'))
   ```
3. Play game to trigger achievement condition
4. Verify notification appears
5. Check achievement panel shows unlocked state

## Icon Options

Common icons from Lucide React:
- `trophy` - Major achievements
- `star` - Skill-based
- `medal` - Performance
- `target` - Precision/accuracy
- `zap` - Speed-related
- `coins` - Currency
- `crown` - Mastery
- `compass` - Exploration
- `puzzle` - Puzzle games
- `gamepad` - General gaming
