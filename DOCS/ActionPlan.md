# HacktivateNations Arcade - Action Plan

Last updated: April 16, 2026

This is the live execution checklist. It reflects the current repo state after the production-hardening pass, not the original roadmap.

## Completed Recently

- [x] `npm run lint` passes
- [x] `npm run type-check` passes
- [x] `npm test -- --runInBand` passes
- [x] `npm run e2e` passes
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
- [x] Failed signed-in sync/mutation writes now enqueue into `src/services/SupabaseSyncOutbox.ts` and replay automatically on reconnect / polling
- [x] Large XP grants now level through every crossed threshold instead of stopping after one level
- [x] GitHub Actions CI now runs type-check, lint, Jest, build, and Playwright via `.github/workflows/ci.yml`
- [x] Signed-in Supabase hydration/sync/outbox orchestration was extracted from `ArcadeHub.tsx` into `src/hooks/useArcadeSupabaseSync.ts`
- [x] Trusted `record-session` now evaluates gameplay-derived progression server-side and commits through the atomic `public.commit_trusted_game_session(...)` RPC
- [x] Focused API route coverage now exists for the atomic trusted session path, duplicate replay responses, and missing-RPC failures
- [x] Signed-in sync status now surfaces offline/failed replay diagnostics and offers a manual retry action from the hub auth status area
- [x] The main product flow now requires sign-in; the guest gameplay/profile path has been retired
- [x] First-time signed-in accounts now hydrate clean default profile/player-state/wallet rows instead of inheriting stale local guest data
- [x] The route-side RPC call now matches the live SQL function signature for `commit_trusted_game_session(...)`
- [x] The wallet update ambiguity inside `supabase/001_init.sql` was fixed and signed-in session replay now works against the current schema
- [x] Analytics storage is account-scoped and no longer leaks legacy guest metrics into signed-in profiles
- [x] Focused auth/sync/analytics coverage now exists for the signed-in production model

## Current Priority

### Final Game Integration

- [ ] Decide whether the final ship target uses an existing coming-soon catalog id or introduces a new id
- [ ] Implement the final game under `src/games/<id>`
- [ ] Register the final game in `src/games/registry.ts`
- [ ] Align the catalog entry in `src/data/Games.ts` and replace the placeholder thumbnail with a real asset under `public/games/<id>/`
- [ ] Verify the game end payload reports score, reward, and any game-specific stats needed for shared progression, challenges, or analytics
- [ ] Add or update targeted tests if the game introduces new shared logic or persistence surfaces

### Release Validation

- [ ] Run the local verification gates again after the final game lands: `npm run type-check`, `npm run lint`, `npm test -- --runInBand`, `npm run build`, `npm run e2e`
- [ ] Smoke test signed-in flows with real accounts: auth, play session, wallet, leaderboard, achievements, challenges, analytics, sign-out/sign-in reset
- [ ] Simulate dropped-network replay and verify queued sync retry still drains cleanly
- [ ] Decide whether placeholder leaderboard rows remain acceptable in production
- [ ] Publish the matching Vercel preview/production deployment runbook
- [ ] Add error tracking and deploy-time monitoring if still required for launch

### Ongoing Hardening

- [~] Continue breaking `src/components/arcade/ArcadeHub.tsx` into focused hooks/components
  - Current state: unlock persistence and signed-in Supabase sync ownership are already extracted
  - Remaining: more end-of-game orchestration and reward-flow logic can still move out of the hub
- [~] Expand automated coverage for auth, persistence, unlocks, progression, and sync
  - Current state: route/service/hook coverage is solid for the hardened paths
  - Remaining: broader integration coverage around end-to-end signed-in flows would still be valuable
- [~] Keep the live Supabase project, `supabase/001_init.sql`, and `src/lib/supabase.types.ts` aligned
  - Current state: the current hosted schema supports the atomic trusted session path
  - Remaining: any future SQL edit must be followed by a live apply, type regeneration, and a replay test
- [ ] Rotate Supabase keys if any prior real values were ever shared or committed outside the current git index

## Lower Priority / Post-Launch

- [ ] Move challenge generation to a server-seeded model with stable schedules
- [ ] Add external analytics and feature-flag integration beyond the current local/account-scoped metrics
- [ ] Add i18n scaffolding
- [ ] Revisit economy tuning with real player data
- [ ] Decide on realtime/multiplayer direction
