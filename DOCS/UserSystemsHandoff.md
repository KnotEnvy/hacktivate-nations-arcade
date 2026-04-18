# User Systems Handoff (Auth + Profiles + Persistence)

Last updated: April 16, 2026

This is the current orientation doc for the Hacktivate Arcade user systems. It is meant to get a new contributor to the real auth/persistence flow without re-reading the entire codebase.

## Context

- App: Next.js 15, client-heavy arcade hub with local runtime services and Supabase as the signed-in source of truth
- Production model: sign-in required; the old guest gameplay/profile flow has been retired from the main UX
- Supabase: Auth + Postgres for profiles, progression, wallets, achievements, challenges, and leaderboards
- localStorage still exists for client cache, unlock persistence, sync outbox, and account-scoped analytics, but it is no longer treated as a shared guest bucket

## Env + Auth Routing

- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` for server admin paths only
- Auth redirect URL must include:
  - `http://localhost:3000/auth/callback` for local dev
  - your deployed domain `/auth/callback` for preview/production
- If magic-link emails do not arrive, verify Supabase Auth SMTP and redirect configuration
- If Supabase env vars are absent or invalid, auth is unavailable and the arcade remains behind the sign-in gate; this is no longer a supported guest-play path

## Key Files

- Supabase types: `src/lib/supabase.types.ts`
- Supabase client wrappers: `src/lib/supabase.ts`
- Trusted progression validation + challenges: `src/lib/trustedProgression.ts`, `src/lib/challenges.ts`
- Trusted progression route: `src/app/api/arcade/progression/route.ts`
- Supabase runbook: `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md`
- Persistent sync outbox: `src/services/SupabaseSyncOutbox.ts`
- Auth hook: `src/hooks/useSupabaseAuth.ts`
- Signed-in sync hook: `src/hooks/useArcadeSupabaseSync.ts`
- Auth UI: `src/components/auth/AuthModal.tsx`, `src/components/auth/WelcomeBanner.tsx`
- Auth callback: `src/app/auth/callback/page.tsx`
- Supabase API wrapper: `src/services/SupabaseArcadeService.ts`
- Hub integration: `src/components/arcade/ArcadeHub.tsx`
- Local user services: `src/services/UserServices.ts`, `CurrencyService.ts`, `AchievementService.ts`, `ChallengeService.ts`
- Analytics ownership: `src/services/Analytics.ts`

## Supabase Schema Summary

Defined in `supabase/001_init.sql`:

- `profiles`: public profile data
- `player_state`: private progression, unlocks, stats JSON, settings JSON
- `wallets`: balance + lifetime earned
- `achievements`: per-user unlock records
- `challenge_assignments`: per-user challenge state
- `leaderboard_scores`: per-user aggregated period scores
- `leaderboards_view`: leaderboard join for UI reads
- RPC: `record_leaderboard_score(game_id, score)`
- RPC: `upsert_leaderboard_score(...)`
- RPC: `commit_trusted_game_session(...)` for atomic trusted session replay across `player_state`, `wallets`, `achievements`, `challenge_assignments`, and leaderboards
- RLS: users can only read/write their own private rows; leaderboard view is public read

## Auth Flow

- `useSupabaseAuth` exposes:
  - `session`, `profile`, `loading`, `error`
  - `emailSentMode`, `pendingEmail`
  - `signInWithEmail`, `signInWithPassword`, `signUpWithPassword`
  - `resendEmail(mode)`, `clearAuthMessages`
  - `signOut`, `refreshProfile`
- Current UI in `AuthModal.tsx` exposes only magic-link and password sign-in
- Public self-signup is intentionally hidden in the current modal even though the hook still supports it
- The callback page exchanges the auth code/hash and redirects home; on failure it shows a recovery path

## Local State vs Supabase

- Runtime services still own in-memory profile, wallet, achievements, challenges, and analytics behavior during play
- `useArcadeSupabaseSync` hydrates profile, `player_state`, wallet, achievements, and challenges when a session exists
- If rows are missing, the hook seeds clean default rows for that account
- First-time accounts no longer inherit guest/local stats during hydration
- Unlock persistence lives in `src/hooks/useArcadeUnlockState.ts`

Active and legacy localStorage keys:

- `hacktivate-session-owner`
- `hacktivate-unlocks-v2`
- `hacktivate-user-progress` (legacy cleanup/reset key, not a live source of truth)
- `hacktivate-user-profile`
- `hacktivate-user-stats`
- `hacktivate-achievements`
- `hacktivate-challenges`
- `hacktivate-coins`
- `hacktivate-supabase-sync-outbox-v1`
- `hacktivate-analytics` (legacy cleanup key only; current code does not read from it)
- `hacktivate-analytics:<ownerId>` (active analytics storage)

Ownership behavior:

- `hacktivate-session-owner` stores the current signed-in user id
- If the stored owner is missing or differs from the new session user id, local state is reset before hydration
- This is the main guard against cross-account bleed on sign-out/sign-in or tester account switching

## Sync Strategy (`useArcadeSupabaseSync`)

- Service bootstrap: create the browser `SupabaseArcadeService` only when a valid session exists
- Hydration:
  - fetch `profile`, `player_state`, `wallet`, `achievements`, and `challenge_assignments`
  - if `profiles`, `player_state`, or `wallets` rows are missing, create clean defaults for the account
  - if challenges are missing, regenerate the local challenge set and upsert it
  - use `isHydratingRef` / `hasHydratedRef` to avoid looped writes
- Debounced sync for profile + `player_state` happens through `schedulePlayerSync`
- Unlock tier/game state comes from `useArcadeUnlockState`, which owns normalization and migration
- Challenge progress sync goes through the trusted API route and template-backed validation instead of direct browser writes
- Signed-in leaderboard submissions, game-session rewards, challenge reward claims, achievement reward claims, and tier/game unlock purchases go through `POST /api/arcade/progression`
- Direct wallet-on-coin-change sync was removed for signed-in users so the browser no longer pushes arbitrary balances
- Failed signed-in sync/mutation calls enqueue into `hacktivate-supabase-sync-outbox-v1` and replay automatically on reconnect / polling
- The hook exposes outbox diagnostics: pending count, failed count, highest retry count, last error, offline state, and `retryPendingSyncs()`
- Trusted session replay now sends `timePlayedMs` plus gameplay metrics so the server can derive progression before the atomic DB commit

## Analytics Ownership

- `Analytics` is now account-scoped, not global
- Current storage keys are `hacktivate-analytics:<ownerId>`
- The legacy shared key `hacktivate-analytics` is intentionally ignored so old guest metrics do not leak into signed-in views
- Live analytics consumers should pass the active owner id explicitly when possible to avoid first-render timing races around `localStorage`

## Source Of Truth

- `UserService` owns active client profile/stats state
- `CurrencyService` owns active client wallet state and reward calculation
- `AchievementService` and `ChallengeService` own local progression slices
- `useArcadeUnlockState` owns tier/game unlock persistence
- For signed-in progression-critical writes, the server route plus Supabase rows are the authority
- The client should reconcile wallet/unlock state from trusted responses rather than inventing signed-in balances locally
- localStorage is a cache/reset boundary, not a canonical shared guest state

## Trusted Progression Route

- Route: `src/app/api/arcade/progression/route.ts`
- Auth: requires `Authorization: Bearer <supabase access token>`
- Current trusted actions:
  - `record-session`
  - `claim-achievements`
  - `sync-challenges`
  - `claim-challenge`
  - `unlock-tier`
  - `unlock-game`
- The route ensures `profiles`, `player_state`, and `wallets` rows exist before applying mutations
- `record-session` accepts an optional client mutation id plus gameplay metrics, derives trusted progression from the payload, then commits via `public.commit_trusted_game_session(...)`
- Duplicate suppression for queued trusted sessions now lives inside the database RPC via `player_state.settings.processedSessionMutationIds`

## Known Pitfalls

- If `src/lib/supabase.types.ts` is stale, PostgREST/RPC typing can drift from the real schema and route code will start needing casts
- `player_state.stats` still expects `Json`, so `UserStats` is cast as `unknown as Json` in `useArcadeSupabaseSync`
- `leaderboards_view` should stay under `Database.public.Views`, not `Tables`
- Any future SQL change to `commit_trusted_game_session(...)` must be mirrored in both the live database and `src/lib/supabase.types.ts`

## User Experience Notes

- The arcade now requires sign-in before normal use
- Sign-out or account switching clears local state before hydrating the next account
- Maintain any internal QA/dev account configuration outside the repo; do not commit shared test credentials into docs or source

## Quick Debug Checklist

- Missing emails: verify Supabase SMTP, redirect URL, and spam folders
- Auth state not updating: confirm `useSupabaseAuth` is mounted and the callback flow is returning to `/auth/callback`
- Leaderboards empty: ensure `record_leaderboard_score(...)` and `upsert_leaderboard_score(...)` exist in the target Supabase project
- Error mentioning `Could not find the function public.commit_trusted_game_session(...) in the schema cache`: the live SQL and app route signature are out of sync, or the latest SQL was not applied
- Error mentioning `column reference "balance" is ambiguous`: the target Supabase project is still running an older version of `supabase/001_init.sql`
- Analytics looks like the wrong account: confirm the active session user id is being passed through analytics consumers and the legacy `hacktivate-analytics` bucket is not being used

## Suggested Commands

- Type check: `npm run type-check`
- Lint: `npm run lint`
- Unit tests: `npm test -- --runInBand`
- Dev server: `npm run dev`

## If You Add New User Stats

- Update `GameEndData` in `ArcadeHub.tsx` if the game end payload changes
- Update `src/services/UserServices.ts` default stats
- Update the `player_state.stats` payload shape
- Add or update achievements/challenges/trusted progression helpers if the new stat affects shared progression
