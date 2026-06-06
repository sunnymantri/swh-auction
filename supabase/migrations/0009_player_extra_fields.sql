-- =====================================================================
--  Cricket Auction App  •  0009_player_extra_fields.sql
--  Extends the players table with profile statistics and registration
--  fields sourced from the CricHeroes / CricBattle import sheet.
-- =====================================================================

-- Player's sequential form/registration number from the sign-up sheet
alter table public.players
  add column if not exists player_no     int;

-- External profile URL (CricHeroes, play.cricket.com.au, lastmanstands, etc.)
alter table public.players
  add column if not exists profile_url   text;

-- Batting average (separate from strike_rate which tracks Bat S/R)
alter table public.players
  add column if not exists bat_avg       numeric(7,2) default 0;

-- Bowling average (separate from economy)
alter table public.players
  add column if not exists bowl_avg      numeric(7,2) default 0;

comment on column public.players.player_no   is 'Sequential registration/form number from the sign-up sheet';
comment on column public.players.profile_url is 'External stats profile URL (CricHeroes, play.cricket.com.au, etc.)';
comment on column public.players.bat_avg     is 'Batting average (runs per dismissal)';
comment on column public.players.bowl_avg    is 'Bowling average (runs conceded per wicket)';
