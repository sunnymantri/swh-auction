-- =====================================================================
--  Cricket Auction App  •  0013_auction_reset_and_status_alignment.sql
--  Add reset_auction RPC + align eligibility status to "auction".
-- =====================================================================

-- Migrate legacy status naming.
update public.players
set status = 'auction'
where status = 'approved';

alter table public.players
  drop constraint if exists players_status_check;

alter table public.players
  add constraint players_status_check
  check (status in ('registered','auction','in_auction','sold','unsold','reauction'));

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
    update public.players set status = 'auction'
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

create or replace function public.generate_queue(p_auction_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  perform public.require_admin();
  delete from public.auction_queue
  where auction_id = p_auction_id and status in ('pending','reauction','skipped');

  insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
  select p.auction_id, p.id, p.category,
         row_number() over (order by random()),
         'pending'
  from public.players p
  where p.auction_id = p_auction_id
    and p.status in ('auction','reauction','unsold')
  on conflict (auction_id, player_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

create or replace function public.reset_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();

  -- Remove all run-time auction outcomes for this auction.
  delete from public.bids where auction_id = p_auction_id;
  delete from public.sold_players where auction_id = p_auction_id;
  delete from public.auction_events where auction_id = p_auction_id;
  delete from public.auction_queue where auction_id = p_auction_id;

  -- Restore team budget state.
  update public.teams
  set points_remaining = total_budget
  where auction_id = p_auction_id;

  -- Keep registered players as-is; all other progressed statuses return to auction pool.
  update public.players
  set status = case
    when status = 'registered' then 'registered'
    else 'auction'
  end
  where auction_id = p_auction_id;
end; $$;

grant execute on function public.reset_auction(uuid) to authenticated;
