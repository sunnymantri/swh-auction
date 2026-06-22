-- Allow reset_auction to move sold players back to ready_for_auction safely,
-- and regenerate queue as part of reset.

create or replace function public.trg_guard_sold_ready_transition()
returns trigger
language plpgsql
as $$
begin
  -- Internal maintenance paths (e.g., reset_auction) can bypass this guard.
  if current_setting('app.bypass_sold_ready_guard', true) = 'on' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'sold'
     and new.status = 'ready_for_auction' then
    raise exception 'STATE_REJECTED: sold player must be moved via re-auction workflow';
  end if;
  return new;
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

  perform set_config('app.bypass_sold_ready_guard', 'on', true);
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

  -- Rebuild queue immediately so players return to the ready queue on reset.
  perform public.generate_queue(p_auction_id);
end;
$$;
