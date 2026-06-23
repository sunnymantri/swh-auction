-- Preserve retired players on auction reset.
--
-- reset_auction previously moved every player that wasn't 'not_registered'
-- or 'registered' back to 'ready_for_auction' (the catch-all else branch),
-- which swept retired players back into the auction pool. Retired is an
-- intentional opt-out, so a reset must leave it untouched — the player should
-- not return to 'ready_for_auction' nor be re-queued.
--
-- Only change is the addition of the 'retired' carve-out below; everything
-- else matches 0049 (queue rebuild already excludes retired players).

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
    when status = 'retired' then 'retired'
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
  -- generate_queue only enqueues ready_for_auction/reauction/unsold, so
  -- retired players are correctly left out.
  perform public.generate_queue(p_auction_id);
end;
$$;
