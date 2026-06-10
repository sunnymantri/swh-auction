-- =====================================================================
--  Cricket Auction App  •  0019_season_dates_and_vacation_dates.sql
--  Adds season start/end dates to auctions, and replaces the integer
--  weeks_away on players with a JSONB array of specific Sunday dates.
-- =====================================================================

-- Season period on the auction config
alter table public.auctions
  add column if not exists season_start_date date,
  add column if not exists season_end_date date;

-- Replace simple integer with array of specific dates the player is away
alter table public.players
  add column if not exists vacation_dates jsonb not null default '[]'::jsonb;

comment on column public.auctions.season_start_date is 'First Sunday of the season';
comment on column public.auctions.season_end_date is 'Last Sunday of the season';
comment on column public.players.vacation_dates is 'JSON array of ISO date strings (Sundays) the player will be unavailable';
