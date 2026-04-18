# Supabase Production Runbook

Last updated: April 16, 2026

Use this when promoting or verifying the current trusted progression work against a real Supabase project before signed-in testing or deployment.

## What Changed

The repo currently depends on the SQL in `supabase/001_init.sql`, including:

- `public.commit_trusted_game_session(...)`
- `public.record_leaderboard_score(...)`
- `public.upsert_leaderboard_score(...)`

`POST /api/arcade/progression` expects the atomic trusted-session RPC to exist and expects its named arguments to match the route call exactly.

## Apply Order

1. Confirm the target Supabase project is the one you want to test against
2. Back up any non-disposable beta data if needed
3. Apply `supabase/001_init.sql` to the target project
4. Regenerate local Supabase types if the schema changed
5. Verify the RPCs exist before running the app against that project
6. Run local verification and then test the signed-in flows in the browser

## Apply The SQL

### Option 1: Supabase SQL Editor

1. Open the target project in Supabase
2. Open the SQL Editor
3. Paste the contents of `supabase/001_init.sql`
4. Run it against the target database

### Option 2: Supabase CLI

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

If you are not using migrations yet, run the SQL file manually through your preferred Postgres client instead.

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
    'upsert_leaderboard_score'
  )
order by routine_name;
```

You should see all three routines.

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

## Common Failure Signals

- `Failed to commit trusted game session atomically: Could not find the function public.commit_trusted_game_session(...) in the schema cache`
  - The target project does not have the latest SQL, or the app route and live function signature are out of sync.
- `Failed to commit trusted game session atomically: column reference "balance" is ambiguous`
  - The target project is still running an older version of `supabase/001_init.sql`; reapply the latest file.
- Type errors around missing RPC names or arg shapes
  - `src/lib/supabase.types.ts` is stale.
- Signed-in sessions replay but balance, achievements, challenges, and leaderboards do not move together
  - The target project is still on a pre-atomic-RPC schema, or the route/RPC contract drifted.

## Notes

- `supabase/001_init.sql` still rebuilds the arcade schema for a clean environment, so be careful applying it to a database with data you need to preserve.
- If you need non-destructive production migrations later, split the current schema file into incremental migrations before broad rollout.
- Treat future changes to `commit_trusted_game_session(...)` as coordinated app + SQL + generated-types work.
