-- =====================================================================
--  Cricket Auction App  •  0018_player_vacation_field.sql
--  Adds weeks_away column so players can declare vacation unavailability.
-- =====================================================================

alter table public.players
  add column if not exists weeks_away int not null default 0;

comment on column public.players.weeks_away is 'Number of weeks the player will be unavailable during the season';
