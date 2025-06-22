# 🎮 HacktivateNations Arcade - LLM Development Handoff Prompt

Copy this entire prompt when starting a new development session:

---

## 🎯 Project Context

I'm continuing development on **HacktivateNations Arcade**, a retro-inspired arcade hub with modular mini-games. We've already built a **complete, working foundation** and need to continue with the next phase of development.

## 📋 What's Already Built & Working ✅

### **Core Architecture (COMPLETE)**
- ✅ **Next.js 14 + TypeScript + Tailwind CSS** project structure
- ✅ **Game Module System**: Complete `GameModule` interface and `BaseGame` class
- ✅ **Service Architecture**: Input, Audio, Analytics, and Currency services
- ✅ **Singleton Pattern**: Global currency service shared across components
- ✅ **Game Loader**: Dynamic game loading and registry system

### **Working Games (COMPLETE)**
- ✅ **Endless Runner**: Full physics, progressive difficulty, particle effects
- ✅ **Collision System**: Player vs obstacles and coins
- ✅ **Scoring System**: Score + pickups → coins formula working perfectly
- ✅ **Game States**: Loading, playing, paused, game over with proper UI

### **Arcade Hub (COMPLETE)**
- ✅ **Game Carousel**: Shows available games with unlock status
- ✅ **Currency Display**: Real-time coin updates with animations  
- ✅ **Unlock System**: Tier-based unlocking (0: free, 1: 2K coins, 2: 5K coins)
- ✅ **Navigation**: Seamless hub ↔ game transitions

### **Economy System (COMPLETE)**
- ✅ **Currency Formula**: `floor(score/100) + (pickups * 10)` 
- ✅ **Persistence**: localStorage with automatic save/load
- ✅ **Real-time Updates**: Currency changes propagate instantly
- ✅ **Development Tools**: +500, +2K coins, and reset buttons (dev only)

### **Technical Foundation (COMPLETE)**
- ✅ **Performance**: 60fps gameplay, <1.5s load times
- ✅ **Input Management**: Keyboard, mouse, touch, gamepad support
- ✅ **Error Handling**: Graceful fallbacks and error boundaries
- ✅ **Type Safety**: Full TypeScript with proper interfaces
- ✅ **Development Experience**: Hot reload, debugging, console logging

## 🏗️ Current Project Structure

```
src/
├── app/                     # Next.js 14 app router
│   ├── globals.css         # Tailwind + custom arcade styles
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main page with ArcadeHub
│   ├── loading.tsx         # Loading component
│   └── error.tsx           # Error boundary
├── components/
│   ├── arcade/             # Main arcade components
│   │   ├── ArcadeHub.tsx   # Main hub component (CORE)
│   │   ├── GameCanvas.tsx  # Game hosting component
│   │   ├── GameCarousel.tsx # Game selection carousel  
│   │   └── CurrencyDisplay.tsx # Coin display with animations
│   └── ui/
│       └── Button.tsx      # Shared button component
├── games/
│   ├── shared/             # Shared game utilities
│   │   ├── GameModule.ts   # Core interfaces
│   │   ├── BaseGame.ts     # Abstract base class (IMPORTANT)
│   │   └── utils/          # Vector2, Rectangle, etc.
│   ├── runner/             # Complete endless runner
│   │   ├── RunnerGame.ts   # Main game class
│   │   ├── entities/       # Player, Obstacle, Coin, Particle
│   │   ├── systems/        # ParticleSystem
│   │   └── index.ts        # Export
│   └── registry.ts         # Game registration (ADD NEW GAMES HERE)
├── services/               # Core services (ALL WORKING)
│   ├── InputManager.ts     # Unified input handling
│   ├── AudioManager.ts     # Web Audio API (ready for sounds)
│   ├── Analytics.ts        # Event tracking (PostHog ready)
│   ├── CurrencyService.ts  # Global currency with singleton
│   └── GameLoader.ts       # Dynamic game loading
├── hooks/
│   ├── useCanvas.ts        # Canvas setup hook
│   └── useGameModule.ts    # Game lifecycle management
├── stores/                 # Zustand stores (basic setup)
│   ├── gameStore.ts
│   ├── currencyStore.ts
│   └── userStore.ts
└── lib/
    ├── types.ts            # All TypeScript interfaces
    ├── constants.ts        # Game config, unlock costs, colors
    └── utils.ts            # Helper functions
```

## 🔑 Key Technical Patterns & Decisions

### **Game Module Pattern (CRITICAL)**
```typescript
// Every game extends BaseGame and implements GameModule
export class MyGame extends BaseGame {
  manifest: GameManifest = {
    id: 'my-game',
    title: 'My Game',
    tier: 1, // Unlock tier
    // ...
  };
  
  protected onInit(): void { /* Setup */ }
  protected onUpdate(dt: number): void { /* Game logic */ }
  protected onRender(ctx: CanvasRenderingContext2D): void { /* Drawing */ }
}
```

### **Currency Integration (CRITICAL)**
```typescript
// Always use CurrencyService singleton
import { CurrencyService } from '@/services/CurrencyService';

// In games, currency is auto-awarded in BaseGame.endGame()
// The formula: floor(score/100) + (pickups * 10)
```

### **Service Architecture (IMPORTANT)**
```typescript
// Services injected into games via init()
const services: Services = { input, audio, analytics, currency };
game.init(canvas, services);
```

### **Game Registration (IMPORTANT)**
```typescript
// Add new games to src/games/registry.ts
gameLoader.registerGame('my-game', async () => {
  const { MyGame } = await import('./my-game/MyGame');
  return new MyGame();
});
```

## 🎯 **IMMEDIATE NEXT PRIORITIES** (Choose One)

### **Option A: Audio Integration** ⭐ RECOMMENDED
**Why**: Quick wins, makes existing game feel amazing
**Tasks**:
1. Add sound effects to runner (jump, coin, game over)
2. Implement background music system
3. Add volume controls to UI
4. Test audio context management

### **Option B: Second Game Implementation** ⭐ HIGH IMPACT  
**Why**: Validates multi-game architecture, tests unlocking
**Tasks**:
1. Create Block Puzzle game following runner pattern
2. Implement in `src/games/puzzle/PuzzleGame.ts`
3. Add to registry and test unlocking with real game
4. Verify currency system works across games

### **Option C: Enhanced Runner Polish** ⭐ FUN FACTOR
**Why**: Makes current game more engaging
**Tasks**:
1. Add power-ups (double jump, coin magnet, invincibility)
2. Create more obstacle types (flying enemies, moving platforms)
3. Add environmental variety (backgrounds, weather)
4. Implement advanced scoring (multipliers, combos)

## 🔧 Development Setup

### **Running the Project**
```bash
npm run dev          # Start development server
npm run build        # Production build  
npm run lint         # ESLint check
npm run type-check   # TypeScript validation
```

### **Testing Currency System**
- **Development buttons** (top right, dev only):
  - "Debug 💰" - Shows currency state in console
  - "+500" - Add 500 coins quickly
  - "+2K" - Add 2000 coins (unlock tier 1)
  - "🔄 Reset" - Reset all progress with confirmation

### **Adding a New Game**
1. Create folder: `src/games/[game-name]/`
2. Create main class extending `BaseGame`
3. Add entities in `entities/` folder
4. Register in `src/games/registry.ts`
5. Add to `AVAILABLE_GAMES` in `ArcadeHub.tsx`

## 🚨 **Critical Information**

### **Currency System Requirements**
- **MUST use** `globalCurrencyService` singleton
- **MUST pass** service to all components that need currency
- **BaseGame automatically** awards coins on game end
- **Formula**: `floor(score/100) + (pickups * 10)`

### **Game Module Requirements**
- **MUST extend** `BaseGame` class
- **MUST implement** required abstract methods
- **Services injected** via `init()` method
- **Lifecycle managed** by `useGameModule` hook

### **Performance Requirements**
- **Games MUST** run at 60fps
- **Asset budget** < 300KB per game
- **Load time** < 500ms per game
- **First paint** < 2.0s total

### **File Patterns**
- **Game files**: PascalCase (`RunnerGame.ts`)
- **Components**: PascalCase (`ArcadeHub.tsx`)
- **Services**: PascalCase (`CurrencyService.ts`)
- **Utilities**: camelCase (`formatNumber()`)

## 📚 Key Files to Reference

### **For Game Development**
- `src/games/runner/RunnerGame.ts` - Complete game example
- `src/games/shared/BaseGame.ts` - Base class to extend
- `src/games/shared/utils/Vector2.ts` - Math utilities

### **For UI Development**  
- `src/components/arcade/ArcadeHub.tsx` - Main hub logic
- `src/components/arcade/GameCanvas.tsx` - Game hosting
- `src/app/globals.css` - Arcade styling classes

### **For Service Development**
- `src/services/CurrencyService.ts` - Currency singleton
- `src/services/InputManager.ts` - Input handling
- `src/lib/types.ts` - All interfaces

## 🎮 **Current Game State**

**The arcade is fully playable:**
- ✅ Runner game works perfectly with smooth physics
- ✅ Currency system accumulates and persists
- ✅ Game unlocking system functional (can unlock tier 1 at 2K coins)
- ✅ Hub navigation seamless
- ✅ Development tools working
- ✅ Performance targets met

**What players experience:**
1. **Load arcade** → See hub with runner unlocked
2. **Play runner** → Jump, collect coins, avoid obstacles  
3. **Game over** → Earn coins based on performance
4. **Return to hub** → See increased coin balance
5. **Save 2K coins** → Unlock "Block Puzzle" (placeholder)

## ❓ **Questions to Ask Me**

When you start development, feel free to ask:
- "What specific feature should I implement next?"
- "Should I focus on audio, second game, or polish?"
- "Do you want me to explain any part of the existing code?"
- "What's the priority: fun factor, technical debt, or new features?"

## 🎯 **Success Criteria**

**You'll know you're on track when:**
- ✅ Code follows existing patterns (`BaseGame` extension, service injection)
- ✅ New features integrate seamlessly with currency system
- ✅ Performance stays at 60fps with new additions
- ✅ TypeScript compiles without errors
- ✅ Console shows appropriate debug logging

---

**🚀 Ready to continue building the arcade! What would you like to tackle first?**