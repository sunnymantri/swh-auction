-- =====================================================================
--  Cricket Auction App  •  0010_random_queue_generation.sql
--  Updates generate_queue to randomize player order.
-- =====================================================================

create or replace function public.generate_queue(p_auction_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from public.auction_queue
  where auction_id = p_auction_id and status in ('pending','reauction','skipped');

  insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
  select p.auction_id, p.id, p.category,
         row_number() over (order by random()),
         'pending'
  from public.players p
  where p.auction_id = p_auction_id
    and p.status in ('approved','reauction','unsold')
  on conflict (auction_id, player_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;
