-- Ensure only auction-eligible players can be set as current.

create or replace function public.start_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_auction_id     uuid;
  v_player_status  text;
  v_current_player uuid;
  v_caller         uuid;
  v_timer_seconds  int;
begin
  perform public.require_admin();
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id, status into v_auction_id, v_player_status from public.players where id = p_player_id;
  if v_auction_id is null then
    raise exception 'PLAYER_NOT_FOUND: %', p_player_id;
  end if;
  if v_player_status not in ('ready_for_auction', 'reauction') then
    raise exception 'STATE_REJECTED: player status % is not eligible to start; set Ready for auction or Re-auction first', v_player_status;
  end if;
  if exists (
    select 1 from public.sold_players
    where player_id = p_player_id and reauctioned = false
  ) then
    raise exception 'QUEUE_STATE_REJECTED: player already has an active sale; use re-auction first';
  end if;

  select player_id into v_current_player
  from public.auction_queue
  where auction_id = v_auction_id and status = 'current';

  if v_current_player is not null then
    update public.players set status = 'ready_for_auction'
    where id = v_current_player and status = 'in_auction';
  end if;

  update public.auction_queue
  set status = 'completed',
      current_bid_deadline = null,
      clock_paused = false,
      paused_remaining_seconds = null
  where auction_id = v_auction_id and status = 'current';

  update public.players set status = 'in_auction' where id = p_player_id;

  update public.auction_queue
  set status = 'current',
      clock_paused = false,
      paused_remaining_seconds = null
  where auction_id = v_auction_id and player_id = p_player_id
    and status in ('pending', 'reauction', 'skipped', 'completed');

  if not found then
    raise exception 'QUEUE_STATE_REJECTED: player is not eligible to be set as current';
  end if;

  select greatest(coalesce(initial_bid_timer_seconds, 90), 1)
  into v_timer_seconds
  from public.auctions
  where id = v_auction_id;

  update public.auction_queue
  set current_bid_deadline = now() + make_interval(secs => v_timer_seconds)
  where auction_id = v_auction_id and player_id = p_player_id and status = 'current';

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'player_started', v_caller);
end; $$;
