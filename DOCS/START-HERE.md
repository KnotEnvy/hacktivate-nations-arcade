# Start Here

Last updated: April 15, 2026

This is the minimal handoff set for the next team. Start here instead of browsing every doc in `DOCS/`.

## Read Order

1. `README.md`
2. `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md`
3. `DOCS/ActionPlan.md`
4. `DOCS/UserSystemsHandoff.md` if you are touching auth, persistence, Supabase, progression sync, or local save ownership
5. `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` if you need to apply or verify the live Supabase schema before signed-in testing or deployment
6. `DOCS/AUDIO-SYSTEM-HANDOFF.md` only if you are touching the procedural audio/music system

## Current Verified Repo State

Verified on April 14, 2026:

- `npm run lint` passes
- `npm run type-check` passes
- `npm run build` passes
- the hub only allows purchase/play for games that are registered in `src/games/registry.ts`
- incomplete PWA/install metadata has been removed until the asset/service-worker surface is real
- unlock persistence now lives in `src/hooks/useArcadeUnlockState.ts`
- the unused Zustand stores under `src/stores/` were removed

Verified on April 15, 2026:

- `npm test -- --runInBand` passes
- `npm run e2e` passes
- `.github/workflows/ci.yml` now exists and mirrors the local verification gates
- large XP grants now level through every crossed threshold instead of only one level per call
- signed-in Supabase hydration/sync/outbox ownership now lives in `src/hooks/useArcadeSupabaseSync.ts`
- Playwright smoke coverage is configured to run serially for stability against the local `next dev` server
- trusted `record-session` now validates gameplay-derived progression server-side instead of only payout ids
- atomic session replay now commits through `public.commit_trusted_game_session(...)` in `supabase/001_init.sql`
- focused route coverage now exists for the trusted progression API happy path, duplicate replay response, and missing-RPC failure

## What To Work On Next

Highest-value remaining work:

1. Continue server-trust hardening so gameplay-derived achievement/challenge unlock conditions move off the client, not just payout-sensitive writes.
2. Continue reducing `ArcadeHub.tsx` complexity and move more progression/reward ownership out of the component.
   The signed-in Supabase sync block is already extracted; next likely targets are end-of-game reward and progression orchestration.
3. Finish the typed challenge migration for future challenge variants and server-seeded schedules.
4. Expand tests around auth, persistence, unlocks, progression, and sync.
5. Apply `supabase/001_init.sql` to the real Supabase project, regenerate `src/lib/supabase.types.ts`, and run signed-in smoke validation.

## Docs To Ignore Unless You Need Deep History

These are not the right starting point for day-to-day execution:

- `DOCS/DevelopmentPlan.md`
- `DOCS/DevelopmentPlan_2.md`
- `DOCS/BUBBLE-POP-SESSION-HANDOFF.md`
- `DOCS/FROG-HOP-SESSION-HANDOFF.md`
- `DOCS/UI_Review_and_Suggestions.md`
- `DOCS/Test101.md`
- `DOCS/projectSetup.md`
- `DOCS/HacktivateNations Arcade – Product Requirements Document v2.md`

Use those only if you need historical context for a specific subsystem or product decision.
