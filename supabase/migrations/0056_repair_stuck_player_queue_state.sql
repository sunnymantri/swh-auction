-- Repair stuck player/queue states caused by prior workflow drift.
-- Goals:
-- 1) Move orphaned in_auction players back to ready_for_auction.
-- 2) Ensure ready/reauction players always have a queue row.

-- 1) Players marked in_auction but not actually current are considered orphaned.
update public.players p
set status = 'ready_for_auction'
where p.status = 'in_auction'
  and not exists (
    select 1
    from public.auction_queue q
    where q.auction_id = p.auction_id
      and q.player_id = p.id
      and q.status = 'current'
  )
  and not exists (
    select 1
    from public.sold_players sp
    where sp.player_id = p.id
      and sp.reauctioned = false
  );

-- 2) Insert missing queue rows for eligible players.
with missing as (
  select
    p.auction_id,
    p.id as player_id,
    p.category,
    p.status,
    row_number() over (partition by p.auction_id order by p.name, p.id) as seq
  from public.players p
  where p.status in ('ready_for_auction', 'reauction')
    and not exists (
      select 1
      from public.sold_players sp
      where sp.player_id = p.id
        and sp.reauctioned = false
    )
    and not exists (
      select 1
      from public.auction_queue q
      where q.auction_id = p.auction_id
        and q.player_id = p.id
    )
),
mx as (
  select auction_id, coalesce(max(queue_order), 0) as max_order
  from public.auction_queue
  group by auction_id
)
insert into public.auction_queue (auction_id, player_id, category, queue_order, status)
select
  m.auction_id,
  m.player_id,
  m.category,
  coalesce(mx.max_order, 0) + m.seq,
  case when m.status = 'reauction' then 'reauction' else 'pending' end
from missing m
left join mx on mx.auction_id = m.auction_id
on conflict (auction_id, player_id) do nothing;
