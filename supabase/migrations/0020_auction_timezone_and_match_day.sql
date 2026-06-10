-- =====================================================================
--  Cricket Auction App  •  0020_auction_timezone_and_match_day.sql
--  Adds timezone and match_day to auctions for vacation form display.
-- =====================================================================

alter table public.auctions
  add column if not exists timezone text not null default 'Australia/Sydney',
  add column if not exists match_day text not null default 'Sunday';
