-- =====================================================================
--  Cricket Auction App  •  0014_backfill_base_price_from_points.sql
--  Recompute base_price from player stats using the app formula:
--  base_price = roundToNearest100(total_points * 10)
-- =====================================================================

update public.players
set base_price = (
  round((
    (
      -- Batting points
      coalesce(runs, 0)::numeric +
      coalesce(bat_avg, 0)::numeric * 10 +
      coalesce(strike_rate, 0)::numeric * 2 +
      coalesce(fifties, 0)::numeric * 25 +
      coalesce(hundreds, 0)::numeric * 50 +
      coalesce(sixes, 0)::numeric * 2 +
      -- Bowling points
      coalesce(wickets, 0)::numeric * 25 +
      (case when coalesce(economy, 0)::numeric > 0 then 100 / coalesce(economy, 0)::numeric else 0 end) +
      coalesce(dot_balls, 0)::numeric +
      coalesce(three_wicket_hauls, 0)::numeric * 25 +
      coalesce(five_wicket_hauls, 0)::numeric * 50 +
      -- Fielding points
      coalesce(catches, 0)::numeric * 10 +
      coalesce(run_outs, 0)::numeric * 15 +
      coalesce(stumpings, 0)::numeric * 15
    ) * 10
  ) / 100
) * 100
);
