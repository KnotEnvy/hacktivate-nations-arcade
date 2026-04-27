# Start Here

Last updated: April 25, 2026

This is the minimal handoff set for the next team. The production-hardening pass is largely complete. Speed Racer is the final game track and has its own handoff. The remaining work before public launch is final integration, release validation, and deployment-readiness review.

## Read Order

1. `README.md`
2. `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md`
3. `DOCS/ActionPlan.md`
5. `DOCS/AUDIO-SYSTEM-HANDOFF.md` if you are touching music, sound effects, the audio settings modal, or launch/hub music
6. `DOCS/UserSystemsHandoff.md` if you are touching auth, persistence, Supabase, progression sync, analytics ownership, or local-save boundaries
7. `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` if you need to change the live Supabase schema or verify the trusted progression RPC path

## Current Verified Repo State

Verified on April 15, 2026:

- `npm test -- --runInBand` passes
- `npm run e2e` passes
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
- the catalog still lists 27 entries, while `src/games/registry.ts` currently registers 16 playable games

Verified on April 25, 2026 after the procedural music/SB32 pass:

- `npm.cmd test -- ProceduralMusicEngine.patches.test.ts --runInBand` passes
- `npm.cmd test -- AudioManager.test.ts --runInBand` passes
- `npm.cmd run type-check` passes
- `npm.cmd run lint` passes
- `npm.cmd run build` passes
- procedural music playback is no longer silenced by delayed track cleanup during hub/lab transitions
- `hub_music` and `game_music` compatibility aliases now route through procedural SB32-style tracks instead of the old legacy music generator
- the new `hub_sb32_intro` / "SB32 Power-On" track is first in hub auto-rotation and visible at the top of the Hub/Menu track browser

## What To Work On Next

Highest-value remaining work:

2. Run signed-in QA against Speed Racer and the shared systems.
   - Verify auth, wallet updates, leaderboard writes, achievements, daily challenges, analytics ownership, queued sync retry, and sign-out/sign-in account reset
3. Finish release-only operational polish.
   - Publish the Vercel preview/production deployment runbook
   - Decide whether placeholder leaderboard rows remain acceptable in production
   - Add monitoring/error tracking if that is still part of launch scope
4. Keep the live Supabase project, `supabase/001_init.sql`, and `src/lib/supabase.types.ts` aligned after any future SQL change.
5. Run the full launch gate after Speed Racer lands: `npm.cmd run type-check`, `npm.cmd run lint`, `npm.cmd test -- --runInBand`, `npm.cmd run build`, and `npm.cmd run e2e`.

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
