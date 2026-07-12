-- Launch security hardening for existing projects. Apply after 001 and 002.

-- Browser clients may read their private state, but all authoritative progression
-- mutations are performed by the server route with the service role.
drop policy if exists "player_state_own" on public.player_state;
drop policy if exists "player_state_select_own" on public.player_state;
create policy "player_state_select_own" on public.player_state
  for select using (auth.uid() = user_id);

drop policy if exists "wallets_upsert_own" on public.wallets;
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets
  for select using (auth.uid() = user_id);

drop policy if exists "achievements_upsert_own" on public.achievements;
drop policy if exists "achievements_select_own" on public.achievements;
create policy "achievements_select_own" on public.achievements
  for select using (auth.uid() = user_id);

drop policy if exists "challenge_assignments_own" on public.challenge_assignments;
drop policy if exists "challenge_assignments_select_own" on public.challenge_assignments;
create policy "challenge_assignments_select_own" on public.challenge_assignments
  for select using (auth.uid() = user_id);

drop policy if exists "leaderboard_scores_modify_own" on public.leaderboard_scores;

create or replace function public.claim_trusted_challenge(
  _user_id uuid, _challenge_id text, _reward integer
) returns table (balance integer, reward_awarded integer, already_claimed boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_challenge public.challenge_assignments%rowtype;
  v_balance integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required.'; end if;
  if _reward < 0 then raise exception 'Reward must be non-negative.'; end if;

  select * into v_challenge from public.challenge_assignments
  where user_id = _user_id and challenge_id = _challenge_id for update;
  if not found then raise exception 'Challenge assignment not found.'; end if;
  if v_challenge.progress < v_challenge.target then raise exception 'Challenge target not met.'; end if;

  select wallets.balance into v_balance from public.wallets
  where user_id = _user_id for update;
  if not found then raise exception 'Wallet not found.'; end if;

  if v_challenge.completed_at is not null then
    return query select v_balance, 0, true;
    return;
  end if;

  update public.challenge_assignments set completed_at = now(), updated_at = now()
  where user_id = _user_id and challenge_id = _challenge_id;
  update public.wallets set balance = wallets.balance + _reward,
    lifetime_earned = wallets.lifetime_earned + _reward, updated_at = now()
  where user_id = _user_id returning wallets.balance into v_balance;
  return query select v_balance, _reward, false;
end;
$$;

create or replace function public.apply_trusted_unlock_purchase(
  _user_id uuid, _cost integer, _unlocked_tiers integer[], _unlocked_games text[]
) returns table (balance integer, unlocked_tiers integer[], unlocked_games text[])
language plpgsql security definer set search_path = public
as $$
declare
  v_balance integer;
  v_current_tiers integer[];
  v_current_games text[];
  v_added_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required.'; end if;
  if _cost < 0 then raise exception 'Cost must be non-negative.'; end if;
  select wallets.balance into v_balance from public.wallets
  where user_id = _user_id for update;
  if not found then raise exception 'Wallet not found.'; end if;
  if v_balance < _cost then raise exception 'Insufficient balance.'; end if;
  select coalesce(unlocked_tiers, '{}'), coalesce(unlocked_games, '{}')
  into v_current_tiers, v_current_games
  from public.player_state where user_id = _user_id for update;
  if not found then raise exception 'Player state not found.'; end if;

  if not (v_current_tiers <@ coalesce(_unlocked_tiers, '{}'))
    or not (v_current_games <@ coalesce(_unlocked_games, '{}')) then
    raise exception 'Unlock state changed concurrently.';
  end if;

  v_added_count :=
    cardinality(array(select unnest(coalesce(_unlocked_tiers, '{}')) except select unnest(v_current_tiers))) +
    cardinality(array(select unnest(coalesce(_unlocked_games, '{}')) except select unnest(v_current_games)));
  if v_added_count = 0 then
    return query select v_balance, v_current_tiers, v_current_games;
    return;
  end if;
  if v_added_count <> 1 then raise exception 'Exactly one unlock may be purchased.'; end if;

  update public.wallets set balance = wallets.balance - _cost, updated_at = now()
  where user_id = _user_id returning wallets.balance into v_balance;
  update public.player_state set unlocked_tiers = _unlocked_tiers,
    unlocked_games = _unlocked_games, updated_at = now() where user_id = _user_id;
  return query select v_balance, _unlocked_tiers, _unlocked_games;
end;
$$;

-- SECURITY DEFINER routines default to PUBLIC execute in PostgreSQL. Remove that
-- default explicitly and expose these server-only primitives only to service_role.
revoke all on function public.upsert_leaderboard_score(uuid, text, public.leaderboard_period, date, integer) from public, anon, authenticated;
revoke all on function public.record_leaderboard_score(text, integer) from public, anon, authenticated;
revoke all on function public.commit_trusted_game_session(uuid, text, integer, integer, text[], integer, integer, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.claim_trusted_challenge(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.apply_trusted_unlock_purchase(uuid, integer, integer[], text[]) from public, anon, authenticated;
grant execute on function public.upsert_leaderboard_score(uuid, text, public.leaderboard_period, date, integer) to service_role;
grant execute on function public.commit_trusted_game_session(uuid, text, integer, integer, text[], integer, integer, jsonb, jsonb, jsonb, text) to service_role;
grant execute on function public.claim_trusted_challenge(uuid, text, integer) to service_role;
grant execute on function public.apply_trusted_unlock_purchase(uuid, integer, integer[], text[]) to service_role;
