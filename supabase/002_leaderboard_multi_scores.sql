-- Upgrade existing Supabase projects so leaderboards keep every score entry.
-- This is non-destructive: existing best-score rows remain, and future sessions append.

begin;

drop view if exists public.leaderboards_view;

drop index if exists public.leaderboard_scores_unique;
drop index if exists public.leaderboard_scores_rank;

create index leaderboard_scores_rank
  on public.leaderboard_scores (game_id, period, period_start, score desc, created_at asc, id asc);

create index if not exists leaderboard_scores_user_lookup
  on public.leaderboard_scores (user_id, game_id, period, period_start);

create or replace view public.leaderboards_view as
select
  ls.id,
  ls.game_id,
  ls.user_id,
  p.username,
  p.avatar,
  ls.score,
  row_number() over (
    partition by ls.game_id, ls.period, ls.period_start
    order by ls.score desc, ls.created_at asc, ls.id asc
  ) as rank,
  ls.period,
  ls.period_start,
  ls.created_at,
  ls.updated_at
from public.leaderboard_scores ls
join public.profiles p on p.id = ls.user_id;

-- Keep the old function name for app compatibility, but append instead of upserting.
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
  );
end;
$$;

commit;
