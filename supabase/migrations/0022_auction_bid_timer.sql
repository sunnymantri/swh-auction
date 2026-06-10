-- =====================================================================
--  Cricket Auction App  •  0022_auction_bid_timer.sql
--  Add configurable bid timer (countdown seconds per player auction).
-- =====================================================================

alter table public.auctions
  add column if not exists bid_timer_seconds int not null default 15;
