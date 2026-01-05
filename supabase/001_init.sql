-- Base schema for Hacktivate Arcade persistence.
-- Apply in the Supabase SQL editor or via: supabase db push
-- NOTE: This script resets the arcade tables for a clean alpha state.

create extension if not exists "pgcrypto";

-- Drop dependent objects first for clean rebuilds.
drop view if exists public.leaderboards_view;
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
