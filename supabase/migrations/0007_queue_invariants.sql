-- =====================================================================
--  Cricket Auction App  •  0007_queue_invariants.sql
--  Queue integrity constraints and helper checks.
-- =====================================================================

create unique index if not exists uq_auction_single_current
  on public.auction_queue (auction_id)
  where status = 'current';

create unique index if not exists uq_team_single_active_sale_per_player
  on public.sold_players (auction_id, player_id)
  where reauctioned = false;

