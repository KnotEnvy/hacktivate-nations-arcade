# Start Here

Last updated: April 30, 2026

This is the minimal handoff set for the next team. The production-hardening pass, Speed Racer implementation, procedural audio pass, and startup-performance pass are complete. The remaining work before public launch is deployment-readiness review, signed-in browser smoke testing, and final production operations.

## Read Order

1. `README.md`
2. `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md`
3. `DOCS/ActionPlan.md`
4. `DOCS/VERCEL-PRODUCTION-RUNBOOK.md`
5. `DOCS/AUDIO-SYSTEM-HANDOFF.md` if you are touching music, sound effects, the audio settings modal, or launch/hub music
6. `DOCS/UserSystemsHandoff.md` if you are touching auth, persistence, Supabase, progression sync, analytics ownership, or local-save boundaries
7. `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` if you need to change the live Supabase schema or verify the trusted progression RPC path

## Current Verified Repo State

Verified on April 15, 2026:

- `npm test -- --runInBand` passes
- `npm run e2e` passed against the then-current guest-era smoke specs
- `.github/workflows/ci.yml` now mirrors the local verification gates
- trusted `record-session` derives gameplay progression server-side and commits through `public.commit_trusted_game_session(...)`

Verified on April 16, 2026:

- `npm run lint` passes
- `npm run type-check` passes
- `npm run build` passes
- the arcade now runs as a signed-in product flow; the guest gameplay/profile path has been retired from the main UX
- first-time signed-in accounts hydrate clean defaults instead of inheriting stale guest/local stats
- queued sync work surfaces offline state, failed replay diagnostics, and a manual retry action in the hub
- the route/RPC contract for `commit_trusted_game_session(...)` is aligned with the deployed SQL, and the wallet update ambiguity in `supabase/001_init.sql` is fixed
- analytics storage is now account-scoped via `hacktivate-analytics:<ownerId>` and no longer reads the legacy shared guest bucket
- the catalog listed 27 entries, while `src/games/registry.ts` registered 16 playable games at that point

Verified on April 25, 2026 after the procedural music/SB32 pass:

- `npm.cmd test -- ProceduralMusicEngine.patches.test.ts --runInBand` passes
- `npm.cmd test -- AudioManager.test.ts --runInBand` passes
- `npm.cmd run type-check` passes
- `npm.cmd run lint` passes
- `npm.cmd run build` passes
- procedural music playback is no longer silenced by delayed track cleanup during hub/lab transitions
- `hub_music` and `game_music` compatibility aliases now route through procedural SB32-style tracks instead of the old legacy music generator
- the new `hub_sb32_intro` / "SB32 Power-On" track is first in hub auto-rotation and visible at the top of the Hub/Menu track browser

Verified on April 30, 2026 after Speed Racer completion and startup optimization:

- `src/games/registry.ts` now registers 17 playable games, including `speed-racer`
- `/` now renders a lightweight arcade boot shell and dynamically loads the full hub
- Supabase auth/sync clients and the procedural audio engine are deferred until hydration/session/audio use instead of being part of the first route payload
- production build reports `/` at 103 kB first-load JS
- `npm.cmd run type-check` passes
- `npm.cmd run lint` passes
- `npm.cmd test -- --runInBand` passes
- `npm.cmd run build` passes
- Playwright specs are not the current launch source of truth until refreshed for the signed-in-only product flow; use signed-in manual smoke testing for deployment readiness

## What To Work On Next

Highest-value remaining work:

1. Run signed-in browser QA against the deployed preview and production candidates.
   - Verify auth, wallet updates, leaderboard writes, achievements, daily challenges, analytics ownership, queued sync retry, audio unlock/playback, Speed Racer, and sign-out/sign-in account reset
2. Finish release-only operational decisions.
   - Decide whether placeholder leaderboard rows remain acceptable in production
   - Add monitoring/error tracking if that is still part of launch scope
   - Rotate Supabase keys if any prior real values were shared outside the current secure deployment setup
3. Keep the live Supabase project, `supabase/001_init.sql`, and `src/lib/supabase.types.ts` aligned after any future SQL change.
4. Run the deploy gate before promotion: `npm.cmd run type-check`, `npm.cmd run lint`, `npm.cmd test -- --runInBand`, and `npm.cmd run build`.

## Docs To Ignore Unless You Need Deep History

These are not the right starting point for day-to-day execution:

- `DOCS/DevelopmentPlan.md`
- `DOCS/DevelopmentPlan_2.md`
- `DOCS/BUBBLE-POP-SESSION-HANDOFF.md`
- `DOCS/FROG-HOP-SESSION-HANDOFF.md`
- `DOCS/UI_Review_and_Suggestions.md`
- `DOCS/Test101.md`
- `DOCS/projectSetup.md`
- the Product Requirements document in `DOCS/`

Use those only if you need historical context for a specific subsystem or product decision.
