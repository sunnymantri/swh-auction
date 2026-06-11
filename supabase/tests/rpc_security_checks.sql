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

-- 3) Direct table insert to bids should be blocked (RPC-only write path).
-- This block succeeds only if INSERT is rejected.
do $$
declare
  v_auction_id uuid;
  v_player_id uuid;
  v_team_id uuid;
begin
  select id into v_auction_id from public.auctions order by created_at desc limit 1;
  select id into v_player_id from public.players where auction_id = v_auction_id order by created_at desc limit 1;
  select id into v_team_id from public.teams where auction_id = v_auction_id order by created_at desc limit 1;

  if v_auction_id is null or v_player_id is null or v_team_id is null then
    raise notice 'Skipping direct-insert test (seed data missing).';
    return;
  end if;

  begin
    insert into public.bids(auction_id, player_id, team_id, bid_amount, bid_type)
    values (v_auction_id, v_player_id, v_team_id, 100, 'team_bid');
    raise exception 'SECURITY_REGRESSION: direct bids insert unexpectedly succeeded';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct bids insert rejected (insufficient_privilege).';
    when others then
      if position('row-level security' in lower(sqlerrm)) > 0 then
        raise notice 'PASS: direct bids insert rejected by RLS.';
      else
        raise;
      end if;
  end;
end $$;

