# Supabase Production Runbook

Last updated: July 15, 2026

Use this when promoting or verifying the current trusted progression work against a real Supabase project before signed-in testing or deployment.

## What Changed

The clean-install schema lives in `supabase/001_init.sql`. Existing projects must apply `supabase/003_lock_down_progression.sql` before public launch, and `supabase/004_game_saves.sql` for cloud game saves (the Dungeon Crawl roster). The current server route depends on:

- `public.commit_trusted_game_session(...)`
- `public.record_leaderboard_score(...)`
- `public.upsert_leaderboard_score(...)`
- `public.claim_trusted_challenge(...)`
- `public.apply_trusted_unlock_purchase(...)`

`POST /api/arcade/progression` expects the atomic trusted-session RPC to exist and expects its named arguments to match the route call exactly.

## Apply Order

1. Confirm the target Supabase project is the one you want to test against
2. Back up any non-disposable beta data if needed
3. Apply `supabase/003_lock_down_progression.sql` to the existing target project
4. Apply `supabase/004_game_saves.sql` (non-destructive: adds the `game_saves` table + `upsert_game_save` RPC for cross-device game saves)
5. Regenerate local Supabase types if the schema changed
6. Verify the RPCs exist before running the app against that project
7. Run local verification and then test the signed-in flows in the browser

## Apply The SQL

### Existing Project: Supabase SQL Editor

1. Open the target project in Supabase
2. Open the SQL Editor
3. Paste the contents of `supabase/003_lock_down_progression.sql`
4. Run it against the target database

### Existing Project: Supabase CLI

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Only use `db push` when the linked migration history includes `003`. Otherwise apply the file in the SQL Editor. Never apply `001_init.sql` to an existing database: it drops the arcade tables and is intended only for a new empty project.

## Regenerate Types

After the schema is live, regenerate `src/lib/supabase.types.ts` so local RPC typing stays aligned:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/lib/supabase.types.ts
```

If you skip this, the app can still compile with local casts, but typed RPC coverage will lag the real schema.

## Verify Database State

Run these checks in the SQL Editor:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'commit_trusted_game_session',
    'record_leaderboard_score',
    'upsert_leaderboard_score',
    'claim_trusted_challenge',
    'apply_trusted_unlock_purchase',
    'upsert_game_save'
  )
order by routine_name;
```

You should see all six routines (`upsert_game_save` only after 004 is applied).

Confirm the game-saves surface after applying 004: `game_saves` exists with RLS enabled, `authenticated` may execute `upsert_game_save` (it writes only the caller's own row via `auth.uid()`), and `anon` may not:

```sql
select grantee from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'upsert_game_save';
```

Confirm browser roles cannot execute the privileged functions:

```sql
select routine_name, grantee
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'commit_trusted_game_session',
    'upsert_leaderboard_score',
    'claim_trusted_challenge',
    'apply_trusted_unlock_purchase'
  )
order by routine_name, grantee;
```

`anon`, `authenticated`, and `PUBLIC` must not appear. `service_role` should have execute access.

Optional duplicate-replay spot check:

```sql
select user_id, settings -> 'processedSessionMutationIds' as processed_ids
from public.player_state
limit 5;
```

## App Verification

After the SQL is applied:

1. Set local or deployment env vars for the target project
2. Run:

```bash
npm run type-check
npm test -- --runInBand
npm run lint
npm run build
```

3. Sign in with a real account
4. Play one registered game
5. Confirm:
   - session reward is awarded
   - leaderboard row updates
   - challenge progress updates
   - achievement unlocks reconcile correctly
   - analytics stay attached to the current account instead of prior guest/test state
6. Temporarily simulate a failed network write, then reconnect and confirm the queued session replays only once
7. Sign in as a second account and confirm the first account's queued operations do not replay
8. Using an authenticated browser token, verify direct insert/update attempts against `wallets`, `player_state`, `achievements`, `challenge_assignments`, and `leaderboard_scores` are denied

## Common Failure Signals

- `Could not find the function public.claim_trusted_challenge(...)` or `public.apply_trusted_unlock_purchase(...)`
  - `supabase/003_lock_down_progression.sql` has not been applied, or the PostgREST schema cache has not refreshed.
- `Failed to commit trusted game session atomically: column reference "balance" is ambiguous`
  - The target project is still running an older version of `supabase/001_init.sql`; reapply the latest file.
- Type errors around missing RPC names or arg shapes
  - `src/lib/supabase.types.ts` is stale.
- Signed-in sessions replay but balance, achievements, challenges, and leaderboards do not move together
  - The target project is still on a pre-atomic-RPC schema, or the route/RPC contract drifted.

## Notes

- `supabase/001_init.sql` rebuilds the arcade schema and must only be used for a new empty project.
- `supabase/003_lock_down_progression.sql` is the non-destructive launch migration for the existing project.
- `supabase/004_game_saves.sql` is non-destructive and adds cloud game saves. The payload is opaque game STATE only (no coins/unlocks — rewards stay on trusted session metrics). Until it is applied, the app degrades silently to local-only saves.
- Treat future changes to `commit_trusted_game_session(...)` as coordinated app + SQL + generated-types work.
