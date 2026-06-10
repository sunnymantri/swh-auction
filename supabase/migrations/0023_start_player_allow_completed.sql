-- =====================================================================
--  Cricket Auction App  •  0023_start_player_allow_completed.sql
--  Allow admin to re-start a completed queue entry (e.g. re-auction
--  a player directly from the queue without going through unsold flow).
-- =====================================================================

create or replace function public.start_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_auction_id uuid;
  v_current_player uuid;
  v_caller uuid;
begin
  perform public.require_admin();
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;
  if v_auction_id is null then
    raise exception 'PLAYER_NOT_FOUND: %', p_player_id;
  end if;

  select player_id into v_current_player
  from public.auction_queue
  where auction_id = v_auction_id and status = 'current';

  if v_current_player is not null then
    update public.players set status = 'ready_for_auction'
    where id = v_current_player and status = 'in_auction';
  end if;

  update public.auction_queue
     set status = 'completed'
   where auction_id = v_auction_id and status = 'current';

  update public.players set status = 'in_auction' where id = p_player_id;

  update public.auction_queue
     set status = 'current'
   where auction_id = v_auction_id and player_id = p_player_id
     and status in ('pending', 'reauction', 'skipped', 'completed');

  if not found then
    raise exception 'QUEUE_STATE_REJECTED: player is not eligible to be set as current';
  end if;

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'player_started', v_caller);
end; $$;
