-- =====================================================================
--  Cricket Auction App  •  0034_recalc_budgets_guard.sql
--
--  AUD-003: recalculate_team_budgets must be blocked once any active
--  sale exists, because the unauctioned player pool shrinks as the
--  auction runs and recalculating would silently increase budgets for
--  teams that have already spent points under the old budget.
--
--  Replaces the 0032 version (which had no guard) with one that raises
--  STATE_REJECTED if sold_players rows exist for this auction.
--  The UI (Auctions.jsx) also shows a confirm dialog before calling.
-- =====================================================================
create or replace function public.recalculate_team_budgets(p_auction_id uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_start_budget bigint;
  v_sales        int;
begin
  perform public.require_admin();

  select count(*) into v_sales
  from public.sold_players
  where auction_id = p_auction_id and reauctioned = false;

  if v_sales > 0 then
    raise exception
      'STATE_REJECTED: cannot recalculate budgets after sales exist (% active sale(s)). Reset the auction first.',
      v_sales;
  end if;

  v_start_budget := public.compute_starting_team_budget(p_auction_id);

  update public.teams
     set total_budget      = v_start_budget,
         points_spent      = 0,
         points_remaining  = v_start_budget
   where auction_id = p_auction_id;

  return v_start_budget;
end; $$;

revoke all on function public.recalculate_team_budgets(uuid) from public;
grant execute on function public.recalculate_team_budgets(uuid) to authenticated;
