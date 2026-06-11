-- =====================================================================
--  Cricket Auction App  •  0025_queue_generate_ready_unsold_fix.sql
--  Ensure generate_queue always includes ready_for_auction unsold players,
--  even if they already have historical completed queue rows.
-- =====================================================================

create or replace function public.generate_queue(p_auction_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_max_order int;
begin
  perform public.require_admin();

  -- Rebuild only mutable queue states; keep completed/current history.
  delete from public.auction_queue
  where auction_id = p_auction_id and status in ('pending', 'reauction', 'skipped');

  select coalesce(max(queue_order), 0) into v_max_order
  from public.auction_queue
  where auction_id = p_auction_id;

  insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
  select
    p.auction_id,
    p.id,
    p.category,
    v_max_order + row_number() over (order by random()),
    'pending'
  from public.players p
  where p.auction_id = p_auction_id
    and p.status = 'ready_for_auction'
    and not exists (
      select 1
      from public.sold_players sp
      where sp.player_id = p.id and sp.reauctioned = false
    )
  on conflict (auction_id, player_id)
  do update
    set category = excluded.category,
        queue_order = excluded.queue_order,
        status = 'pending'
  where public.auction_queue.status <> 'current';

  get diagnostics v_count = row_count;
  return v_count;
end; $$;
