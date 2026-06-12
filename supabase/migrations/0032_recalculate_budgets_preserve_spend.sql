-- =====================================================================
--  Cricket Auction App  •  0032_recalculate_budgets_preserve_spend.sql
--  Recalculate team budgets while preserving each team's existing spend.
-- =====================================================================

create or replace function public.recalculate_team_budgets(p_auction_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_budget bigint;
begin
  perform public.require_admin();

  v_start_budget := public.compute_starting_team_budget(p_auction_id);

  update public.teams
  set total_budget = v_start_budget,
      points_remaining = greatest(v_start_budget - points_spent, 0)
  where auction_id = p_auction_id;

  return v_start_budget;
end;
$$;
