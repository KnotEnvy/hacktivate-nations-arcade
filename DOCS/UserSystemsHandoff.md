# User Systems Handoff (Auth + Profiles + Persistence)

This document is a quick orientation for the Hacktivate Arcade user systems so a new contributor or LLM can jump in without re-reading the full codebase.

## Context
- App: Next.js 15, client-heavy arcade hub with local-first services and Supabase as the online source of truth.
- Offline mode: When Supabase env vars are missing, the UI runs in guest mode and persists to localStorage only.
- Supabase: Auth + Postgres for profiles, progression, wallet, achievements, challenges, and leaderboards.

## Env + Auth Routing
- Required env vars:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - (Optional for server admin calls) SUPABASE_SERVICE_ROLE_KEY
- Auth redirect URL must include:
  - http://localhost:3000/auth/callback (dev)
  - Your Vercel domain /auth/callback (prod)
- If magic link or signup emails do not arrive, verify Supabase Auth SMTP is configured.

## Key Files
- Supabase types: `src/lib/supabase.types.ts`
  - Must include `Relationships` for each table.
  - `leaderboards_view` lives under `Database.public.Views` (not Tables) to avoid `never` typing.
- Supabase client wrappers: `src/lib/supabase.ts`
- Trusted progression validation + challenge definitions: `src/lib/trustedProgression.ts`, `src/lib/challenges.ts`
- Trusted progression route: `src/app/api/arcade/progression/route.ts`
- Supabase apply/test runbook: `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md`
- Persistent sync outbox: `src/services/SupabaseSyncOutbox.ts`
- Auth hook: `src/hooks/useSupabaseAuth.ts`
- Signed-in Supabase sync hook: `src/hooks/useArcadeSupabaseSync.ts`
- Auth UI: `src/components/auth/AuthModal.tsx`, `src/components/auth/WelcomeBanner.tsx`
- Auth callback: `src/app/auth/callback/page.tsx`
- Supabase API wrapper: `src/services/SupabaseArcadeService.ts`
- Hub integration: `src/components/arcade/ArcadeHub.tsx`
- Local user services: `src/services/UserServices.ts`, `CurrencyService.ts`, `AchievementService.ts`, `ChallengeService.ts`

## Supabase Schema Summary
Defined in `supabase/001_init.sql`:
- profiles: public profile data (id, username, avatar, created_at, updated_at)
- player_state: private progression (level, experience, play time, unlocks, stats JSON, settings JSON)
- wallets: balances + lifetime earned
- achievements: per-user unlock records
- challenge_assignments: per-user challenge state
- leaderboard_scores: per-user aggregated period scores
- leaderboards_view: join of leaderboard_scores + profiles for UI
- RPC: `record_leaderboard_score(game_id, score)` updates all periods
- RPC: `commit_trusted_game_session(...)` now atomically commits trusted session replay results across player_state, wallets, achievements, challenge_assignments, and leaderboards
- RLS: users can only read/write their own private rows; leaderboards are public read

## Auth + Registration Flow
- `useSupabaseAuth` exposes:
  - session, profile, loading, error
  - emailSentMode: 'magic' | 'signup' | null
  - pendingEmail (last email used)
  - signInWithEmail (magic link), signInWithPassword, signUpWithPassword
  - resendEmail(mode) and clearAuthMessages
  - signOut, refreshProfile
- The Auth modal (`AuthModal.tsx`) has two UI states:
  1) Form state (Magic link / Sign in / Sign up)
  2) Email-sent state (shows recipient, resend link, change email)
- Callback page exchanges code/hash and redirects home. On error it shows a recovery button.

## Local State vs Supabase
- Local services keep the game playable offline.
- `useArcadeSupabaseSync` hydrates from Supabase when session exists and seeds Supabase if missing.
- Unlock persistence is handled by `src/hooks/useArcadeUnlockState.ts`.
- Local storage keys:
  - hacktivate-unlocks-v2
  - hacktivate-user-progress (legacy cleanup/reset key, not an active source of truth)
  - hacktivate-user-profile
  - hacktivate-user-stats
  - hacktivate-achievements
  - hacktivate-challenges
  - hacktivate-coins
- Ownership key:
  - hacktivate-session-owner
  - When the session user changes (or guest -> user), local storage is reset to avoid cross-account bleed.

## Sync Strategy (`useArcadeSupabaseSync`)
- Service bootstrap: create the browser `SupabaseArcadeService` only when a session exists.
- Hydration: load profile, player_state, wallet, achievements, challenges from Supabase.
  - If missing, seed Supabase from local.
  - Uses isHydratingRef/hasHydratedRef to avoid loops.
- Debounced sync for profile + player_state (`schedulePlayerSync`).
- Unlock tier/game state now comes from `useArcadeUnlockState`, which owns normalization and legacy migration before sync.
- Challenge progress sync now goes through the trusted API route and uses template-backed validation instead of direct browser upserts.
- Signed-in leaderboard submissions, game-session coin awards, challenge reward claims, achievement reward claims, and tier/game unlock purchases now go through `POST /api/arcade/progression`.
- Direct wallet-on-coin-change sync was removed for signed-in users so browser state no longer pushes arbitrary balances to Supabase.
- Failed signed-in sync/mutation calls now enqueue into `hacktivate-supabase-sync-outbox-v1` and replay automatically on reconnect / polling while a session is active.
- The hook also owns guest/user ownership resets via `hacktivate-session-owner` so local save state is cleared on account changes.
- The hub now shows pending-sync status, offline/failed replay diagnostics, and a manual retry action next to the auth state when queued writes exist.
- Hydration/bootstrap seeding still uses direct Supabase upserts when rows are missing so guest/local progress can initialize a new account.
- `useArcadeSupabaseSync` now exposes outbox diagnostics (`failedCount`, highest retry count, last error) plus `retryPendingSyncs()` and current offline state for UI surfaces.
- Trusted session replay now sends richer gameplay metrics (`timePlayedMs` + metric bag) so the server can derive progression from the session payload before the atomic DB commit.

## Source Of Truth
- `UserService` is the active client owner for profile/stats/perks.
- `CurrencyService` is the active client owner for wallet balance and reward calculation.
- `AchievementService` and `ChallengeService` own their respective local progression slices.
- `useArcadeUnlockState` owns tier/game unlock persistence.
- For signed-in economy-sensitive mutations, the server route is now the persistence authority and the client reconciles local balance/unlock state from the response.
- The old Zustand stores under `src/stores/` were removed because they were not part of the live app path.

## Progression Note
- `UserService.addExperience()` now applies every crossed level threshold in a single grant and fires each level-up callback, which matters for large end-of-game XP rewards and future server-issued bonuses.

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
- The route ensures profile/player_state/wallet rows exist before applying mutations and validates against the registered game catalog, achievement catalog, and typed daily challenge templates.
- `record-session` now accepts an optional client mutation id plus richer gameplay metrics, derives server-trusted progression from the payload, then commits through `public.commit_trusted_game_session(...)`.
- Duplicate suppression for queued trusted sessions now happens inside the database RPC via `player_state.settings.processedSessionMutationIds`, so replay protection is part of the atomic commit instead of a route-only guard.
- The route now has focused coverage for the atomic session happy path, duplicate replay response, and missing-RPC failure mode.
- Remaining gap: any target Supabase project must have the updated `supabase/001_init.sql` applied before signed-in testing, or `record-session` will fail with a missing-RPC error.

## Known Pitfalls
- If `supabase.types.ts` is missing `Relationships` or if a view is listed under Tables, Postgrest generics infer `never` and cause errors like "property does not exist on type 'never'".
- `player_state.stats` expects `Json`, so `UserStats` is cast as `unknown as Json` inside `useArcadeSupabaseSync`.
- Ensure `leaderboards_view` type references `Database.public.Views` in UI.

## User Experience Notes
- Guest mode explicitly shows "Guest mode (local save)" and explains that progress is local only.
- Sign-out or account changes clear local progress to prevent one user's stats from leaking to another.
- If you want to preserve guest progress across sign-ins, move local storage to per-user keys instead of global keys.

## Quick Debug Checklist
- Missing emails: configure Supabase SMTP, verify redirect URL, check spam.
- Auth state not updating: confirm `useSupabaseAuth` hook is mounted and session changes propagate.
- Leaderboards empty: ensure `record_leaderboard_score` RPC exists in Supabase and RLS allows select.
- Trusted session errors mentioning `commit_trusted_game_session`: apply the latest `supabase/001_init.sql` and regenerate `src/lib/supabase.types.ts`.

## Suggested Commands
- Type check: `npm run type-check`
- Dev server: `npm run dev`

## If You Add New User Stats
- Update `GameEndData` in `ArcadeHub.tsx` (if from a game end payload).
- Update `UserServices.ts` default stats.
- Update Supabase `player_state.stats` payload (still JSON), add new achievements/challenges if needed.

End of handoff.
