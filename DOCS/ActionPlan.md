# HacktivateNations Arcade - Action Plan

Last updated: April 15, 2026

This is the current execution checklist. It should reflect the live repo, not the original roadmap.

## Completed Recently

- [x] `npm run lint` passes
- [x] `npm run type-check` passes
- [x] `npm run build` passes
- [x] Case-sensitive import and Windows-only TypeScript blockers were fixed
- [x] Unregistered catalog games are now non-purchasable and non-launchable
- [x] Tiers with no released games can no longer consume coins
- [x] Misleading PWA/install metadata was removed
- [x] Placeholder env guidance now lives in `env.example`
- [x] Unlock persistence was extracted to `src/hooks/useArcadeUnlockState.ts`
- [x] Unused Zustand stores were removed
- [x] Signed-in leaderboard submissions, game-session rewards, challenge reward claims, achievement reward claims, and tier/game unlock purchases now flow through `src/app/api/arcade/progression/route.ts`
- [x] Daily challenge definitions now live in `src/lib/challenges.ts` and `ChallengeService` no longer depends on description string matching for live progress updates
- [x] Focused Jest coverage was added for typed challenge progression and trusted progression validation helpers
- [x] Failed signed-in sync/mutation writes now enqueue into `src/services/SupabaseSyncOutbox.ts` and replay automatically on reconnect / polling
- [x] Large XP grants now level through every crossed threshold instead of stopping after one level
- [x] GitHub Actions CI now runs type-check, lint, Jest, build, and Playwright via `.github/workflows/ci.yml`
- [x] Signed-in Supabase hydration/sync/outbox orchestration was extracted from `ArcadeHub.tsx` into `src/hooks/useArcadeSupabaseSync.ts`
- [x] Focused hook coverage now exists for owner-reset handling and queued Supabase sync replay
- [x] Playwright config/tests were hardened so the smoke suite passes reliably under the local `npm run e2e` path
- [x] Trusted `record-session` now evaluates gameplay-derived progression server-side and commits wallet/player-state/achievement/challenge/leaderboard writes through the atomic `public.commit_trusted_game_session(...)` RPC
- [x] Focused API route coverage now exists for the atomic trusted session path, duplicate replay responses, and missing-RPC failures

## Current Priority

### Platform Hardening
- [~] Add server-side validation for economy, leaderboards, achievements, and challenge-sensitive writes.
  - Current state: gameplay-derived trusted session progression is now validated server-side and committed atomically through the database RPC, not as route-level multi-writes.
  - Remaining: expand server-derived coverage for progression that still originates outside trusted game-session metrics, such as non-session feature unlock flows.
- [~] Add a real offline outbox/retry strategy for Supabase sync failures.
  - Current state: signed-in profile/player-state sync, trusted challenge sync, reward claims, unlock purchases, and session records queue locally and replay automatically; queued trusted sessions now replay against an atomic DB commit with duplicate suppression.
  - Remaining: surface richer sync diagnostics / manual retry UX and validate the new RPC path against the real hosted Supabase project.
- [~] Expand automated coverage for auth, persistence, unlocks, progression, and sync.
  - Current state: service/lib coverage is solid, hook coverage exists for the extracted signed-in Supabase sync bridge, and route coverage now exists for the trusted progression API session path.
  - Remaining: add broader auth and persistence integration coverage beyond the current focused hook/service tests.
- [x] Add CI gates for lint, type-check, Jest, and Playwright.

### Platform Consolidation
- [~] Continue breaking `src/components/arcade/ArcadeHub.tsx` into focused hooks/components.
  - Current state: unlock persistence lives in `src/hooks/useArcadeUnlockState.ts`, and signed-in Supabase hydration/sync/outbox ownership now lives in `src/hooks/useArcadeSupabaseSync.ts`.
  - Remaining: move more reward-flow and end-of-game progression orchestration out of the hub.
- [~] Replace string-matching challenge logic with typed requirement logic.
  - Current state: daily challenge templates and live progress updates are typed.
  - Remaining: finish the migration for any future non-daily/server-seeded challenge variants and trim more challenge/progression logic out of `ArcadeHub.tsx`.
- [~] Tighten reward-flow ownership so progression-critical logic is not split awkwardly across services and hub code.
  - Current state: trusted sync ownership is no longer embedded across multiple large `ArcadeHub` effects.
  - Remaining: end-of-game reward, achievement, and challenge completion orchestration still mostly lives in the hub.
- [ ] Decide whether placeholder leaderboard rows remain acceptable in production.

### Product / Launch Readiness
- [ ] Rotate Supabase keys if any prior real values were ever shared or committed outside the current git index.
- [ ] Provision and validate a real production Supabase project and apply `supabase/001_init.sql`.
  - Use `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` for the current apply + verification sequence.
- [ ] Add error tracking and deploy-time monitoring.
- [ ] Reintroduce PWA metadata only after shipping real icons, screenshots, and service-worker/offline behavior.
- [~] Publish deployment/runbook steps for Vercel preview and production.
  - Current state: the Supabase apply/test runbook now exists at `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md`.
  - Remaining: publish the matching Vercel preview/production deployment runbook.

## Lower Priority / Post-Beta

- [ ] Move challenge generation to a server-seeded model with stable schedules.
- [ ] Add analytics/feature-flag integration.
- [ ] Add i18n scaffolding.
- [ ] Revisit economy tuning with live analytics.
- [ ] Decide on realtime/multiplayer direction.
