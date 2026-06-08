-- =====================================================================
--  Cricket Auction App  •  0011_player_points_fields.sql
--  Adds missing stats columns needed for the PPM base-points formula:
--  Batting: fifties, hundreds, sixes
--  Bowling: dot_balls, three_wicket_hauls, five_wicket_hauls
--  Fielding: run_outs, stumpings
-- =====================================================================

-- Batting milestones
alter table public.players
  add column if not exists fifties   int default 0;
alter table public.players
  add column if not exists hundreds  int default 0;
alter table public.players
  add column if not exists sixes     int default 0;

-- Bowling pressure stats
alter table public.players
  add column if not exists dot_balls            int default 0;
alter table public.players
  add column if not exists three_wicket_hauls   int default 0;
alter table public.players
  add column if not exists five_wicket_hauls    int default 0;

-- Fielding extras
alter table public.players
  add column if not exists run_outs    int default 0;
alter table public.players
  add column if not exists stumpings   int default 0;

comment on column public.players.fifties             is 'Number of half-centuries scored';
comment on column public.players.hundreds            is 'Number of centuries scored';
comment on column public.players.sixes               is 'Total sixes hit';
comment on column public.players.dot_balls           is 'Total dot balls bowled';
comment on column public.players.three_wicket_hauls  is 'Number of 3-wicket hauls';
comment on column public.players.five_wicket_hauls   is 'Number of 5-wicket hauls';
comment on column public.players.run_outs            is 'Total run outs effected';
comment on column public.players.stumpings           is 'Total stumpings (keeper)';
