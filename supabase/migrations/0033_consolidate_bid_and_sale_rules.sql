-- =====================================================================
--  Cricket Auction App  •  0033_consolidate_bid_and_sale_rules.sql
--  SINGLE SOURCE OF TRUTH for the spending + squad-composition rules.
--
--  Background (see audit AUD-001/002/008/009): place_bid had been
--  redefined 8x with a max-safe-bid formula that changed 3 times, and
--  mark_sold + the team_summary view enforced DIFFERENT reserve rules.
--  This migration collapses all three onto one helper so a bid that is
--  accepted is finalizable at the same price, and the number shown to
--  users (team_summary.max_safe_bid) is exactly the number enforced.
--
--  Canonical max-safe-bid (the 0029 formula, confirmed with product):
--      avg_base_cost  = SUM(base_price WHERE status<>'sold')
--                       / COUNT(players WHERE status<>'sold')
--      slots_remaining= squad_size - active_sold_count
--      max_safe_bid   = max(0, floor(points_remaining
--                                     - avg_base_cost * slots_remaining))
--      (no budget multiplier)
--
--  Also adds server-side enforcement of per-category squad rules
--  (player_categories.maximum_allowed / minimum_required), which were
--  previously unenforced.
--
--  All objects use SECURITY DEFINER + SET search_path = public to match
--  the existing convention. Every function is CREATE OR REPLACE, so this
--  migration converges any prior/drifted deployed state onto these rules.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. Canonical max-safe-bid helper.
--   Pure SQL (language sql) so the planner can inline it inside the
--   team_summary view; STABLE because it only reads.
-- ---------------------------------------------------------------------
create or replace function public.max_safe_bid_for_team(p_team_id uuid)
returns bigint
language sql stable security definer set search_path = public as $$
  with t as (
    select id, auction_id, points_remaining
    from public.teams where id = p_team_id
  ),
  a as (
    select au.squad_size
    from public.auctions au
    where au.id = (select auction_id from t)
  ),
  sold as (
    select count(*)::int c
    from public.sold_players
    where team_id = p_team_id and reauctioned = false
  ),
  pool as (
    select coalesce(sum(base_price), 0)::numeric s, greatest(count(*), 1)::int n
    from public.players
    where auction_id = (select auction_id from t) and status <> 'sold'
  )
  select case
    when (select id from t) is null then 0  -- team not found
    when (select squad_size from a) - (select c from sold) <= 0 then 0
    else greatest(
      floor(
        (select points_remaining from t)
        - (select s from pool) / (select n from pool)
          * ((select squad_size from a) - (select c from sold))
      )::bigint,
      0
    )
  end;
$$;

revoke all on function public.max_safe_bid_for_team(uuid) from public;
grant execute on function public.max_safe_bid_for_team(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1b. Category composition guard.
--   Raises 'BID_REJECTED: ...' when buying p_player_id for p_team_id
--   would (i) exceed the player's category maximum_allowed, or
--   (ii) consume a slot needed to still reach other categories'
--   minimum_required given the team's remaining slots.
--
--   NOTE: requires SUM(minimum_required) <= squad_size per auction, or
--   rule (ii) is unsatisfiable. The category editor should validate this.
-- ---------------------------------------------------------------------
create or replace function public.assert_category_ok(p_team_id uuid, p_player_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_auction_id uuid;
  v_cat        text;
  v_squad      int;
  v_sold       int;
  v_cat_count  int;
  v_cat_max    int;
  v_slots_after int;
  v_needed     int;
begin
  select auction_id, category into v_auction_id, v_cat
  from public.players where id = p_player_id;

  select squad_size into v_squad from public.auctions where id = v_auction_id;

  select count(*) into v_sold
  from public.sold_players
  where team_id = p_team_id and reauctioned = false;

  -- (i) hard maximum for this player's category
  if v_cat is not null then
    select maximum_allowed into v_cat_max
    from public.player_categories
    where auction_id = v_auction_id and name = v_cat;

    if v_cat_max is not null then
      select count(*) into v_cat_count
      from public.sold_players sp
      join public.players p on p.id = sp.player_id
      where sp.team_id = p_team_id and sp.reauctioned = false and p.category = v_cat;

      if v_cat_count + 1 > v_cat_max then
        raise exception 'BID_REJECTED: category "%" already at max (% for this team).',
          v_cat, v_cat_max;
      end if;
    end if;
  end if;

  -- (ii) minimum feasibility: slots left AFTER this buy must cover the
  --      still-unmet minimums of every category (this purchase counts
  --      toward its own category's minimum).
  v_slots_after := v_squad - (v_sold + 1);

  select coalesce(sum(greatest(
           pc.minimum_required
           - coalesce(cnt.c, 0)
           - case when pc.name = v_cat then 1 else 0 end,
           0)), 0)
  into v_needed
  from public.player_categories pc
  left join (
    select p.category as name, count(*) c
    from public.sold_players sp
    join public.players p on p.id = sp.player_id
    where sp.team_id = p_team_id and sp.reauctioned = false
    group by p.category
  ) cnt on cnt.name = pc.name
  where pc.auction_id = v_auction_id;

  if v_needed > v_slots_after then
    raise exception
      'BID_REJECTED: purchase blocks category minimums (% slots left, % still required).',
      v_slots_after, v_needed;
  end if;
end; $$;

revoke all on function public.assert_category_ok(uuid, uuid) from public;
grant execute on function public.assert_category_ok(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 1c. place_bid — based on the 0029 body (keeps the team-row AND
--   queue-row FOR UPDATE locks that serialise concurrent bids on the
--   same player, AUD-009). The inline pool-average computation is
--   replaced by max_safe_bid_for_team(); category guard added before
--   the insert.
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
  v_player       public.players%rowtype;
  v_auction      public.auctions%rowtype;
  v_queue        public.auction_queue%rowtype;
  v_current_high bigint;
  v_increment    bigint;
  v_min_next     bigint;
  v_floor_price  bigint;
  v_max_safe     bigint;
  v_caller       uuid;
  v_bid          public.bids%rowtype;
begin
  if not public.can_place_bid_for_team(p_team_id) then
    raise exception 'AUTH_REQUIRED: cannot bid for this team';
  end if;
  if p_bid_amount <= 0 then
    raise exception 'BID_REJECTED: bid must be greater than zero.';
  end if;

  select id into v_caller from public.profiles where user_id = auth.uid();
  select * into v_player from public.players where id = p_player_id;
  if not found then raise exception 'BID_REJECTED: player not found'; end if;

  -- serialise concurrent bids for this team
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'BID_REJECTED: team not found'; end if;
  if v_team.auction_id <> v_player.auction_id then
    raise exception 'BID_REJECTED: team and player belong to different auctions.';
  end if;
  if v_player.status <> 'in_auction' then
    raise exception 'BID_REJECTED: player is not currently in auction.';
  end if;

  select * into v_auction from public.auctions where id = v_team.auction_id;
  if v_auction.status <> 'live' then
    raise exception 'BID_REJECTED: auction is not live (status %).', v_auction.status;
  end if;

  -- serialise concurrent bids for this player (single 'current' queue row)
  select * into v_queue
  from public.auction_queue
  where auction_id = v_auction.id and player_id = p_player_id and status = 'current'
  for update;

  if found and v_queue.clock_paused then
    raise exception 'BID_REJECTED: bid clock is paused by auctioneer.';
  end if;

  select coalesce(max(bid_amount), 0) into v_current_high
  from public.bids where player_id = p_player_id;

  -- squad-size cap (per-category caps + reserve handled by the helpers below)
  if (select count(*) from public.sold_players
      where team_id = p_team_id and reauctioned = false) >= v_auction.squad_size then
    raise exception 'BID_REJECTED: squad already full (% players).', v_auction.squad_size;
  end if;

  if p_bid_amount <= v_current_high then
    raise exception 'BID_REJECTED: bid % must exceed current highest %.',
      p_bid_amount, v_current_high;
  end if;

  v_floor_price := case
    when v_player.status = 'reauction' then v_auction.min_player_price
    else v_player.base_price
  end;

  if v_player.status = 'reauction' and p_bid_amount < v_auction.min_player_price then
    raise exception 'BID_REJECTED: minimum bid for re-auction player is %.',
      v_auction.min_player_price;
  end if;

  -- Dynamic increment tiers — mirrors frontend calcIncrement():
  --   < 10,000 -> 100 ; < 15,000 -> 500 ; else 1,000
  if not p_override then
    v_increment := case
      when v_current_high < 10000 then 100
      when v_current_high < 15000 then 500
      else 1000
    end;
    v_min_next := greatest(v_current_high + v_increment, v_floor_price);
    if p_bid_amount < v_min_next then
      raise exception 'BID_REJECTED: minimum next bid is %.', v_min_next;
    end if;
  end if;

  -- Composition + budget reserve: the single canonical rules.
  perform public.assert_category_ok(p_team_id, p_player_id);

  v_max_safe := public.max_safe_bid_for_team(p_team_id);
  if p_bid_amount > v_max_safe then
    raise exception 'BID_REJECTED: bid % exceeds max safe bid % (base-cost reserve).',
      p_bid_amount, v_max_safe;
  end if;

  insert into public.bids(auction_id, player_id, team_id, bid_amount, bid_type, created_by)
  values (v_auction.id, p_player_id, p_team_id, p_bid_amount, p_bid_type, v_caller)
  returning * into v_bid;

  update public.auction_queue
  set current_bid_deadline = now()
        + make_interval(secs => greatest(coalesce(v_auction.bid_timer_seconds, 15), 1)),
      clock_paused = false,
      paused_remaining_seconds = null
  where auction_id = v_auction.id and player_id = p_player_id and status = 'current';

  insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, created_by)
  values (v_auction.id, p_player_id, 'bid_placed', p_team_id, p_bid_amount, v_caller);

  return v_bid;
end; $$;

revoke all on function public.place_bid(uuid, uuid, bigint, text, boolean) from public;
grant execute on function public.place_bid(uuid, uuid, bigint, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 1d. mark_sold — based on the 0024 body (keeps team FOR UPDATE,
--   "player is current", cross-auction, squad-full and match-highest-bid
--   checks). The inline (squad_size-count-1)*min_player_price reserve is
--   replaced by the SAME helpers used by place_bid, so a bid that was
--   accepted is finalizable at the same price (AUD-002).
-- ---------------------------------------------------------------------
create or replace function public.mark_sold(
  p_player_id  uuid,
  p_team_id    uuid,
  p_sold_price bigint
)
returns public.sold_players
language plpgsql security definer set search_path = public as $$
declare
  v_auction_id      uuid;
  v_team_auction_id uuid;
  v_caller          uuid;
  v_sale            public.sold_players%rowtype;
  v_auction         public.auctions%rowtype;
  v_team            public.teams%rowtype;
  v_player_count    int;
  v_max_safe        bigint;
  v_current_high    bigint;
  v_high_team_id    uuid;
begin
  perform public.require_admin();
  if p_sold_price <= 0 then
    raise exception 'STATE_REJECTED: sold price must be positive';
  end if;

  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;
  select auction_id into v_team_auction_id from public.teams where id = p_team_id;
  if v_auction_id is null or v_team_auction_id is null then
    raise exception 'STATE_REJECTED: invalid player/team';
  end if;
  if v_auction_id <> v_team_auction_id then
    raise exception 'STATE_REJECTED: player and team are from different auctions';
  end if;

  if not exists (
    select 1 from public.auction_queue
    where auction_id = v_auction_id and player_id = p_player_id and status = 'current'
  ) then
    raise exception 'STATE_REJECTED: player is not the current auction item';
  end if;

  select * into v_team from public.teams where id = p_team_id for update;
  select * into v_auction from public.auctions where id = v_auction_id;
  select count(*) into v_player_count
  from public.sold_players
  where team_id = p_team_id and reauctioned = false;

  if v_player_count >= v_auction.squad_size then
    raise exception 'STATE_REJECTED: squad already full (% / % players).',
      v_player_count, v_auction.squad_size;
  end if;

  -- Same canonical composition + reserve rules as place_bid.
  perform public.assert_category_ok(p_team_id, p_player_id);

  v_max_safe := public.max_safe_bid_for_team(p_team_id);
  if p_sold_price > v_max_safe then
    raise exception 'STATE_REJECTED: sale % exceeds max safe bid % (base-cost reserve).',
      p_sold_price, v_max_safe;
  end if;

  -- Sale must match the current highest bid (when bids exist).
  select b.bid_amount, b.team_id into v_current_high, v_high_team_id
  from public.bids b
  where b.player_id = p_player_id
  order by b.bid_amount desc, b.created_at desc
  limit 1;

  if v_current_high is not null then
    if p_sold_price <> v_current_high or p_team_id <> v_high_team_id then
      raise exception 'STATE_REJECTED: sold details must match highest bid (% by team %).',
        v_current_high, v_high_team_id;
    end if;
  end if;

  insert into public.sold_players(auction_id, player_id, team_id, sold_price)
  values (v_auction_id, p_player_id, p_team_id, p_sold_price)
  returning * into v_sale;

  update public.players set status = 'sold' where id = p_player_id;
  update public.auction_queue
  set status = 'completed', current_bid_deadline = null
  where auction_id = v_auction_id and player_id = p_player_id;

  insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, created_by)
  values (v_auction_id, p_player_id, 'sold', p_team_id, p_sold_price, v_caller);

  return v_sale;
end; $$;

revoke all on function public.mark_sold(uuid, uuid, bigint) from public;
grant execute on function public.mark_sold(uuid, uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 1e. team_summary — now derives max_safe_bid from the single helper so
--   the displayed number is exactly the enforced number. Owner contact
--   columns (owner_email/owner_name) are intentionally dropped from this
--   public/anon-readable view (AUD-007 — PII). Consumers match on
--   owner_user_id, which is retained.
-- ---------------------------------------------------------------------
drop view if exists public.team_summary;
create view public.team_summary as
select
  t.id, t.auction_id, t.name, t.short_name, t.logo_url, t.owner_user_id,
  t.total_budget, t.points_spent, t.points_remaining, t.max_players,
  a.squad_size, a.min_player_price,
  coalesce(sc.players_count, 0)                              as players_count,
  greatest(a.squad_size - coalesce(sc.players_count, 0), 0)  as slots_remaining,
  public.max_safe_bid_for_team(t.id)                         as max_safe_bid
from public.teams t
join public.auctions a on a.id = t.auction_id
left join (
  select team_id, count(*)::int as players_count
  from public.sold_players
  where reauctioned = false
  group by team_id
) sc on sc.team_id = t.id;

grant select on public.team_summary to anon, authenticated;
