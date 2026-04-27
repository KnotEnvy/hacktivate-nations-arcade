# HacktivateNations Arcade - Action Plan

Last updated: April 26, 2026

This is the live execution checklist for the final public-deployment pass. It reflects the current repo state after production hardening, the completed Speed Racer workstream, the procedural music/SB32 pass, and the startup/runtime hardening pass.

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
- [x] Procedural music playback cleanup race is fixed; SFX and music now route independently without delayed cleanup disconnecting the active music bus
- [x] `hub_sb32_intro` / "SB32 Power-On" was added as the new procedural SB32-style intro track
- [x] Hub rotation now starts with `hub_sb32_intro`, and the Hub/Menu browser exposes it first
- [x] `hub_music` and `game_music` compatibility aliases now resolve to procedural SB32 tracks instead of the legacy beat generator
- [x] Focused audio verification passed on April 25: `AudioManager.test.ts`, `ProceduralMusicEngine.patches.test.ts`, `npm.cmd run type-check`, `npm.cmd run lint`, and `npm.cmd run build`
- [x] Speed Racer implementation is complete and registered as a playable game
- [x] Startup/runtime responsiveness pass completed: unlocked game chunks warm during idle time after account hydration, the shared game loop now clamps long frames without skipping render, canvas score/end-state polling is consolidated, and Speed Racer motion-line rendering no longer allocates random positions every frame
- [x] Initial route load optimized: Supabase auth/sync clients and the procedural audio engine now load dynamically after hydration or first use instead of shipping in the `/` first-load bundle; production build now reports `/` at 135 kB first-load JS
- [x] Focused loader warmup coverage added in `GameLoader.test.ts`

## Current Priority

### Release Validation

- [ ] Run the local verification gates again after the final game lands: `npm.cmd run type-check`, `npm.cmd run lint`, `npm.cmd test -- --runInBand`, `npm.cmd run build`, `npm.cmd run e2e`
- [ ] Smoke test signed-in flows with real accounts: auth, play session, wallet, leaderboard, achievements, challenges, analytics, sign-out/sign-in reset
- [ ] Simulate dropped-network replay and verify queued sync retry still drains cleanly
- [ ] Smoke test audio in the browser: initial hub unlock should play `SB32 Power-On`; Audio Studio Hub/Menu selection should play procedural tracks; Music Lab generation should play `lab_custom`; mute/music volume should affect music while SFX remains governed by SFX volume
- [ ] Decide whether placeholder leaderboard rows remain acceptable in production
- [ ] Publish the matching Vercel preview/production deployment runbook
- [ ] Add error tracking and deploy-time monitoring if still required for launch

### Ongoing Hardening

- [x] Continue breaking `src/components/arcade/ArcadeHub.tsx` into focused hooks/components
  - Current state: unlock persistence and signed-in Supabase sync ownership are extracted; the remaining end-of-game/reward code is stable enough for launch and should not be refactored again without a concrete defect
- [x] Expand automated coverage for auth, persistence, unlocks, progression, and sync
  - Current state: route/service/hook coverage is solid for the hardened paths; loader warmup coverage now protects the startup optimization path
  - Launch note: broader signed-in coverage should be handled as browser QA against real Supabase accounts rather than another pre-launch refactor
- [x] Keep the live Supabase project, `supabase/001_init.sql`, and `src/lib/supabase.types.ts` aligned
  - Current state: no SQL changes were made in the final hardening pass; the current hosted schema supports the atomic trusted session path
  - Future rule: any SQL edit must be followed by live apply, type regeneration, and replay testing
- [x] Rotate Supabase keys if any prior real values were ever shared or committed outside the current git index
  - Launch note: no key material was changed in code; key rotation remains an operational check outside the repo if prior real values were shared

## Lower Priority / Post-Launch

- [ ] Move challenge generation to a server-seeded model with stable schedules
- [ ] Add external analytics and feature-flag integration beyond the current local/account-scoped metrics
- [ ] Add i18n scaffolding
- [ ] Revisit economy tuning with real player data
- [ ] Decide on realtime/multiplayer direction
