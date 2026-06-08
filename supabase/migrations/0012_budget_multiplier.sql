-- =====================================================================
--  Cricket Auction App  •  0012_budget_multiplier.sql
--  Adds budget_multiplier to auctions for team budget calculation.
--  Formula: team_budget = (sum of approved players base_price) × multiplier / num_teams
-- =====================================================================

alter table public.auctions
  add column if not exists budget_multiplier numeric(4,2) not null default 1.60;

comment on column public.auctions.budget_multiplier is 'Multiplier factor for calculating team budgets from total player base prices';
