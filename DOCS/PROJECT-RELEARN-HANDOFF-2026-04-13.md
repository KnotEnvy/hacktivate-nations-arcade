# HacktivateNations Arcade Relearn Handoff

Snapshot date: April 13, 2026  
Refreshed through: April 30, 2026

## Purpose

This is the broad current-state handoff for the team after time away from the project. It is based on the live codebase first and is meant to complement `DOCS/START-HERE.md`, not replace it.

## Executive Summary

HacktivateNations Arcade is no longer in the "prove the concept" phase. The arcade hub, progression loop, Supabase auth/persistence, sync outbox, leaderboards, achievements, challenges, and game platform are all real and working.

The production-hardening pass also closed the biggest platform risks:

- signed-in progression-sensitive writes now go through the trusted route
- trusted game sessions now commit through an atomic Supabase RPC
- signed-in sync failures queue and replay instead of silently dropping
- the main product flow is now sign-in-only instead of relying on guest profiles
- analytics storage is scoped to the active account instead of a shared guest bucket

The final game is now implemented. The main remaining delivery before public launch is straightforward: validate signed-in shared systems on a Vercel preview, finish release operations, and promote production only after the deploy gate passes.

## Status Update

Verified on April 13, 2026 after the Phase 1 stabilization pass:

- `npm run type-check` passes
- `npm run build` passes
- the hub now uses the live registry as the source of truth for purchase/play
- incomplete PWA/install metadata was removed
- `env.example` replaced placeholder guidance that had drifted into old setup docs

Verified on April 14, 2026 after the consolidation pass:

- unlock persistence moved into `src/hooks/useArcadeUnlockState.ts`
- the old Zustand stores under `src/stores/` were removed
- `npm run lint` passes again
- `npm run type-check` no longer depends on a prior build to generate `.next` type stubs

Verified on April 15, 2026 after the trusted progression + sync hardening pass:

- signed-in leaderboard submissions, reward claims, and unlock purchases flow through `src/app/api/arcade/progression/route.ts`
- daily challenge progress uses typed requirement logic instead of description-string matching
- failed signed-in writes queue into `src/services/SupabaseSyncOutbox.ts` and replay automatically
- `.github/workflows/ci.yml` now runs type-check, lint, Jest, build, and Playwright
- signed-in Supabase hydration/sync/outbox ownership moved into `src/hooks/useArcadeSupabaseSync.ts`
- trusted `record-session` derives gameplay progression server-side and commits through `public.commit_trusted_game_session(...)`
- focused route coverage now exists for the trusted session happy path, duplicate replay, and missing-RPC failure

Verified on April 16, 2026 after the production-model cleanup pass:

- the hub now requires sign-in for the normal product flow; guest gameplay/profile UX has been retired
- first-time signed-in accounts hydrate clean defaults instead of inheriting local guest-era stats
- the route-side RPC call now matches the live SQL signature for `commit_trusted_game_session(...)`
- the wallet update ambiguity in `supabase/001_init.sql` was fixed
- analytics storage now uses `hacktivate-analytics:<ownerId>` and no longer reads the legacy shared guest bucket
- `npm run lint`, `npm run type-check`, `npm test -- --runInBand`, and `npm run build` are green

Verified on April 30, 2026 after the Speed Racer and startup-performance pass:

- Speed Racer is complete and registered
- `src/games/registry.ts` registers 17 playable games
- `/` renders through a lightweight boot shell and production build reports 103 kB first-load JS
- Supabase auth/sync clients and procedural audio load dynamically after hydration/session/audio use
- `npm.cmd run lint`, `npm.cmd run type-check`, `npm.cmd test -- --runInBand`, and `npm.cmd run build` are green
- Playwright specs need a signed-in-flow refresh before being used as a blocking launch gate

## Current Reality

### Stack

- Frontend: Next.js App Router, React 19, TypeScript, Tailwind
- State/persistence: local runtime services, `useArcadeUnlockState`, signed-in Supabase hydration/sync, account-scoped analytics
- Backend: Supabase Auth + Postgres schema + RLS + progression/leaderboard RPCs
- Rendering: HTML5 canvas mini-games with shared base classes/services
- Testing: Jest + Playwright, with lint/type-check/build gates in CI

### What Players Can Do Today

- Sign in with magic link or password auth
- Browse the arcade hub tabs for `Games`, `Leaderboards`, `Challenges`, `Achievements`, and `Profile`
- Play the currently registered games and earn coins/XP
- Unlock tiers and games from the shipped catalog
- Complete daily challenges and unlock achievements
- Sync signed-in progress to Supabase
- View leaderboards
- Use the procedural audio controls and hidden music-lab surface

### Game Catalog State

- `src/data/Games.ts` currently lists 27 catalog entries across 5 tiers
- `src/games/registry.ts` currently registers 17 playable games
- unregistered entries stay visible as roadmap/coming-soon content but cannot be purchased or launched

Practical meaning:

- the arcade is already a multi-game platform, not a prototype
- the shared systems have already been exercised across many games
- the final game is complete; the next team should treat remaining work as deployment validation and production operations, not greenfield infrastructure

## Architecture Map

### Core UI

- `src/app/page.tsx` mounts `ArcadeHub`
- `src/components/arcade/ArcadeHub.tsx` is still the main orchestrator
- `src/components/arcade/GameCarousel.tsx` handles tier/game unlock flow
- `src/components/arcade/ThemedGameCanvas.tsx` owns in-game shell, overlays, and game end handling

### Game Runtime

- `src/games/registry.ts` lazy-loads games with dynamic imports
- `src/games/shared/BaseGame.ts` centralizes canvas setup, score/coin handling, analytics, and game-end flow
- larger games follow modular `entities/`, `systems/`, `levels/`, or `data/` folders

### Progression + Sync

- `src/services/UserServices.ts` owns client profile/stats
- `src/services/CurrencyService.ts` owns client wallet/reward calculation
- `src/services/AchievementService.ts` and `src/services/ChallengeService.ts` own local progression slices
- `src/hooks/useArcadeUnlockState.ts` owns unlock persistence
- `src/hooks/useSupabaseAuth.ts` owns auth bootstrap and auth actions
- `src/hooks/useArcadeSupabaseSync.ts` owns signed-in hydration, sync, outbox replay, and owner-reset logic
- `src/app/api/arcade/progression/route.ts` owns trusted server-side progression-sensitive mutations

### Audio

- `src/services/AudioManager.ts` is the top-level audio facade
- `src/services/ProceduralMusicEngine.ts` powers generated music and track catalog
- `src/components/arcade/AudioSettings.tsx` is the main audio control surface

### Testing

- Jest covers the service/lib/hook layer well
- Playwright covers smoke flows
- game engines and broader signed-in integration paths still have less coverage than the service layer

## What Is Strong

- The core platform is already in place
- The signed-in persistence model is real and much harder to abuse than before
- The registry-based game loading model scales cleanly
- The progression loop is rich enough to support one more game without architectural churn
- The audio system is unusually deep for an arcade project of this size
- The repo now has meaningful verification gates instead of a best-effort dev-only workflow

## Where The Codebase Has Drifted

### Docs Drift

The current best references are:

- `DOCS/START-HERE.md`
- `README.md`
- `DOCS/ActionPlan.md`
- `DOCS/UserSystemsHandoff.md`
- live code

Older planning docs still contain historical value, but many describe a pre-hardening version of the project.

### Structural Drift

- `ArcadeHub.tsx` is still a large orchestrator even after the sync extraction
- `AudioSettings.tsx` is also large
- the remaining complexity is more about consolidation and polish than missing infrastructure

## Remaining Release Risks

### 1. Signed-In Release Validation Still Needs A Final Pass

- Speed Racer is complete and wired into the registry/catalog
- the next team should validate Speed Racer and shared systems with real signed-in accounts
- verify wallet, achievements, challenges, leaderboards, queued sync, analytics ownership, and sign-out/sign-in reset

### 2. Release Operations Still Need A Final Pass

- Vercel preview/production deployment steps now live in `DOCS/VERCEL-PRODUCTION-RUNBOOK.md`
- monitoring/error tracking is still a policy choice, not a completed launch system
- placeholder leaderboard rows may still need a product decision before public release

### 3. Schema/Route Drift Can Reappear If Future SQL Changes Are Not Disciplined

- `commit_trusted_game_session(...)` now works, but route args, live SQL, and `src/lib/supabase.types.ts` must stay aligned
- future Supabase schema edits should be treated as coordinated app + DB changes, not one-sided edits

### 4. State Ownership Is Better, Not Perfect

- the stale Zustand layer is gone
- signed-in sync ownership is much clearer
- `ArcadeHub.tsx` still owns some end-of-game orchestration that could be extracted later if needed

## Recommended Final Stretch Plan

### Phase 1: Final Game

Complete. Speed Racer is implemented, registered, catalog-aligned, and included in the startup/runtime optimization pass.

### Phase 2: Validate Signed-In Shared Systems

1. Run `npm.cmd run type-check`
2. Run `npm.cmd run lint`
3. Run `npm.cmd test -- --runInBand`
4. Run `npm.cmd run build`
5. Smoke test signed-in auth, wallet, leaderboard, achievements, challenges, analytics, and queued sync retry
6. Refresh Playwright specs for the signed-in-only product flow before making `npm.cmd run e2e` blocking again

### Phase 3: Release Ops

1. Use `DOCS/VERCEL-PRODUCTION-RUNBOOK.md` for preview and production promotion
2. Confirm the live Supabase schema still matches `supabase/001_init.sql`
3. Regenerate `src/lib/supabase.types.ts` if SQL changed
4. Decide on monitoring and placeholder leaderboard behavior

## Suggested Team Priorities

If the team only does a small number of things next, prioritize these:

1. Validate the signed-in progression path against Speed Racer and the shared systems
2. Run the deploy gate and Vercel preview checklist
3. Decide placeholder leaderboard and monitoring behavior for release
4. Keep Supabase SQL, route args, and generated types aligned
5. Leave deeper refactors alone unless launch validation proves a real blocker

## Final Assessment

This is a production-hardening project near the end, not an early-stage rebuild. The foundation is already there, the major sync/auth/security gaps have been addressed, and the remaining work is concrete.

The next team should be able to finish this by staying disciplined:

- validate Speed Racer and shared systems through the existing hardened progression path
- avoid reopening guest-mode assumptions
- keep the live Supabase schema and app contract aligned
