# HacktivateNations Arcade Relearn Handoff

Snapshot date: April 13, 2026

## Purpose

This document is a current-state handoff for the team after time away from the project. It is based on the live codebase first, then cross-checked against the existing docs in `DOCS/`.

Use this as the working reference for getting the project to production. Older docs are still useful, but several of them describe an earlier state of the app.

## Executive Summary

HacktivateNations Arcade is much further along than the oldest roadmap docs imply. The project already has:

- a working Next.js 15 + React 19 arcade hub
- a local-first progression loop with coins, tiers, game unlocks, achievements, daily challenges, leveling, and notifications
- Supabase auth, hydration, sync, and leaderboard reads/writes wired into the app
- a large playable game catalog with 16 registered game modules
- an unusually advanced procedural audio system with a full settings UI and hidden music lab

The main challenge is no longer "build the arcade." The main challenge is hardening and consolidating what already exists so it can ship cleanly.

My read: the foundation is real, the scope is ambitious, and the code proves that a lot of the vision already landed. The production work now is mostly about security, build health, source-of-truth cleanup, and finishing a few missing platform pieces.

## Status Update

Verified on April 13, 2026 after the Phase 1 stabilization pass:

- `cmd /c npm run type-check` now passes.
- `cmd /c npm run build` now passes.
- The game catalog still lists 27 entries, but the unlock/play flow is now gated by the live registry so unimplemented games render as coming soon and cannot be purchased or launched.
- Tiers that contain no released games can no longer consume coins.
- The incomplete manifest/PWA claim has been removed from app metadata instead of advertising missing assets.
- A tracked env template now exists as `env.example`, while the current git index does not include a tracked `.env`.
- Important remaining debt: the repo still has a large ESLint backlog, so `next build` is configured to skip linting and `npm run lint` must be treated as a separate cleanup track.

Verified on April 14, 2026 after the next consolidation pass:

- unlock persistence and migration now live in `src/hooks/useArcadeUnlockState.ts` instead of staying embedded inside `ArcadeHub.tsx`
- the old Zustand stores under `src/stores/` were removed because they were unused and represented stale parallel ownership
- current progression ownership is clearer: local services plus the unlock hook are the live client source of truth, with Supabase hydration/sync layered on top
- `cmd /c npm run lint` now passes again
- `next.config.ts` no longer skips lint during production builds
- `cmd /c npm run type-check` is now self-sufficient via `scripts/ensure-next-type-stubs.js`, so it no longer depends on a previous build to populate `.next/types`

## Current Reality

### Stack

- Frontend: Next.js App Router, React 19, TypeScript, Tailwind
- State/persistence: localStorage-heavy local-first services, some Zustand stores
- Backend: Supabase auth + Postgres schema + RLS + leaderboard RPCs
- Rendering: HTML5 canvas mini-games with shared base classes and services
- Testing: Jest + ts-jest for unit tests, Playwright for basic E2E

### What Players Can Do Today

- Open the arcade hub and move between `Games`, `Leaderboards`, `Challenges`, `Achievements`, and `Profile`
- Play games, earn coins, unlock tiers, and unlock games within tiers
- Complete daily challenges and receive coin bonuses
- Unlock achievements and level up through XP/perk progression
- Sign in with magic link or password auth
- Sync progress to Supabase when configured
- View real leaderboards when data exists, with fallback sample rows when offline/empty
- Use audio controls, browse tracks, and access the hidden music lab

### Game Catalog State

- `src/data/Games.ts` currently lists 27 catalog entries across 5 tiers
- `src/games/registry.ts` currently registers 16 active game loaders
- `public/games/` currently contains thumbnails for those implemented games plus a shared `coming-soon-thumb.svg`

Practical meaning:

- the arcade is already a multi-game platform, not a single-game prototype
- the content catalog is larger than the currently registered playable set
- some entries are still "coming soon" catalog items rather than shipped games

## Architecture Map

### Core UI

- `src/app/page.tsx` is thin and simply mounts `ArcadeHub`
- `src/components/arcade/ArcadeHub.tsx` is the real orchestrator
- `src/components/arcade/GameCarousel.tsx` handles tier/game unlock flow
- `src/components/arcade/ThemedGameCanvas.tsx` owns in-game shell, overlays, and game end handling

### Game Runtime

- `src/games/registry.ts` lazy-loads games with dynamic imports
- `src/games/shared/BaseGame.ts` centralizes canvas setup, score/coin calculation, analytics, and game end flow
- larger games follow a modular pattern with local `entities/`, `systems/`, `levels/`, or `data/` folders

### Progression

- `src/services/CurrencyService.ts` handles balance and reward calculation
- `src/services/AchievementService.ts` handles threshold-based unlock checks
- `src/services/ChallengeService.ts` generates and tracks daily challenges
- `src/services/UserServices.ts` owns profile, stats, XP, perks, and milestones
- `src/components/arcade/ArcadeHub.tsx` is where many rewards and sync side effects are actually applied

### Backend / Sync

- `src/hooks/useSupabaseAuth.ts` manages session bootstrap and auth actions
- `src/services/SupabaseArcadeService.ts` wraps Supabase reads/writes
- `supabase/001_init.sql` defines schema, RLS, leaderboard view, and score RPCs

### Audio

- `src/services/AudioManager.ts` is the top-level audio facade
- `src/services/ProceduralMusicEngine.ts` powers generated music and track catalog
- `src/components/arcade/AudioSettings.tsx` is a large control surface for music, lab tools, favorites, and visualization

### Testing

- Jest covers services and a few lib modules
- Playwright covers a small set of smoke flows
- app/components/game engines are still lightly verified compared with the service layer

## What Is Strong

- The core product vision is visible in code, not just docs.
- The hub already feels like a platform, not a toy demo.
- The game loading model is clean and scalable.
- Local-first guest mode is thoughtful and keeps the app playable when Supabase is absent.
- Supabase integration is real, not speculative.
- The progression loop is rich enough to keep building on.
- The project has more content breadth than the old README suggests.

## Where The Codebase Has Drifted

### Docs Drift

These docs are helpful, but no longer fully represent current truth:

- `README.md` has been refreshed, but older planning docs still describe an earlier-stage project
- `DOCS/DevelopmentPlan.md` and parts of `DOCS/DevelopmentPlan_2.md` describe features that are already implemented
- `DOCS/AUDIO-SYSTEM-HANDOFF.md` is useful, but some persistence details are stale
- `DOCS/Test101.md` looks partially out of date and should be treated as provisional

Best current references:

- live code
- `DOCS/ActionPlan.md`
- `DOCS/UserSystemsHandoff.md`
- this handoff

### Structural Drift

- `ArcadeHub.tsx` is now a large monolith at roughly 1,300 lines
- `AudioSettings.tsx` is also very large at roughly 1,900 lines
- there are legacy or duplicate UI surfaces that are no longer the main path

Recent cleanup:

- the unused Zustand store path was retired, which removes one of the duplicate progression models
- unlock persistence logic is now extracted into a focused hook instead of sitting inline in `ArcadeHub`

## Production Blockers

These are the highest-signal issues to fix before calling the project production-ready.

### 1. Secrets Need Rotation Discipline, Not Tracked-Tree Removal

Current repo state on April 13, 2026:

- a local `.env` may still exist on disk for development
- `.env*` is ignored by git
- `git ls-files` does not currently show a tracked `.env`
- `env.example` now provides placeholder-only setup guidance

This removes the tracked-working-tree blocker, but a human still needs to rotate Supabase keys if any previous real values were ever shared or committed elsewhere.

Actions:

- keep real Supabase keys only in local `.env.local` or deployment env vars
- rotate anon/service-role keys if the previous values ever left a trusted local machine
- avoid using a committed `.env` as a setup path going forward

### 2. TypeScript Is Green, Build Is Green, Lint Debt Remains

Verified on April 13, 2026:

- `cmd /c npm run type-check` passes
- `cmd /c npm run build` passes

The concrete TypeScript blockers that were fixed include:

- case-sensitive achievement import mismatch
- missing `SoundName` aliases used by games
- missing `InputManager` compatibility methods referenced by games
- Supabase auth resend type mismatch in `useSupabaseAuth.ts`
- strict typing issues in `jest.setup.ts`
- flaky post-build type-check behavior caused by incremental `.next` type state

Important caveat:

- the original ESLint backlog that was blocking production builds has been cleared
- `next build` now runs linting and type-checking again instead of bypassing them
- further lint drift should be treated as a regression, not accepted debt

### 3. Catalog vs Playable Registry Is Out Of Sync

- 27 games are listed in the catalog
- 16 are actually registered

That mismatch is still part roadmap and part product risk, but the unsafe behavior is now contained.

What changed:

- the hub now derives playable status from the live registry
- unregistered entries render as coming soon
- unregistered entries cannot be purchased
- unregistered entries cannot be launched
- tiers with no released games cannot be unlocked with coins
- unlock migration and "all games unlocked" checks now count only registered games

Actions:

- decide which catalog items are truly ship candidates
- keep catalog, registry, and thumbnail assets in sync

### 4. PWA Surface Is Incomplete

This was previously misleading because the app advertised PWA intent without shipping the required assets or offline/service-worker wiring.

Current state:

- the manifest has been removed
- app metadata no longer points at missing PWA assets
- the app no longer claims an install surface it does not implement

Remaining action:

- only reintroduce PWA metadata after shipping real icons, screenshots, and an actual offline/service-worker strategy

### 5. Client Trust Is Still Too High

Supabase sync is wired, but the app still trusts the client heavily for:

- coin economy
- achievements
- challenge progression
- leaderboard submissions

RLS helps, but it does not replace server-side validation.

### 6. State Ownership Is Split

Progress exists across:

- local services
- Supabase rows
- local storage keys

This increases drift risk and makes bugs harder to reason about.

Status update:

- the stale Zustand store layer has been removed
- the remaining split is between local service state, unlock persistence state, and Supabase sync/hydration
- this is better than before, but not fully consolidated yet

### 7. A Few Concrete Code Risks Need Cleanup

- `BaseGame.destroy()` can still flow through end-of-game reward logic
- leaderboard UI can show generated placeholder rows, which is demo-friendly but can confuse real users
- challenge progress logic depends on string/description matching instead of typed requirement definitions
- `UserServices.addExperience()` only levels once per call, even if a large XP reward crosses multiple thresholds

## Recommended Production Plan

### Phase 1: Stabilize The Build And Security

1. Rotate and remove committed secrets.
2. Make `npm run type-check` pass.
3. Fix case-sensitive imports and Windows-only assumptions.
4. Hide or disable purchase/play for unregistered catalog entries.
5. Add missing manifest assets or remove incomplete PWA claims.

### Phase 2: Consolidate The Platform

1. Break `ArcadeHub` into smaller hooks/components.
2. Continue the move toward a single source of truth for user progress.
3. Retire duplicate UI surfaces that are no longer used.
4. Move challenge logic from description parsing to typed requirement keys.
5. Review reward flow so services and hub are not splitting critical logic awkwardly.

### Phase 3: Hardening For Real Users

1. Add server-side validation for score/economy-sensitive writes.
2. Add a real offline outbox/retry strategy for Supabase sync.
3. Add CI gates for type-check, lint, unit tests, and Playwright.
4. Add error tracking and production logging.
5. Expand auth, persistence, and unlock-flow automated coverage.

### Phase 4: Ship-Ready Product Polish

1. Finish accessibility pass for carousel, tabs, modals, and keyboard behavior.
2. Resolve stale copy across onboarding, instructions, and roadmap docs.
3. Decide whether placeholder leaderboard rows remain in production.
4. Revisit the README so it reflects the actual project.

## Suggested Team Priorities

If the team only does a small number of things next, I would prioritize these:

1. Secure the repo and rotate Supabase keys.
2. Get the TypeScript build green.
3. Align the catalog with what is actually playable.
4. Pick one progression source of truth.
5. Add server-side validation around economy and score submission.

## Final Assessment

This is not a project that needs to be rediscovered from scratch. It already has a strong playable foundation, real platform features, and enough content to justify a production push.

The gap between "interesting project" and "production-ready project" is mostly in hardening:

- security
- build correctness
- state consolidation
- server trust boundaries
- finishing the PWA/offline story

That is good news. The hardest part, building the arcade itself, is already here.
