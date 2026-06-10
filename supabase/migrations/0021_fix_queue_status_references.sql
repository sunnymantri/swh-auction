-- =====================================================================
--  Cricket Auction App  •  0021_fix_queue_status_references.sql
--  Fix generate_queue, start_player, and reset_auction to use
--  'ready_for_auction' instead of the old 'auction' status
--  (renamed in migration 0015 but functions were not updated).
-- =====================================================================

-- 1. generate_queue: include 'ready_for_auction' players, number after completed
create or replace function public.generate_queue(p_auction_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_max_order int;
begin
  perform public.require_admin();
  delete from public.auction_queue
  where auction_id = p_auction_id and status in ('pending','reauction','skipped');

  select coalesce(max(queue_order), 0) into v_max_order
  from public.auction_queue
  where auction_id = p_auction_id;

  insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
  select p.auction_id, p.id, p.category,
         v_max_order + row_number() over (order by random()),
         'pending'
  from public.players p
  where p.auction_id = p_auction_id
    and p.status in ('ready_for_auction','reauction','unsold')
  on conflict (auction_id, player_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- 2. start_player: revert bumped player to 'ready_for_auction'
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
     and status in ('pending', 'reauction', 'skipped');

  if not found then
    raise exception 'QUEUE_STATE_REJECTED: player is not eligible to be set as current';
  end if;

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'player_started', v_caller);
end; $$;

-- 3. reset_auction: reset players to 'ready_for_auction'
create or replace function public.reset_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();

  delete from public.bids where auction_id = p_auction_id;
  delete from public.sold_players where auction_id = p_auction_id;
  delete from public.auction_events where auction_id = p_auction_id;
  delete from public.auction_queue where auction_id = p_auction_id;

  update public.teams
  set points_remaining = total_budget
  where auction_id = p_auction_id;

  update public.players
  set status = case
    when status = 'registered' then 'registered'
    when status = 'not_registered' then 'not_registered'
    else 'ready_for_auction'
  end
  where auction_id = p_auction_id;
end; $$;
