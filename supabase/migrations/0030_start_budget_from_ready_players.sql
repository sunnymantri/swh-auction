-- =====================================================================
--  Cricket Auction App  •  0030_start_budget_from_ready_players.sql
--  Ensure team starting budgets are derived from the ready player pool:
--  (sum ready_for_auction base_price * budget_multiplier) / team_count
-- =====================================================================

create or replace function public.compute_starting_team_budget(p_auction_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool_base_price bigint;
  v_multiplier numeric;
  v_team_count int;
begin
  select coalesce(sum(base_price), 0)::bigint
  into v_pool_base_price
  from public.players
  where auction_id = p_auction_id
    and status = 'ready_for_auction';

  select coalesce(budget_multiplier, 1)
  into v_multiplier
  from public.auctions
  where id = p_auction_id;

  select count(*)
  into v_team_count
  from public.teams
  where auction_id = p_auction_id;

  if v_team_count <= 0 then
    return 0;
  end if;

  return floor((v_pool_base_price::numeric * v_multiplier) / v_team_count)::bigint;
end;
$$;

create or replace function public.reset_auction(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_budget bigint;
begin
  perform public.require_admin();

  delete from public.bids where auction_id = p_auction_id;
  delete from public.sold_players where auction_id = p_auction_id;
  delete from public.auction_events where auction_id = p_auction_id;
  delete from public.auction_queue where auction_id = p_auction_id;

  update public.players
  set status = case
    when status = 'not_registered' then 'not_registered'
    when status = 'registered' then 'registered'
    else 'ready_for_auction'
  end
  where auction_id = p_auction_id;

  v_start_budget := public.compute_starting_team_budget(p_auction_id);

  update public.teams
  set total_budget = v_start_budget,
      points_spent = 0,
      points_remaining = v_start_budget
  where auction_id = p_auction_id;
end;
$$;
