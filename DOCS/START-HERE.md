# Start Here

Last updated: April 16, 2026

This is the minimal handoff set for the next team. The production-hardening pass is largely complete. The main delivery left before public launch is the final shipped game plus release validation.

## Read Order

1. `README.md`
2. `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md`
3. `DOCS/ActionPlan.md`
4. `DOCS/UserSystemsHandoff.md` if you are touching auth, persistence, Supabase, progression sync, analytics ownership, or local-save boundaries
5. `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` if you need to change the live Supabase schema or verify the trusted progression RPC path
6. `DOCS/AUDIO-SYSTEM-HANDOFF.md` only if you are touching the procedural audio/music system

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

## What To Work On Next

Highest-value remaining work:

1. Add the final game to the shipped set.
   - Build the module under `src/games/<id>`
   - Register it in `src/games/registry.ts`
   - Align or update the catalog entry in `src/data/Games.ts`
   - Add the real thumbnail asset under `public/games/<id>/`
   - Verify the end-of-game payload reports score, reward, and any stats needed for achievements/challenges/analytics
2. Run signed-in QA against the final game and the shared systems.
   - Verify auth, wallet updates, leaderboard writes, achievements, daily challenges, analytics ownership, queued sync retry, and sign-out/sign-in account reset
3. Finish release-only operational polish.
   - Publish the Vercel preview/production deployment runbook
   - Decide whether placeholder leaderboard rows remain acceptable in production
   - Add monitoring/error tracking if that is still part of launch scope
4. Keep the live Supabase project, `supabase/001_init.sql`, and `src/lib/supabase.types.ts` aligned after any future SQL change.

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
