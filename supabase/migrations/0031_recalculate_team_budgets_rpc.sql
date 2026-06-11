-- =====================================================================
--  Cricket Auction App  •  0031_recalculate_team_budgets_rpc.sql
--  Admin RPC to recalculate all team budgets using ready player pool:
--  (sum ready_for_auction base_price * budget_multiplier) / team_count
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
      points_spent = 0,
      points_remaining = v_start_budget
  where auction_id = p_auction_id;

  return v_start_budget;
end;
$$;

revoke all on function public.recalculate_team_budgets(uuid) from public;
grant execute on function public.recalculate_team_budgets(uuid) to authenticated;
