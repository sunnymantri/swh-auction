-- =====================================================================
--  Cricket Auction App  •  0005_realtime.sql
--  Add tables to the Supabase realtime publication so the Auction
--  Centre, team bidding screen and public live view update instantly.
-- =====================================================================

-- The supabase_realtime publication ships with every Supabase project.
alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.auction_events;
alter publication supabase_realtime add table public.sold_players;
alter publication supabase_realtime add table public.auction_queue;

-- REPLICA IDENTITY FULL => UPDATE/DELETE realtime payloads include the
-- full OLD row (needed to reconcile budget changes client-side).
alter table public.teams        replica identity full;
alter table public.players      replica identity full;
alter table public.auction_queue replica identity full;
alter table public.sold_players replica identity full;
