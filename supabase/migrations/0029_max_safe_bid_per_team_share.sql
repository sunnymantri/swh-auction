-- max_safe_bid formula:
-- average_base_cost = (sum of unsold base prices) / count of unsold players
-- reserve_required = average_base_cost × slots_remaining
-- max_safe_bid = points_remaining - reserve_required
-- No budget multiplier applied.

-- 1. Update the team_summary view
drop view if exists public.team_summary;
create or replace view public.team_summary as
with sold_counts as (
  select team_id, count(*)::int as players_count
  from public.sold_players
  where reauctioned = false
  group by team_id
),
unauctioned_pool as (
  select
    auction_id,
    coalesce(sum(base_price), 0)::bigint as base_price_pool,
    greatest(count(*), 1)::int as player_count
  from public.players
  where status <> 'sold'
  group by auction_id
)
select
  t.id, t.auction_id, t.name, t.short_name, t.logo_url,
  t.owner_name, t.owner_email, t.owner_user_id,
  t.total_budget, t.points_spent, t.points_remaining, t.max_players,
  a.squad_size, a.min_player_price,
  coalesce(sc.players_count, 0) as players_count,
  greatest(a.squad_size - coalesce(sc.players_count, 0), 0) as slots_remaining,
  case
    when coalesce(sc.players_count, 0) >= a.squad_size then 0
    when greatest(a.squad_size - coalesce(sc.players_count, 0), 0) = 0 then 0
    else greatest(
      floor(
        t.points_remaining
        - (coalesce(up.base_price_pool, 0)::numeric / up.player_count)
          * (a.squad_size - coalesce(sc.players_count, 0))
      )::bigint,
      0
    )
  end as max_safe_bid
from public.teams t
join public.auctions a on a.id = t.auction_id
left join sold_counts sc on sc.team_id = t.id
left join unauctioned_pool up on up.auction_id = t.auction_id;

grant select on public.team_summary to anon, authenticated;

-- 2. Update place_bid to use the same formula for validation
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
  v_team             public.teams%rowtype;
  v_player           public.players%rowtype;
  v_auction          public.auctions%rowtype;
  v_queue            public.auction_queue%rowtype;
  v_player_count     int;
  v_current_high     bigint;
  v_increment        bigint;
  v_min_next         bigint;
  v_floor_price      bigint;
  v_unauctioned_pool bigint;
  v_unauctioned_count int;
  v_slots_remaining  int;
  v_avg_base_cost    numeric;
  v_max_safe         bigint;
  v_caller           uuid;
  v_bid              public.bids%rowtype;
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

  select * into v_queue
  from public.auction_queue
  where auction_id = v_auction.id and player_id = p_player_id and status = 'current'
  for update;

  if found and v_queue.clock_paused then
    raise exception 'BID_REJECTED: bid clock is paused by auctioneer.';
  end if;

  select coalesce(max(bid_amount), 0) into v_current_high
  from public.bids where player_id = p_player_id;

  select count(*) into v_player_count
  from public.sold_players
  where team_id = p_team_id and reauctioned = false;

  if v_player_count >= v_auction.squad_size then
    raise exception 'BID_REJECTED: squad already full (% / % players).', v_player_count, v_auction.squad_size;
  end if;
  if p_bid_amount <= v_current_high then
    raise exception 'BID_REJECTED: bid % must exceed current highest %.', p_bid_amount, v_current_high;
  end if;

  v_floor_price := case
    when v_player.status = 'reauction' then v_auction.min_player_price
    else v_player.base_price
  end;

  if v_player.status = 'reauction' and p_bid_amount < v_auction.min_player_price then
    raise exception 'BID_REJECTED: minimum bid for re-auction player is %.', v_auction.min_player_price;
  end if;

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

  -- Max safe bid: average base cost × slots_remaining as reserve
  select coalesce(sum(base_price), 0)::bigint, greatest(count(*), 1)::int
  into v_unauctioned_pool, v_unauctioned_count
  from public.players
  where auction_id = v_auction.id and status <> 'sold';

  v_slots_remaining := greatest(v_auction.squad_size - v_player_count, 0);
  if v_slots_remaining = 0 then
    v_max_safe := 0;
  else
    v_avg_base_cost := v_unauctioned_pool::numeric / v_unauctioned_count;
    v_max_safe := greatest(
      floor(v_team.points_remaining - v_avg_base_cost * v_slots_remaining)::bigint,
      0
    );
  end if;

  if p_bid_amount > v_max_safe then
    raise exception
      'BID_REJECTED: bid % exceeds max safe bid % (base cost reserve).',
      p_bid_amount, v_max_safe;
  end if;

  insert into public.bids(auction_id, player_id, team_id, bid_amount, bid_type, created_by)
  values (v_auction.id, p_player_id, p_team_id, p_bid_amount, p_bid_type, v_caller)
  returning * into v_bid;

  update public.auction_queue
  set current_bid_deadline = now() + make_interval(secs => greatest(coalesce(v_auction.bid_timer_seconds, 15), 1)),
      clock_paused = false,
      paused_remaining_seconds = null
  where auction_id = v_auction.id and player_id = p_player_id and status = 'current';

  insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, created_by)
  values (v_auction.id, p_player_id, 'bid_placed', p_team_id, p_bid_amount, v_caller);

  return v_bid;
end; $$;
