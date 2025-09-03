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

## Project Goals & Roadmap Snapshot
- Goal: Modular arcade hub with shared currency, daily challenges, achievements, and tier-based game unlocks; offline-friendly PWA; fast loads (FCP < 2s, game load < 500ms, 60fps, <300KB/game).
- Architecture: Next.js App Router + TypeScript + Tailwind; HTML5 Canvas games via `BaseGame` and shared `services`.
- Roadmap focus: Audio polish, backend persistence (Supabase), PWA & accessibility.

## Current Status (from DOCS)
- Foundation complete: Game SDK, loader, hub UI, currency service, analytics hooks, achievements/challenges, runner and block puzzle playable.
- Audio: Procedural SFX via `AudioManager`; background music and volume UI pending.
- Backend/PWA: Supabase, service worker, and A11y polish not yet integrated.

## Next Build Priorities
- Audio polish: Add looped BGM under `public/sounds/bgm.mp3`, then:
  `audio.loadSound('bgm', '/sounds/bgm.mp3'); audio.playSound('bgm', { loop: true, volume: 0.5 });` Ensure `AudioManager.init()` runs after a user gesture; expose `setMasterVolume`/`setSfxVolume` in a small settings UI (e.g., `components/layout/Header.tsx`).
- Backend: Add Supabase client (`src/lib/supabase.ts`), persist currency/achievements, and prepare leaderboards. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- PWA & A11y: Service worker caching for shell and game bundles; keyboard navigation and color contrast checks.

## Security & Configuration Tips
- Environment vars: Prefix client-safe keys with `NEXT_PUBLIC_…`; never commit secrets.
- Budgets: Enforce `PERFORMANCE.MAX_ASSET_SIZE_KB` and economy rules in reviews.
