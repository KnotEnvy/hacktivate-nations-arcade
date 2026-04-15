# HacktivateNations Arcade - Action Plan

Last updated: April 14, 2026

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

## Current Priority

### Platform Hardening
- [~] Add server-side validation for economy, leaderboards, achievements, and challenge-sensitive writes.
  - Current state: payout-sensitive writes now route through the server with catalog/template validation and authoritative wallet reconciliation.
  - Remaining: move unlock-condition evaluation itself off the client so the server can validate gameplay-derived achievements/challenge completion, not just payout/id legitimacy.
- [~] Add a real offline outbox/retry strategy for Supabase sync failures.
  - Current state: signed-in profile/player-state sync, trusted challenge sync, reward claims, unlock purchases, and session records queue locally and replay automatically.
  - Remaining: strengthen server-side idempotency/atomicity for queued session replay and consider surfacing richer sync diagnostics / manual retry UX.
- [ ] Expand automated coverage for auth, persistence, unlocks, progression, and sync.
- [x] Add CI gates for lint, type-check, Jest, and Playwright.

### Platform Consolidation
- [ ] Continue breaking `src/components/arcade/ArcadeHub.tsx` into focused hooks/components.
- [~] Replace string-matching challenge logic with typed requirement logic.
  - Current state: daily challenge templates and live progress updates are typed.
  - Remaining: finish the migration for any future non-daily/server-seeded challenge variants and trim more challenge/progression logic out of `ArcadeHub.tsx`.
- [ ] Tighten reward-flow ownership so progression-critical logic is not split awkwardly across services and hub code.
- [ ] Decide whether placeholder leaderboard rows remain acceptable in production.

### Product / Launch Readiness
- [ ] Rotate Supabase keys if any prior real values were ever shared or committed outside the current git index.
- [ ] Provision and validate a real production Supabase project and apply `supabase/001_init.sql`.
- [ ] Add error tracking and deploy-time monitoring.
- [ ] Reintroduce PWA metadata only after shipping real icons, screenshots, and service-worker/offline behavior.
- [ ] Publish deployment/runbook steps for Vercel preview and production.

## Lower Priority / Post-Beta

- [ ] Move challenge generation to a server-seeded model with stable schedules.
- [ ] Add analytics/feature-flag integration.
- [ ] Add i18n scaffolding.
- [ ] Revisit economy tuning with live analytics.
- [ ] Decide on realtime/multiplayer direction.
