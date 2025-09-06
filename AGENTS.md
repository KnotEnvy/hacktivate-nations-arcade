# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router (layout, pages, styles).
- `src/games`: Game modules. Implement `GameModule` or extend `BaseGame`; register in `src/games/registry.ts`. Shared utilities in `src/games/shared`.
- `src/components`: UI building blocks (`arcade`, `layout`, `ui`).
- `src/services`: Core services (`InputManager`, `AudioManager`, `Analytics`, `CurrencyService`).
- `src/stores`: Zustand state stores.  `src/hooks`: reusable hooks.
- `public`: Static assets (e.g., thumbnails under `public/games/<id>/`).
- `DOCS/`: Development plans and product docs.

## Build, Test, and Development Commands
- `npm run dev`: Start dev server at `http://localhost:3000`.
- `npm run build`: Production build (use `npm run analyze` for bundle analysis).
- `npm start`: Serve production build.
- `npm run lint` / `npm run lint:fix`: ESLint check / autofix.
- `npm run type-check`: TypeScript validation.
- `npm run format` / `npm run format:check`: Prettier write / check.
- `npm test` / `npm run test:watch`: Jest tests (add Jest before use; no tests included yet).

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Path alias `@/*` → `src/*`.
- Files: PascalCase for components/classes (e.g., `RunnerGame.ts`), camelCase for vars/functions, `useX` for hooks.
- ESLint: `no-unused-vars` (error), `prefer-const` (error), `no-explicit-any` (warn), `no-console` except `warn`/`error`.
- Prettier: 2 spaces, single quotes, semicolons, 80-char width.
- Tailwind CSS 4: prefer utilities; use tokens from `tailwind.config.mjs`.

## Testing Guidelines
- Runner: Jest (ts-jest, jsdom). Place tests under `src/**/?(*.){test,spec}.{ts,tsx}` or `__tests__/`.
- Start: see `DOCS/Test101.md` for install and usage. Config: `jest.config.js` maps `@/*` → `src/*`.
- Example files added: `src/services/__tests__/{CurrencyService,AchievementService,GameLoader}.test.ts`.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- PRs: Clear summary, linked issue, and screenshots/GIFs for UI/game changes. Ensure `lint`, `type-check`, and `build` pass. Update `DOCS/` if behavior changes.

## Game Module Checklist
- Create `src/games/<id>` and export `<Name>Game` with a `manifest` (kebab-case `id`).
- Register in `src/games/registry.ts`:
  `gameLoader.registerGame('<id>', async () => new NameGame())`.
- Add catalog entry in `src/data/Games.ts` and place thumbnail under `public/games/<id>/`.
- Implement achievement integration (see Achievement System section below).

## Achievement System Integration

### Complete Achievement Data Flow
All games now implement comprehensive achievement tracking through this architecture:

1. **BaseGame Enhanced**: `src/games/shared/BaseGame.ts` provides `extendedGameData` property
2. **Game Implementation**: Each game implements `onGameEnd()` method to set achievement data
3. **Analytics Integration**: Games call `services.analytics.trackGameSpecificStat()` 
4. **Achievement Service**: Analytics service passes data to AchievementService for processing
5. **Real-time UI**: Achievement unlocks trigger immediate notifications

### Achievement Categories & Cross-Game Meta
- **70+ total achievements** across all games
- **Individual game achievements**: Game-specific milestones and performance targets
- **Cross-game meta achievements**: 
  - Game Explorer (try 5 different games)
  - Arcade Master (score 1000+ in 3 different games)
  - Daily Player (play for 7 consecutive days)

### Per-Game Achievement Tracking Status
All games fully integrated with achievement system:

**✅ Runner Game** (`runner`):
- Distance, speed, jumps, powerup usage, combo chains
- 6 analytics tracking calls in `onGameEnd()`

**✅ Space Shooter** (`space`):
- Waves, bosses defeated, enemies destroyed, powerups, survival time, max stage
- Achievement counters integrated throughout gameplay

**✅ Block Puzzle** (`puzzle`):
- Lines cleared, level reached, tetris count, unique themes, max combo
- 5 analytics tracking calls in `onGameEnd()`

**✅ Snake Game** (`snake`):
- Snake length, final speed, food eaten
- Basic achievement data with 3 analytics calls

**✅ Breakout Game** (`breakout`):
- Bricks broken, levels cleared, powerups collected
- Real-time counters with 5 analytics tracking calls

**✅ Memory Match** (`memory`):
- Matches made, levels completed, perfect levels, fast completion
- Time-based and precision achievements with 4 analytics calls

**✅ Tap Dodge** (`tapdodge`):
- Survival time, near misses, coins collected, max combo
- 4 analytics tracking calls with survival time precision

### Adding Achievement Support to New Games
When creating new games, follow this pattern:

```typescript
// 1. Add achievement tracking variables
private gameSpecificStat = 0;

// 2. Implement onGameEnd() method
protected onGameEnd(finalScore: any): void {
  // Set extended data for Hub
  this.extendedGameData = {
    game_specific_stat: this.gameSpecificStat,
    // ... other achievement-relevant data
  };

  // Track analytics for achievement triggering
  this.services?.analytics?.trackGameSpecificStat?.('game-id', 'game_specific_stat', this.gameSpecificStat);
  
  // Call parent method
  super.onGameEnd?.(finalScore);
}

// 3. Add achievements to src/data/achievements.ts
{
  id: 'game_achievement',
  title: 'Achievement Title',
  description: 'Achievement description',
  icon: '🎯',
  gameId: 'game-id',
  category: 'skill',
  requirement: { type: 'game_specific_stat', value: 10 },
  reward: 100,
  unlocked: false
}
```

## Project Goals & Roadmap Snapshot
- Goal: Modular arcade hub with shared currency, daily challenges, achievements, and tier-based game unlocks; offline-friendly PWA; fast loads (FCP < 2s, game load < 500ms, 60fps, <300KB/game).
- Architecture: Next.js App Router + TypeScript + Tailwind; HTML5 Canvas games via `BaseGame` and shared `services`.
- Roadmap focus: Audio polish, backend persistence (Supabase), PWA & accessibility.

## Current Status (from DOCS)
- Foundation complete: Game SDK, loader, hub UI, currency service, analytics hooks, achievements/challenges system fully integrated across all 7+ games.
- Audio: Complete symphonic orchestral audio system with procedural SFX, hub/game background music, and full volume controls.
- Achievement System: Fully operational with 70+ achievements across individual games and cross-game meta achievements.
- Backend/PWA: Supabase, service worker, and A11y polish not yet integrated.

## Next Build Priorities
- Backend: Add Supabase client (`src/lib/supabase.ts`), persist currency/achievements, and prepare leaderboards. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- PWA & A11y: Service worker caching for shell and game bundles; keyboard navigation and color contrast checks.
- Game Polish: Additional games, visual effects improvements, performance optimizations.

## Security & Configuration Tips
- Environment vars: Prefix client-safe keys with `NEXT_PUBLIC_…`; never commit secrets.
- Budgets: Enforce `PERFORMANCE.MAX_ASSET_SIZE_KB` and economy rules in reviews.

## Game: Space Shooter (Tier 2)

Location
- Core: `src/games/space/SpaceShooterGame.ts`
- Registry: `src/games/registry.ts` (id: `space`)
- Catalog: `src/data/Games.ts` (thumbnail `/games/space/space-thumb.svg`)

Architecture
- Extends `BaseGame` (init/update/render + overlay UI handled via hook methods)
- Uses shared services: `InputManager`, `AudioManager`, `Analytics`, `CurrencyService`
- Canvas-only rendering; no assets required besides thumbnail

Gameplay Systems
- Stage flow: 5 waves → boss → unlock new enemy/pattern → next stage
- Enemies (color-coded, simple shapes):
  - `basic` (red): straight descent
  - `sine` (orange): sinusoidal drift
  - `shooter` (amber): slow descent, periodic aimed shots
  - `diver` (green): accelerates toward player
  - `spinner` (bright green): orbits a pivot, radial bursts (dt-based)
  - `tanker` (light blue): slow, high HP, occasional straight shots
- Formations: `line`, `v`, `wedge`; anchor oscillation, side-entry, split-and-swoop
- Boss: 3 phases (targeted shots → spreads → “laser walls”), HP scales by stage, cadence scales by stage
- Power-ups: `shield`, `spread` (weapon level up to 3), `heal`, `score`
- Drops: Dynamic chance with player HP + stage bonus (capped), globally used in `getDropChance()`
- Invulnerability: 1s i-frames with player blink after damage

Polish & FX
- Parallax starfield (3 layers, varying speeds/colors)
- Particles (explosions), screen shake, hit flash, score popups
- Banners: “Stage N” at start; “Boss Approaching” before boss

Controls
- Keyboard: arrows/A-D to move, Space/Enter/Click/Touch to fire
- Touch: horizontal follow with lerped smoothing to first touch point

Services Integration
- Currency: Uses `BaseGame.getScore()` pickups and score to compute reward
- Audio: clicks for shots; `powerup`, `collision`, `success`, `game_over`
- Analytics: `trackGameStart/End`, feature usage (`space_wave_spawn`, `space_boss_start`, `space_boss_defeated`), power-up actions

Tuning Knobs (inside `SpaceShooterGame.ts`)
- Drop rate function `getDropChance()`
- Boss base HP per stage; attack cadence `rate`
- Enemy speeds; spinner radial frequency; tanker fire cadence
- Formation descent/oscillation speeds; side-entry timings
- Weapon cooldowns by weapon level

Extending the Shooter
- Add a new enemy: extend `Enemy['type']`, implement in `updateEnemies()`, and wire into wave builder unlock order
- New formation: add offsets in `spawnFormationWave()` and behavior in `updateFormations()`
- New boss: factor current boss into a class or add phase handlers; keep HP bar + telegraphs

QA Checklist
- 60fps on desktop and mid-tier mobile; keep entity counts reasonable
- Stage 1 should be forgiving: verify i-frames, fair bullet density, readable telegraphs
- Verify currency earnings feel proportional to time and risk
- Confirm no runtime errors: helpers (`showBanner`, `addShake`, `spawnExplosion`, `addPopup`, `updateParticles`) are present

Known Follow-ups
- Add boss laser telegraphs (warning lines) for Phase 3 fairness
- Optionally cap dynamic drop chance to 25% if balance requires
- ✅ Space-specific achievements/challenges (COMPLETED: fully integrated with achievement system)
