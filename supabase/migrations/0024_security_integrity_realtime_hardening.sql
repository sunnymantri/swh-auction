-- =====================================================================
--  Cricket Auction App  •  0024_security_integrity_realtime_hardening.sql
--  Close direct bid write path, harden sold/start invariants, and add
--  an authoritative bid deadline shared across clients.
-- =====================================================================

alter table public.auction_queue
  add column if not exists current_bid_deadline timestamptz;

drop policy if exists bids_insert on public.bids;
revoke insert, update, delete on public.bids from authenticated;

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
  v_player_count int;
  v_current_high bigint;
  v_increment    bigint;
  v_min_next     bigint;
  v_min_required bigint;
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

  if not p_override then
    v_increment := case
      when v_current_high < 10000 then 100
      when v_current_high < 15000 then 500
      else 1000
    end;
    v_min_next := greatest(v_current_high + v_increment, v_player.base_price);
    if p_bid_amount < v_min_next then
      raise exception 'BID_REJECTED: minimum next bid is %.', v_min_next;
    end if;
  end if;

  v_min_required := (v_auction.squad_size - v_player_count - 1) * v_auction.min_player_price;
  v_max_safe := v_team.points_remaining - v_min_required;
  if (v_team.points_remaining - p_bid_amount) < v_min_required then
    raise exception
      'BID_REJECTED: bid % exceeds max safe bid % (must reserve % pts for % remaining slots).',
      p_bid_amount, v_max_safe, v_min_required, (v_auction.squad_size - v_player_count - 1);
  end if;

  insert into public.bids(auction_id, player_id, team_id, bid_amount, bid_type, created_by)
  values (v_auction.id, p_player_id, p_team_id, p_bid_amount, p_bid_type, v_caller)
  returning * into v_bid;

  update public.auction_queue
  set current_bid_deadline = now() + make_interval(secs => greatest(coalesce(v_auction.bid_timer_seconds, 15), 1))
  where auction_id = v_auction.id and player_id = p_player_id and status = 'current';

  insert into public.auction_events(auction_id, player_id, event_type, team_id, amount, created_by)
  values (v_auction.id, p_player_id, 'bid_placed', p_team_id, p_bid_amount, v_caller);

  return v_bid;
end; $$;

create or replace function public.start_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_auction_id uuid;
  v_current_player uuid;
  v_caller uuid;
  v_timer_seconds int;
begin
  perform public.require_admin();
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;
  if v_auction_id is null then
    raise exception 'PLAYER_NOT_FOUND: %', p_player_id;
  end if;
  if exists (
    select 1 from public.sold_players
    where player_id = p_player_id and reauctioned = false
  ) then
    raise exception 'QUEUE_STATE_REJECTED: player already has an active sale; use re-auction first';
  end if;

  select player_id into v_current_player
  from public.auction_queue
  where auction_id = v_auction_id and status = 'current';

  if v_current_player is not null then
    update public.players set status = 'ready_for_auction'
    where id = v_current_player and status = 'in_auction';
  end if;

  update public.auction_queue
  set status = 'completed', current_bid_deadline = null
  where auction_id = v_auction_id and status = 'current';

  update public.players set status = 'in_auction' where id = p_player_id;

  update public.auction_queue
  set status = 'current'
  where auction_id = v_auction_id and player_id = p_player_id
    and status in ('pending', 'reauction', 'skipped', 'completed');

  if not found then
    raise exception 'QUEUE_STATE_REJECTED: player is not eligible to be set as current';
  end if;

  select greatest(coalesce(bid_timer_seconds, 15), 1)
  into v_timer_seconds
  from public.auctions
  where id = v_auction_id;

  update public.auction_queue
  set current_bid_deadline = now() + make_interval(secs => v_timer_seconds)
  where auction_id = v_auction_id and player_id = p_player_id and status = 'current';

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'player_started', v_caller);
end; $$;

create or replace function public.mark_sold(
  p_player_id  uuid,
  p_team_id    uuid,
  p_sold_price bigint
)
returns public.sold_players
language plpgsql security definer set search_path = public as $$
declare
  v_auction_id uuid;
  v_team_auction_id uuid;
  v_caller uuid;
  v_sale public.sold_players%rowtype;
  v_auction public.auctions%rowtype;
  v_team public.teams%rowtype;
  v_player_count int;
  v_min_required bigint;
  v_current_high bigint;
  v_high_team_id uuid;
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
    raise exception 'STATE_REJECTED: squad already full (% / % players).', v_player_count, v_auction.squad_size;
  end if;

  v_min_required := (v_auction.squad_size - v_player_count - 1) * v_auction.min_player_price;
  if (v_team.points_remaining - p_sold_price) < v_min_required then
    raise exception 'STATE_REJECTED: sale would violate minimum reserve for remaining squad slots.';
  end if;

  select b.bid_amount, b.team_id into v_current_high, v_high_team_id
  from public.bids b
  where b.player_id = p_player_id
  order by b.bid_amount desc, b.created_at desc
  limit 1;

  if v_current_high is not null then
    if p_sold_price <> v_current_high or p_team_id <> v_high_team_id then
      raise exception 'STATE_REJECTED: sold details must match highest bid (% by team %).', v_current_high, v_high_team_id;
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

create or replace function public.mark_unsold(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_auction_id uuid; v_caller uuid;
begin
  perform public.require_admin();
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;
  if v_auction_id is null then
    raise exception 'PLAYER_NOT_FOUND: %', p_player_id;
  end if;

  if not exists (
    select 1 from public.auction_queue
    where auction_id = v_auction_id and player_id = p_player_id and status = 'current'
  ) then
    raise exception 'STATE_REJECTED: player is not the current auction item';
  end if;

  update public.players set status = 'unsold' where id = p_player_id;
  update public.auction_queue
    set status = 'skipped', current_bid_deadline = null
    where auction_id = v_auction_id and player_id = p_player_id;

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'unsold', v_caller);
end; $$;

create or replace function public.reset_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.bids where auction_id = p_auction_id;
  delete from public.sold_players where auction_id = p_auction_id;
  delete from public.auction_events where auction_id = p_auction_id;
  delete from public.auction_queue where auction_id = p_auction_id;

  update public.teams
  set points_spent = 0,
      points_remaining = total_budget
  where auction_id = p_auction_id;

  update public.players
  set status = case
    when status = 'not_registered' then 'not_registered'
    when status = 'registered' then 'registered'
    else 'ready_for_auction'
  end
  where auction_id = p_auction_id;
end; $$;
