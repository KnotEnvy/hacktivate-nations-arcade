-- Cloud game saves: one JSON save document per (user, game).
-- Non-destructive migration for existing projects. Apply after 003.
--
-- Design contract (see DOCS/SUPABASE-PRODUCTION-RUNBOOK.md):
-- - The payload is opaque game STATE (e.g. the Dungeon Crawl hero roster).
--   It never carries coins, unlocks, or any reward-bearing value — those ride
--   trusted session metrics through the progression route.
-- - Browser clients read their own row via RLS and write ONLY through the
--   upsert_game_save RPC, which pins user_id to auth.uid().

create table if not exists public.game_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.game_saves enable row level security;

drop policy if exists "game_saves_select_own" on public.game_saves;
create policy "game_saves_select_own" on public.game_saves
  for select using (auth.uid() = user_id);

-- No insert/update/delete policies: mutations go through the RPC below.

create or replace function public.upsert_game_save(
  _game_id text,
  _payload jsonb
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if _game_id is null or btrim(_game_id) = '' or length(_game_id) > 64 then
    raise exception 'A valid game id is required.';
  end if;

  if _payload is null or jsonb_typeof(_payload) <> 'object' then
    raise exception 'Save payload must be a JSON object.';
  end if;

  if pg_column_size(_payload) > 65536 then
    raise exception 'Save payload exceeds the supported size.';
  end if;

  insert into public.game_saves (user_id, game_id, payload, updated_at)
  values (v_user_id, _game_id, _payload, v_now)
  on conflict (user_id, game_id) do update set
    payload = excluded.payload,
    updated_at = v_now;

  return v_now;
end;
$$;

-- The RPC authenticates via auth.uid(), so authenticated users may execute it;
-- they can still only ever write their own row.
revoke all on function public.upsert_game_save(text, jsonb) from public, anon;
grant execute on function public.upsert_game_save(text, jsonb) to authenticated;
grant execute on function public.upsert_game_save(text, jsonb) to service_role;
