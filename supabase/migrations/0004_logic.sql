-- =====================================================================
--  Cricket Auction App  •  0004_logic.sql
--  Triggers, the team_summary view, and the RPC functions that the
--  React app calls.  ALL squad/budget rules live here so they cannot be
--  bypassed from the client and are race-safe under concurrent bidding.
-- =====================================================================

-- ---------------------------------------------------------------------
-- recalc_team_points: single source of truth for team spend.
--   points_spent  = sum of sold_price for sales that still "cost" the team.
--   A sale costs the team if it is active (reauctioned=false) OR it was
--   reauctioned but the auction has refunds DISABLED (points forfeited).
--   Active player COUNT only ever counts reauctioned=false rows.
-- ---------------------------------------------------------------------
create or replace function public.recalc_team_points(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_spent  bigint;
  v_budget bigint;
begin
  select coalesce(sum(sp.sold_price), 0) into v_spent
  from public.sold_players sp
  join public.auctions a on a.id = sp.auction_id
  where sp.team_id = p_team_id
    and (sp.reauctioned = false
         or (sp.reauctioned = true and a.reauction_refund_enabled = false));

  select total_budget into v_budget from public.teams where id = p_team_id;

  update public.teams
     set points_spent = v_spent,
         points_remaining = v_budget - v_spent
   where id = p_team_id;
end; $$;

create or replace function public.trg_sold_players_recalc()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalc_team_points(old.team_id);
    return old;
  end if;
  perform public.recalc_team_points(new.team_id);
  if (tg_op = 'UPDATE' and new.team_id is distinct from old.team_id) then
    perform public.recalc_team_points(old.team_id);
  end if;
  return new;
end; $$;

create trigger sold_players_recalc
  after insert or update or delete on public.sold_players
  for each row execute function public.trg_sold_players_recalc();

-- Keep points_remaining = total_budget - points_spent at all times, so a
-- freshly created team (no sales yet) already reports its full budget.
create or replace function public.trg_teams_remaining()
returns trigger language plpgsql as $$
begin
  new.points_remaining := new.total_budget - new.points_spent;
  return new;
end; $$;

create trigger teams_set_remaining
  before insert or update on public.teams
  for each row execute function public.trg_teams_remaining();

-- ---------------------------------------------------------------------
-- team_summary view: everything the team budget cards & bid panel need.
--   max_safe_bid = points_remaining - (slots_after_this - 1 already
--   accounted) * min_player_price, clamped at 0.
-- ---------------------------------------------------------------------
create or replace view public.team_summary as
select
  t.id, t.auction_id, t.name, t.short_name, t.logo_url,
  t.owner_name, t.owner_email, t.owner_user_id,
  t.total_budget, t.points_spent, t.points_remaining, t.max_players,
  a.squad_size, a.min_player_price,
  coalesce(s.players_count, 0)                            as players_count,
  greatest(a.squad_size - coalesce(s.players_count, 0), 0) as slots_remaining,
  case
    when coalesce(s.players_count, 0) >= a.squad_size then 0
    else greatest(
      t.points_remaining
        - (a.squad_size - coalesce(s.players_count, 0) - 1) * a.min_player_price,
      0)
  end as max_safe_bid
from public.teams t
join public.auctions a on a.id = t.auction_id
left join (
  select team_id, count(*) as players_count
  from public.sold_players
  where reauctioned = false
  group by team_id
) s on s.team_id = t.id;

-- ---------------------------------------------------------------------
-- place_bid: validate + record a bid atomically.
--   Locks the team row (FOR UPDATE) so two simultaneous bids can't both
--   pass the budget check.  p_override lets the auctioneer bypass the
--   minimum-increment rule (manual bid) but NEVER the budget/squad rules.
--   Raises 'BID_REJECTED: ...' on any rule failure; the client surfaces
--   the message as the "bid not allowed" warning.
-- ---------------------------------------------------------------------
create or replace function public.place_bid(
  p_player_id  uuid,
  p_team_id    uuid,
  p_bid_amount bigint,
  p_bid_type   text    default 'team_bid',
  p_override   boolean default false
)
returns public.bids
language plpgsql security definer set search_path = public as $$
declare
  v_team         public.teams%rowtype;
  v_auction      public.auctions%rowtype;
  v_base_price   bigint;
  v_player_count int;
  v_current_high bigint;
  v_min_next     bigint;
  v_min_required bigint;
  v_max_safe     bigint;
  v_caller       uuid;
  v_bid          public.bids%rowtype;
begin
  select id into v_caller from public.profiles where user_id = auth.uid();

  -- serialise concurrent bids for this team
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'BID_REJECTED: team not found'; end if;

  select * into v_auction from public.auctions where id = v_team.auction_id;
  if v_auction.status not in ('live') then
    raise exception 'BID_REJECTED: auction is not live (status %).', v_auction.status;
  end if;

  select base_price into v_base_price from public.players where id = p_player_id;

  select coalesce(max(bid_amount), 0) into v_current_high
  from public.bids where player_id = p_player_id;

  select count(*) into v_player_count
  from public.sold_players
  where team_id = p_team_id and reauctioned = false;

  -- Rule 5: squad not already full
  if v_player_count >= v_auction.squad_size then
    raise exception 'BID_REJECTED: squad already full (% / % players).',
      v_player_count, v_auction.squad_size;
  end if;

  -- Rule 3: must beat current highest bid
  if p_bid_amount <= v_current_high then
    raise exception 'BID_REJECTED: bid % must exceed current highest %.',
      p_bid_amount, v_current_high;
  end if;

  -- Rule 4: minimum increment (skipped on auctioneer override)
  if not p_override then
    v_min_next := greatest(v_current_high + v_auction.default_bid_increment, v_base_price);
    if p_bid_amount < v_min_next then
      raise exception 'BID_REJECTED: minimum next bid is %.', v_min_next;
    end if;
  end if;

  -- Rules 1 & 2: enough points now AND enough left to finish the squad
  --   reserve = (slots that remain AFTER winning this player) * min price
  v_min_required := (v_auction.squad_size - v_player_count - 1) * v_auction.min_player_price;
  v_max_safe     := v_team.points_remaining - v_min_required;
  if (v_team.points_remaining - p_bid_amount) < v_min_required then
    raise exception
      'BID_REJECTED: bid % exceeds max safe bid % (must reserve % pts for % remaining slots).',
      p_bid_amount, v_max_safe, v_min_required,
      (v_auction.squad_size - v_player_count - 1);
  end if;

  insert into public.bids(auction_id, player_id, team_id, bid_amount, bid_type, created_by)
  values (v_auction.id, p_player_id, p_team_id, p_bid_amount, p_bid_type, v_caller)
  returning * into v_bid;

  insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, created_by)
  values (v_auction.id, p_player_id, 'bid_placed', p_team_id, p_bid_amount, v_caller);

  return v_bid;
end; $$;

-- ---------------------------------------------------------------------
-- start_player: mark a queue entry current + flip player to in_auction.
-- ---------------------------------------------------------------------
create or replace function public.start_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_auction_id uuid; v_caller uuid;
begin
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;

  update public.auction_queue
     set status = 'completed'
   where auction_id = v_auction_id and status = 'current';

  update public.players set status = 'in_auction' where id = p_player_id;

  update public.auction_queue
     set status = 'current'
   where auction_id = v_auction_id and player_id = p_player_id;

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'player_started', v_caller);
end; $$;

-- ---------------------------------------------------------------------
-- mark_sold: record the purchase (trigger refreshes team spend).
-- ---------------------------------------------------------------------
create or replace function public.mark_sold(
  p_player_id  uuid,
  p_team_id    uuid,
  p_sold_price bigint
)
returns public.sold_players
language plpgsql security definer set search_path = public as $$
declare v_auction_id uuid; v_caller uuid; v_sale public.sold_players%rowtype;
begin
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;

  insert into public.sold_players(auction_id, player_id, team_id, sold_price)
  values (v_auction_id, p_player_id, p_team_id, p_sold_price)
  returning * into v_sale;

  update public.players       set status = 'sold'      where id = p_player_id;
  update public.auction_queue set status = 'completed'
    where auction_id = v_auction_id and player_id = p_player_id;

  insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, created_by)
  values (v_auction_id, p_player_id, 'sold', p_team_id, p_sold_price, v_caller);

  return v_sale;
end; $$;

-- ---------------------------------------------------------------------
-- mark_unsold
-- ---------------------------------------------------------------------
create or replace function public.mark_unsold(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_auction_id uuid; v_caller uuid;
begin
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;

  update public.players       set status = 'unsold'  where id = p_player_id;
  update public.auction_queue set status = 'skipped'
    where auction_id = v_auction_id and player_id = p_player_id;

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'unsold', v_caller);
end; $$;

-- ---------------------------------------------------------------------
-- reauction_player: reverse a sale and requeue the player.
--   Setting reauctioned=true fires the trigger; if refunds are enabled
--   the team's points are returned automatically (the row stops counting).
--   If refunds are disabled the points stay forfeited (recalc keeps them).
-- ---------------------------------------------------------------------
create or replace function public.reauction_player(p_sale_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sale     public.sold_players%rowtype;
  v_auction  public.auctions%rowtype;
  v_caller   uuid;
  v_maxorder int;
begin
  select id into v_caller from public.profiles where user_id = auth.uid();

  select * into v_sale from public.sold_players
  where id = p_sale_id and reauctioned = false;
  if not found then raise exception 'Active sale not found for %', p_sale_id; end if;

  select * into v_auction from public.auctions where id = v_sale.auction_id;

  update public.sold_players set reauctioned = true where id = p_sale_id;
  update public.players       set status = 'reauction' where id = v_sale.player_id;

  select coalesce(max(queue_order), 0) + 1 into v_maxorder
  from public.auction_queue where auction_id = v_sale.auction_id;

  insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
  values (v_sale.auction_id, v_sale.player_id,
          (select category from public.players where id = v_sale.player_id),
          v_maxorder, 'reauction')
  on conflict (auction_id, player_id)
  do update set status = 'reauction', queue_order = excluded.queue_order;

  insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, notes, created_by)
  values (v_sale.auction_id, v_sale.player_id, 'reauctioned', v_sale.team_id, v_sale.sold_price,
          case when v_auction.reauction_refund_enabled
               then 'Refund applied' else 'No refund (refund disabled)' end,
          v_caller);
end; $$;

-- ---------------------------------------------------------------------
-- generate_queue: (re)build the run sheet from approved/unsold/reauction
--   players, ordered by category sequence then base price.
-- ---------------------------------------------------------------------
create or replace function public.generate_queue(p_auction_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from public.auction_queue
  where auction_id = p_auction_id and status in ('pending','reauction','skipped');

  insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
  select p.auction_id, p.id, p.category,
         row_number() over (
           order by coalesce(c.sequence_order, 999), p.base_price desc, p.name
         ),
         'pending'
  from public.players p
  left join public.player_categories c
    on c.auction_id = p.auction_id and c.name = p.category
  where p.auction_id = p_auction_id
    and p.status in ('approved','reauction','unsold')
  on conflict (auction_id, player_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- ---------------------------------------------------------------------
-- Allow the API roles to execute the RPCs
-- ---------------------------------------------------------------------
grant execute on function public.place_bid(uuid,uuid,bigint,text,boolean) to authenticated;
grant execute on function public.start_player(uuid)        to authenticated;
grant execute on function public.mark_sold(uuid,uuid,bigint) to authenticated;
grant execute on function public.mark_unsold(uuid)         to authenticated;
grant execute on function public.reauction_player(uuid)    to authenticated;
grant execute on function public.generate_queue(uuid)      to authenticated;
grant select on public.team_summary to anon, authenticated;
