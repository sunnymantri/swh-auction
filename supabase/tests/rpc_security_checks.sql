-- Basic SQL regression checks for security hardening.
-- Run manually in Supabase SQL editor after migrations.

-- 1) Queue has at most one current player per auction.
select auction_id, count(*) as current_count
from public.auction_queue
where status = 'current'
group by auction_id
having count(*) > 1;

-- 2) Active sale uniqueness (player cannot be sold twice concurrently).
select auction_id, player_id, count(*) as sale_count
from public.sold_players
where reauctioned = false
group by auction_id, player_id
having count(*) > 1;

