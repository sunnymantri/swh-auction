-- =====================================================================
--  Cricket Auction App  •  0035_finalize_and_pii.sql
--
--  (a) AUD-006 — server-authoritative timer finalization.
--      finalize_current_if_expired(p_auction_id) is callable by any
--      authenticated user. It only acts when the current queue row's
--      deadline has genuinely passed. The FOR UPDATE lock makes
--      concurrent callers idempotent: first caller wins, the rest find
--      status <> 'current' and return 'no_current'.
--
--  (b) AUD-007 — narrow anon read access on public.teams.
--      Removes owner_email / owner_name from what anonymous callers
--      can read. Authenticated users (team owners, admins) retain full
--      table access. team_summary already dropped those columns in 0033.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (a) finalize_current_if_expired
-- ---------------------------------------------------------------------
create or replace function public.finalize_current_if_expired(p_auction_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_q      public.auction_queue%rowtype;
  v_high   bigint;
  v_team   uuid;
  v_caller uuid;
begin
  select * into v_q
  from public.auction_queue
  where auction_id = p_auction_id and status = 'current'
  for update;

  if not found                                               then return 'no_current';  end if;
  if v_q.clock_paused                                        then return 'paused';       end if;
  if v_q.current_bid_deadline is null
     or v_q.current_bid_deadline > now()                    then return 'not_expired';  end if;

  select id into v_caller from public.profiles where user_id = auth.uid();

  select bid_amount, team_id into v_high, v_team
  from public.bids
  where player_id = v_q.player_id
  order by bid_amount desc, created_at desc
  limit 1;

  if v_high is not null then
    -- sold_players_recalc trigger (0004) handles points_spent / points_remaining
    insert into public.sold_players(auction_id, player_id, team_id, sold_price)
    values (p_auction_id, v_q.player_id, v_team, v_high);

    update public.players
       set status = 'sold'
     where id = v_q.player_id;

    update public.auction_queue
       set status = 'completed', current_bid_deadline = null
     where id = v_q.id;

    insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, created_by)
    values (p_auction_id, v_q.player_id, 'sold', v_team, v_high, v_caller);

    return 'sold';
  else
    update public.players
       set status = 'unsold'
     where id = v_q.player_id;

    update public.auction_queue
       set status = 'skipped', current_bid_deadline = null
     where id = v_q.id;

    insert into public.auction_events(auction_id, player_id, event_type, created_by)
    values (p_auction_id, v_q.player_id, 'unsold', v_caller);

    return 'unsold';
  end if;
end; $$;

revoke all on function public.finalize_current_if_expired(uuid) from public;
grant execute on function public.finalize_current_if_expired(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- (b) Narrow anon column access on teams — hide owner contact details.
--     authenticated retains full access via default table grant.
-- ---------------------------------------------------------------------
revoke select on public.teams from anon;
grant select (
  id, auction_id, name, short_name, logo_url,
  total_budget, points_spent, points_remaining, max_players,
  owner_user_id
) on public.teams to anon;
