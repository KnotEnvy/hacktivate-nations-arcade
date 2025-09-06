# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (runs on http://localhost:3000)
- `npm run build` - Create production build
- `npm run start` - Serve production build locally
- `npm run lint` - Run ESLint (extends Next.js, TypeScript, Prettier configs)
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run type-check` - Verify TypeScript compilation (uses `tsc --noEmit`)
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing
- Jest configured with ts-jest preset and jsdom environment
- Tests located in `src/**/__tests__/` directories
- Uses `@/` path mapping for imports

## Architecture Overview

### Project Structure
This is a **modular arcade game platform** built with Next.js 15, React 19, and TypeScript. The core concept is a plug-and-play system where games implement a common `GameModule` interface and integrate with shared services.

### Key Directories
- `src/games/` - Individual game modules (runner, snake, block, breakout, memory, etc.)
- `src/games/shared/` - Common game interfaces (`GameModule.ts`, `BaseGame.ts`) and utilities
- `src/services/` - Shared platform services (InputManager, AudioManager, GameLoader, etc.)
- `src/stores/` - Zustand state management (gameStore, currencyStore, userStore)
- `src/components/arcade/` - Arcade hub UI components
- `src/hooks/` - Custom React hooks (useCanvas, useInput, useGameModule)

### Game Module System
Games must implement the `GameModule` interface from `src/games/shared/GameModule.ts`:
- `init(canvas, services)` - Initialize game with canvas and shared services
- `update(dt)` - Update game logic (delta time in milliseconds)
- `render(ctx)` - Render game to 2D canvas context
- Optional lifecycle hooks: `pause()`, `resume()`, `resize()`, `destroy()`
- `manifest` - Game metadata (id, title, thumbnail, etc.)

### Game Registration
New games are registered in `src/games/registry.ts` using the `GameLoader` service with dynamic imports for code splitting.

### Shared Services Architecture
- **InputManager** (`src/services/InputManager.ts`) - Unified keyboard, touch, gamepad input
- **AudioManager** (`src/services/AudioManager.ts`) - Symphonic orchestral audio system with procedural music generation
- **CurrencyService** - Universal coin economy across games
- **AchievementService** - Cross-game achievement system
- **ChallengeService** - Daily and weekly challenge system
- **UserService** - User profiles, leveling, and statistics
- **Analytics** - Game metrics and user behavior tracking

### State Management
Uses Zustand for lightweight state management:
- Game state, user progress, and currency are managed centrally
- Stores are located in `src/stores/`

### Styling & UI
- Tailwind CSS v4 with custom configuration
- Component library with class-variance-authority for variant styling
- Responsive design with mobile-first approach
- Uses `@/` path mapping configured in `tsconfig.json`

## Development Guidelines

### Adding New Games
1. Create game folder in `src/games/[game-name]/`
2. Implement `GameModule` interface or extend `BaseGame` class
3. Register in `src/games/registry.ts` with lazy loading
4. Add game metadata to appropriate data files
5. Keep asset budget under 300KB per game

### Code Style
- ESLint configured with TypeScript and Next.js rules
- Prettier for consistent formatting
- Strict TypeScript settings enabled
- No unused variables (`@typescript-eslint/no-unused-vars`: "error")
- Warn on `any` usage (`@typescript-eslint/no-explicit-any`: "warn")

### Canvas & Rendering
- All games use HTML5 Canvas with 2D context
- Canvas management handled by `useCanvas` hook
- Responsive canvas sizing with proper DPI handling

### Input Handling
- Use `useInput` hook for consistent input across games
- Supports keyboard, mouse, touch, and gamepad
- Input schema defined per game for auto-configuration

## Audio System

### Symphonic Audio Architecture
The AudioManager implements a professional-grade orchestral audio system using classical music theory:

#### Background Music System
- **Hub Music**: 48-second symphonic piece in C major with full orchestration
  - Classical I-vi-IV-V-I-iii-vi-V7-I progression with proper voice leading
  - Bass section (Cellos & Double Basses), Viola section, Violin section with ornamentation
  - French Horn harmonies, Woodwind doubling (Flutes/Oboes), Timpani punctuation
  - Natural breathing, dynamic swells, and concert hall stereo imaging

- **Game Music**: 36-second epic battle theme in D minor
  - Heroic orchestral arrangement with driving timpani and bass drums
  - Trumpet fanfares, French horn harmonies, soaring violin melodies
  - Brass stabs, snare rolls, cymbal crashes, and reverb simulation
  - Perfect for action gameplay with dramatic intensity curves

#### Orchestral Sound Effects
All sound effects use classical orchestration principles:
- **Unlock Sound**: Majestic brass fanfare with trumpets, horns, timpani, and chimes
- **Success Sound**: Warm string section with brass pad and high violin sparkle
- **Powerup Sound**: Magical orchestral ascension with harp, celesta, and ethereal flutes
- **Other Effects**: Jump, coin, collision sounds with orchestral character

#### Volume Controls & Settings
- **AudioSettings Component**: (`src/components/arcade/AudioSettings.tsx`)
- **Separate Volume Controls**: Master, SFX, and Music with real-time sliders
- **Mute Functionality**: Global mute toggle with state persistence
- **Test Sounds**: Interactive preview buttons for all sound effects
- **Persistent Preferences**: All settings saved to localStorage

#### Audio Integration
- **Automatic Initialization**: Audio context starts after user interaction
- **Music Transitions**: Smooth crossfading between hub and game music (2-second fades)
- **Sound Effect Integration**: All UI interactions have appropriate orchestral sounds
- **Performance Optimized**: Efficient procedural generation with minimal memory footprint

### Audio Usage in Games
Games access the AudioManager through the services parameter in their `init()` method:
```typescript
// Play sound effects
services.audio.playSound('coin', { volume: 0.8 });
services.audio.playSound('jump');

// Background music is handled automatically by the ArcadeHub
// Hub music plays in menu, game music plays during gameplay
```

## Hub System

### Enhanced Arcade Experience
The arcade hub provides a complete gaming platform experience:

#### Multi-Tab Interface
- **Games Tab**: Game selection carousel with unlock system
- **Challenges Tab**: Daily/weekly challenges with progress tracking
- **Achievements Tab**: Achievement showcase with category filtering
- **Profile Tab**: User statistics, avatar selection, and progression

#### User Progression System
- **Experience Points**: Gained from gameplay performance
- **Level System**: Character progression with level-up celebrations
- **Avatar Selection**: Multiple avatar options with persistence
- **Statistics Tracking**: Comprehensive gameplay metrics

#### Engagement Systems
- **Daily Challenges**: Cross-game objectives that refresh every 24 hours
- **Achievement System**: 70+ achievements across multiple categories with cross-game meta achievements
- **Currency Economy**: Unified coin system for unlocking games
- **Real-time Notifications**: Achievement unlocks, level-ups, and challenge completions

## Achievement System

### Comprehensive Achievement Integration
The achievement system is fully integrated across all 7+ active games with proper data flow and analytics tracking:

#### Achievement Categories
- **Gameplay**: Basic game interactions (first jump, first match, etc.)
- **Skill**: Performance-based achievements (high scores, speed runs, combos)
- **Collection**: Accumulative achievements (total coins, powerups collected)
- **Progression**: Meta achievements (games unlocked, playtime milestones)

#### Cross-Game Meta Achievements
- **Game Explorer**: Try 5 different games
- **Arcade Master**: Score 1000+ in 3 different games  
- **Daily Player**: Play games for 7 consecutive days

#### Achievement Data Flow
1. **Games Track Stats**: Each game implements `onGameEnd()` method to report achievement-relevant data
2. **Extended Game Data**: Games use `extendedGameData` property to pass rich achievement data beyond basic score
3. **Analytics Integration**: Games call `services.analytics.trackGameSpecificStat()` for achievement triggering
4. **Hub Integration**: ArcadeHub receives extended data via `getScore()` and triggers achievement checks
5. **Real-time Notifications**: Achievement unlocks display immediately with proper UI feedback

#### Game-Specific Achievement Tracking

**Runner Game** (`runner`):
- Distance traveled, speed reached, jumps performed, powerup usage, combo chains

**Space Shooter** (`space`):
- Waves completed, bosses defeated, enemies destroyed, powerups collected, survival time, max stage

**Block Puzzle** (`puzzle`):
- Lines cleared, level reached, tetris count, unique themes experienced, max combo

**Snake Game** (`snake`):
- Snake length, final speed, food eaten, basic score milestones

**Breakout Game** (`breakout`):
- Bricks broken, levels cleared, powerups collected, total bricks destroyed

**Memory Match** (`memory`):
- Matches made, levels completed, perfect levels, fast completion time

**Tap Dodge** (`tapdodge`):
- Survival time, near misses, coins collected, max combo

### Adding Achievement Support to New Games
When creating new games, ensure proper achievement integration:

1. **Extend BaseGame**: Use `src/games/shared/BaseGame.ts` which provides `extendedGameData` property
2. **Implement onGameEnd()**: Override the `onGameEnd()` method to set achievement data:
   ```typescript
   protected onGameEnd(finalScore: any): void {
     this.extendedGameData = {
       // Game-specific achievement data
       custom_stat: this.customStatValue,
       // ... other stats
     };
     
     // Track analytics for achievement triggering
     this.services?.analytics?.trackGameSpecificStat?.('game-id', 'custom_stat', this.customStatValue);
     
     super.onGameEnd?.(finalScore);
   }
   ```
3. **Define Achievements**: Add game-specific achievements to `src/data/achievements.ts` with proper `gameId` and `requirement` properties
4. **Test Integration**: Verify achievements trigger correctly through gameplay testing