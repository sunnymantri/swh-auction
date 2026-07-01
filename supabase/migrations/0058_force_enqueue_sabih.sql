-- Force repair for Sabih records stuck out of queue.
-- This is intentionally targeted to unblock live operation.

do $$
declare
  r record;
  v_next_order int;
begin
  perform set_config('app.bypass_sold_ready_guard', 'on', true);

  for r in
    select p.*
    from public.players p
    where lower(p.name) like 'sabih%'
  loop
    -- If there is an active sale row blocking queue eligibility, release it.
    update public.sold_players
    set reauctioned = true
    where player_id = r.id
      and reauctioned = false;

    -- Move player back to ready state if not currently on the block.
    if not exists (
      select 1
      from public.auction_queue q
      where q.auction_id = r.auction_id
        and q.player_id = r.id
        and q.status = 'current'
    ) then
      update public.players
      set status = 'ready_for_auction'
      where id = r.id;
    end if;

    -- Ensure queue row exists.
    if not exists (
      select 1
      from public.auction_queue q
      where q.auction_id = r.auction_id
        and q.player_id = r.id
    ) then
      select coalesce(max(queue_order), 0) + 1
      into v_next_order
      from public.auction_queue
      where auction_id = r.auction_id;

      insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
      values (r.auction_id, r.id, r.category, v_next_order, 'pending')
      on conflict (auction_id, player_id) do nothing;
    else
      update public.auction_queue
      set status = 'pending'
      where auction_id = r.auction_id
        and player_id = r.id
        and status <> 'current';
    end if;
  end loop;
end $$;
