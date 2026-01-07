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
- Auth hook: `src/hooks/useSupabaseAuth.ts`
- Auth UI: `src/components/auth/AuthModal.tsx`, `src/components/auth/WelcomeBanner.tsx`
- Auth callback: `src/app/auth/callback/page.tsx`
- Supabase API wrapper: `src/services/SupabaseArcadeService.ts`
- Hydration + sync: `src/components/arcade/ArcadeHub.tsx`
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
- ArcadeHub hydrates from Supabase when session exists and seeds Supabase if missing.
- Local storage keys:
  - hacktivate-unlocks-v2
  - hacktivate-unlocked-tiers
  - hacktivate-user-progress
  - hacktivate-user-profile
  - hacktivate-user-stats
  - hacktivate-achievements
  - hacktivate-challenges
  - hacktivate-coins
- Ownership key:
  - hacktivate-session-owner
  - When the session user changes (or guest -> user), local storage is reset to avoid cross-account bleed.

## Sync Strategy (ArcadeHub)
- Hydration: load profile, player_state, wallet, achievements, challenges from Supabase.
  - If missing, seed Supabase from local.
  - Uses isHydratingRef/hasHydratedRef to avoid loops.
- Debounced sync for profile + player_state (schedulePlayerSync).
- Wallet sync on coin changes.
- Challenge sync batched/debounced.
- Achievements sync when unlocked.
- Leaderboard sync via RPC `record_leaderboard_score` on game end.

## Known Pitfalls
- If `supabase.types.ts` is missing `Relationships` or if a view is listed under Tables, Postgrest generics infer `never` and cause errors like "property does not exist on type 'never'".
- `player_state.stats` expects `Json`, so UserStats is cast as `unknown as Json` in ArcadeHub.
- Ensure `leaderboards_view` type references `Database.public.Views` in UI.

## User Experience Notes
- Guest mode explicitly shows "Guest mode (local save)" and explains that progress is local only.
- Sign-out or account changes clear local progress to prevent one user's stats from leaking to another.
- If you want to preserve guest progress across sign-ins, move local storage to per-user keys instead of global keys.

## Quick Debug Checklist
- Missing emails: configure Supabase SMTP, verify redirect URL, check spam.
- Auth state not updating: confirm `useSupabaseAuth` hook is mounted and session changes propagate.
- Leaderboards empty: ensure `record_leaderboard_score` RPC exists in Supabase and RLS allows select.

## Suggested Commands
- Type check: `pnpm run type-check`
- Dev server: `pnpm run dev`

## If You Add New User Stats
- Update `GameEndData` in `ArcadeHub.tsx` (if from a game end payload).
- Update `UserServices.ts` default stats.
- Update Supabase `player_state.stats` payload (still JSON), add new achievements/challenges if needed.

End of handoff.
