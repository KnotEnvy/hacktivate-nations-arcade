-- Base schema for Hacktivate Arcade persistence.
-- Apply in the Supabase SQL editor or via: supabase db push
-- NOTE: This script resets the arcade tables for a clean alpha state.

create extension if not exists "pgcrypto";

-- Drop dependent objects first for clean rebuilds.
drop view if exists public.leaderboards_view;
drop function if exists public.commit_trusted_game_session(uuid, text, integer, integer, text[], integer, integer, jsonb, jsonb, jsonb, text);
drop function if exists public.record_leaderboard_score(text, integer);
drop function if exists public.upsert_leaderboard_score(uuid, text, public.leaderboard_period, date, integer);
drop table if exists public.leaderboard_scores cascade;
drop table if exists public.game_sessions cascade;
drop table if exists public.challenge_assignments cascade;
drop table if exists public.achievements cascade;
drop table if exists public.wallets cascade;
drop table if exists public.player_state cascade;
drop table if exists public.profiles cascade;

drop type if exists public.challenge_type;
drop type if exists public.leaderboard_period;

-- Enums
create type public.leaderboard_period as enum ('daily', 'weekly', 'monthly', 'all_time');
create type public.challenge_type as enum ('daily', 'weekly');

-- Public profiles (safe for public read)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null,
  avatar text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Private per-player state
create table public.player_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  level integer not null default 1,
  experience integer not null default 0,
  total_play_time integer not null default 0,
  games_played integer not null default 0,
  last_active_at timestamptz,
  unlocked_tiers integer[] not null default '{0}',
  unlocked_games text[] not null default '{}',
  stats jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Wallet balances
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0,
  lifetime_earned integer not null default 0,
  updated_at timestamptz default now()
);

-- Achievements per user
create table public.achievements (
  user_id uuid references public.profiles(id) on delete cascade,
  achievement_id text not null,
  progress numeric,
  unlocked_at timestamptz,
  updated_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

-- Challenge assignments per user
create table public.challenge_assignments (
  user_id uuid references public.profiles(id) on delete cascade,
  challenge_id text not null,
  title text not null,
  description text not null,
  type public.challenge_type not null,
  game_id text,
  target integer not null,
  progress integer not null default 0,
  reward integer not null default 0,
  completed_at timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz default now(),
  primary key (user_id, challenge_id)
);

-- Aggregated leaderboard scores
create table public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  period public.leaderboard_period not null,
  period_start date not null,
  user_id uuid references public.profiles(id) on delete cascade,
  score integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index leaderboard_scores_unique
  on public.leaderboard_scores (game_id, period, period_start, user_id);

create index leaderboard_scores_rank
  on public.leaderboard_scores (game_id, period, period_start, score desc);

-- Leaderboard view for UI
create or replace view public.leaderboards_view as
select
  ls.game_id,
  ls.user_id,
  p.username,
  p.avatar,
  ls.score,
  rank() over (partition by ls.game_id, ls.period, ls.period_start order by ls.score desc, ls.updated_at asc) as rank,
  ls.period,
  ls.period_start,
  ls.updated_at as created_at
from public.leaderboard_scores ls
join public.profiles p on p.id = ls.user_id;

-- Helper function to upsert a single period
create or replace function public.upsert_leaderboard_score(
  _user_id uuid,
  _game_id text,
  _period public.leaderboard_period,
  _period_start date,
  _score integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leaderboard_scores (
    user_id,
    game_id,
    period,
    period_start,
    score,
    created_at,
    updated_at
  ) values (
    _user_id,
    _game_id,
    _period,
    _period_start,
    _score,
    now(),
    now()
  )
  on conflict (game_id, period, period_start, user_id)
  do update set
    score = excluded.score,
    updated_at = now()
  where excluded.score > public.leaderboard_scores.score;
end;
$$;

-- Record a score across all periods for the current user
create or replace function public.record_leaderboard_score(
  game_id text,
  score integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  day_start date := date_trunc('day', now())::date;
  week_start date := date_trunc('week', now())::date;
  month_start date := date_trunc('month', now())::date;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  perform public.upsert_leaderboard_score(uid, game_id, 'all_time', date '1970-01-01', score);
  perform public.upsert_leaderboard_score(uid, game_id, 'daily', day_start, score);
  perform public.upsert_leaderboard_score(uid, game_id, 'weekly', week_start, score);
  perform public.upsert_leaderboard_score(uid, game_id, 'monthly', month_start, score);
end;
$$;

-- Atomically apply a trusted session commit prepared by the route.
-- Assumptions:
-- - player_state.settings.processedSessionMutationIds is a JSON array of text ids.
-- - challenge_progress_payload matches the route's validated challenge update objects.
-- - the caller has already ensured the user's profile row exists so FK-backed inserts can succeed.
create or replace function public.commit_trusted_game_session(
  _user_id uuid,
  _game_id text,
  _score integer,
  _reward_awarded integer,
  _achievement_ids text[],
  _next_games_played integer,
  _next_total_play_time integer,
  _next_stats jsonb,
  _next_settings jsonb,
  _challenge_progress_payload jsonb default '[]'::jsonb,
  _client_mutation_id text default null
) returns table (
  balance integer,
  reward_awarded integer,
  duplicate boolean,
  achievement_ids text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_current_player_state public.player_state%rowtype;
  v_current_wallet public.wallets%rowtype;
  v_mutation_id text := nullif(btrim(_client_mutation_id), '');
  v_existing_mutation_ids text[] := '{}'::text[];
  v_next_settings jsonb;
  v_normalized_achievement_ids text[] := '{}'::text[];
  v_inserted_achievement_ids text[] := '{}'::text[];
  v_updated_balance integer := 0;
  v_challenge_payload jsonb;
  v_challenge_row record;
begin
  if _user_id is null then
    raise exception 'user id is required.';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from _user_id then
    raise exception 'Not authorized to commit this session.';
  end if;

  if _game_id is null or btrim(_game_id) = '' then
    raise exception 'game id is required.';
  end if;

  if _reward_awarded is null or _reward_awarded < 0 then
    raise exception 'reward awarded must be a non-negative integer.';
  end if;

  if _next_games_played is null then
    raise exception 'next games_played is required.';
  end if;

  if _next_total_play_time is null then
    raise exception 'next total_play_time is required.';
  end if;

  if _next_stats is null then
    raise exception 'next stats are required.';
  end if;

  if _next_settings is null then
    raise exception 'next settings are required.';
  end if;

  insert into public.player_state (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;

  insert into public.wallets (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_current_player_state
  from public.player_state
  where user_id = _user_id
  for update;

  if not found then
    raise exception 'Player state not found for trusted session commit.';
  end if;

  select *
  into v_current_wallet
  from public.wallets
  where user_id = _user_id
  for update;

  if not found then
    raise exception 'Wallet not found for trusted session commit.';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
  into v_existing_mutation_ids
  from jsonb_array_elements_text(
    coalesce(v_current_player_state.settings -> 'processedSessionMutationIds', '[]'::jsonb)
  ) as t(value);

  if v_mutation_id is not null and v_mutation_id = any(v_existing_mutation_ids) then
    return query
    select
      v_current_wallet.balance,
      0,
      true,
      '{}'::text[];
    return;
  end if;

  v_next_settings := coalesce(_next_settings, v_current_player_state.settings, '{}'::jsonb);

  if v_mutation_id is not null then
    if jsonb_typeof(v_next_settings -> 'processedSessionMutationIds') = 'array' then
      select coalesce(array_agg(value), '{}'::text[])
      into v_existing_mutation_ids
      from jsonb_array_elements_text(v_next_settings -> 'processedSessionMutationIds') as t(value);
    else
      v_existing_mutation_ids := '{}'::text[];
    end if;

    v_existing_mutation_ids := array_remove(v_existing_mutation_ids, v_mutation_id);
    v_existing_mutation_ids := array_append(v_existing_mutation_ids, v_mutation_id);

    if coalesce(array_length(v_existing_mutation_ids, 1), 0) > 100 then
      v_existing_mutation_ids := v_existing_mutation_ids[
        array_length(v_existing_mutation_ids, 1) - 99 : array_length(v_existing_mutation_ids, 1)
      ];
    end if;

    v_next_settings := jsonb_set(
      v_next_settings,
      '{processedSessionMutationIds}',
      to_jsonb(v_existing_mutation_ids),
      true
    );
  end if;

  if coalesce(array_length(_achievement_ids, 1), 0) > 0 then
    select coalesce(array_agg(achievement_id order by achievement_id), '{}'::text[])
    into v_normalized_achievement_ids
    from (
      select distinct achievement_id
      from unnest(_achievement_ids) as t(achievement_id)
      where achievement_id is not null and btrim(achievement_id) <> ''
    ) distinct_achievement_ids;
  end if;

  if coalesce(array_length(v_normalized_achievement_ids, 1), 0) > 0 then
    with inserted_achievements as (
      insert into public.achievements (
        user_id,
        achievement_id,
        progress,
        unlocked_at,
        updated_at
      )
      select
        _user_id,
        achievement_id,
        null,
        v_now,
        v_now
      from unnest(v_normalized_achievement_ids) as t(achievement_id)
      on conflict (user_id, achievement_id) do nothing
      returning achievement_id
    )
    select coalesce(array_agg(achievement_id order by achievement_id), '{}'::text[])
    into v_inserted_achievement_ids
    from inserted_achievements;
  end if;

  v_challenge_payload := case
    when jsonb_typeof(_challenge_progress_payload) = 'object' then jsonb_build_array(_challenge_progress_payload)
    when jsonb_typeof(_challenge_progress_payload) = 'array' then coalesce(_challenge_progress_payload, '[]'::jsonb)
    else '[]'::jsonb
  end;

  for v_challenge_row in
    select distinct on (challenge_id)
      challenge_id,
      title,
      description,
      type_text,
      game_id,
      target,
      progress,
      reward,
      completed,
      expires_at
    from (
      select
        nullif(btrim(coalesce(item ->> 'challengeId', item ->> 'challenge_id')), '') as challenge_id,
        coalesce(item ->> 'title', '') as title,
        coalesce(item ->> 'description', '') as description,
        coalesce(item ->> 'type', item ->> 'challenge_type') as type_text,
        nullif(btrim(coalesce(item ->> 'gameId', item ->> 'game_id')), '') as game_id,
        (coalesce(item ->> 'target', '0'))::integer as target,
        (coalesce(item ->> 'progress', '0'))::integer as progress,
        (coalesce(item ->> 'reward', '0'))::integer as reward,
        coalesce((item ->> 'completed')::boolean, false) as completed,
        coalesce((item ->> 'expiresAt')::timestamptz, (item ->> 'expires_at')::timestamptz) as expires_at,
        ord
      from jsonb_array_elements(v_challenge_payload) with ordinality as payload(item, ord)
    ) challenge_updates
    where challenge_id is not null
    order by challenge_id, ord desc
  loop
    insert into public.challenge_assignments (
      user_id,
      challenge_id,
      title,
      description,
      type,
      game_id,
      target,
      progress,
      reward,
      completed_at,
      expires_at,
      updated_at
    ) values (
      _user_id,
      v_challenge_row.challenge_id,
      v_challenge_row.title,
      v_challenge_row.description,
      v_challenge_row.type_text::public.challenge_type,
      v_challenge_row.game_id,
      v_challenge_row.target,
      least(v_challenge_row.progress, v_challenge_row.target),
      v_challenge_row.reward,
      case
        when v_challenge_row.completed or v_challenge_row.progress >= v_challenge_row.target then v_now
        else null
      end,
      v_challenge_row.expires_at,
      v_now
    )
    on conflict (user_id, challenge_id) do update set
      title = excluded.title,
      description = excluded.description,
      type = excluded.type,
      game_id = excluded.game_id,
      target = excluded.target,
      progress = greatest(public.challenge_assignments.progress, excluded.progress),
      reward = excluded.reward,
      completed_at = coalesce(public.challenge_assignments.completed_at, excluded.completed_at),
      expires_at = excluded.expires_at,
      updated_at = v_now;
  end loop;

  update public.player_state
  set
    games_played = _next_games_played,
    total_play_time = _next_total_play_time,
    stats = _next_stats,
    settings = v_next_settings,
    last_active_at = v_now,
    updated_at = v_now
  where user_id = _user_id;

  if not found then
    raise exception 'Failed to update player state.';
  end if;

  update public.wallets as wallets
  set
    balance = wallets.balance + _reward_awarded,
    lifetime_earned = wallets.lifetime_earned + _reward_awarded,
    updated_at = v_now
  where user_id = _user_id
  returning wallets.balance into v_updated_balance;

  if not found then
    raise exception 'Failed to update wallet.';
  end if;

  perform public.upsert_leaderboard_score(_user_id, _game_id, 'all_time', date '1970-01-01', _score);
  perform public.upsert_leaderboard_score(_user_id, _game_id, 'daily', date_trunc('day', v_now)::date, _score);
  perform public.upsert_leaderboard_score(_user_id, _game_id, 'weekly', date_trunc('week', v_now)::date, _score);
  perform public.upsert_leaderboard_score(_user_id, _game_id, 'monthly', date_trunc('month', v_now)::date, _score);

  return query
  select
    v_updated_balance,
    _reward_awarded,
    false,
    v_inserted_achievement_ids;
end;
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.wallets enable row level security;
alter table public.achievements enable row level security;
alter table public.challenge_assignments enable row level security;
alter table public.leaderboard_scores enable row level security;

-- Profiles policies
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Player state policies
drop policy if exists "player_state_own" on public.player_state;
create policy "player_state_own" on public.player_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Wallet policies
drop policy if exists "wallets_upsert_own" on public.wallets;
create policy "wallets_upsert_own" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Achievements policies
drop policy if exists "achievements_upsert_own" on public.achievements;
create policy "achievements_upsert_own" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Challenges policies
drop policy if exists "challenge_assignments_own" on public.challenge_assignments;
create policy "challenge_assignments_own" on public.challenge_assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Leaderboards policies
drop policy if exists "leaderboard_scores_select_public" on public.leaderboard_scores;
create policy "leaderboard_scores_select_public" on public.leaderboard_scores
  for select using (true);

drop policy if exists "leaderboard_scores_modify_own" on public.leaderboard_scores;
create policy "leaderboard_scores_modify_own" on public.leaderboard_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
