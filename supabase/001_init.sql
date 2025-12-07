-- Base schema for Hacktivate Arcade persistence.
-- Apply in the Supabase SQL editor or via: supabase db push

-- Ensure gen_random_uuid is available
create extension if not exists "pgcrypto";

-- Enum for leaderboard periods (works on Postgres versions without CREATE TYPE IF NOT EXISTS)
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'leaderboard_period'
      and n.nspname = 'public'
  ) then
    create type public.leaderboard_period as enum ('daily', 'weekly', 'monthly', 'all_time');
  end if;
end$$;

-- Profiles tied to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text,
  avatar_url text,
  country text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Wallet balances
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0,
  lifetime_earned integer not null default 0,
  updated_at timestamptz default now()
);

-- Achievements per user
create table if not exists public.achievements (
  user_id uuid references public.profiles(id) on delete cascade,
  achievement_id text not null,
  progress numeric,
  unlocked_at timestamptz,
  primary key (user_id, achievement_id)
);

-- Game sessions (drives leaderboards)
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  game_id text not null,
  score integer not null,
  duration_ms integer not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Leaderboard materialization (all-time for now)
create or replace view public.leaderboards_view as
select
  gs.game_id,
  gs.user_id,
  p.username,
  p.avatar_url,
  gs.score,
  rank() over (partition by gs.game_id order by gs.score desc) as rank,
  'all_time'::public.leaderboard_period as period,
  gs.created_at
from public.game_sessions gs
join public.profiles p on p.id = gs.user_id;

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.achievements enable row level security;
alter table public.game_sessions enable row level security;

-- RLS policies
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "wallets_upsert_own" on public.wallets;
create policy "wallets_upsert_own" on public.wallets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "achievements_upsert_own" on public.achievements;
create policy "achievements_upsert_own" on public.achievements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sessions_upsert_own" on public.game_sessions;
create policy "sessions_upsert_own" on public.game_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sessions_read_public" on public.game_sessions;
create policy "sessions_read_public" on public.game_sessions
for select using (true);
