-- =====================================================================
--  Cricket Auction App  •  0017_fix_missing_can_place_bid_for_team.sql
--
--  Migration 0016 introduced a place_bid() that calls
--  can_place_bid_for_team(), but that helper (defined in
--  0006_security_hardening.sql) had not been applied to production.
--  This migration is self-contained: it defines the missing helper
--  and re-applies the corrected place_bid() in one shot.
-- =====================================================================

-- Helper: true when the calling user is admin OR owns the team being bid for.
create or replace function public.can_place_bid_for_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.owns_team(p_team_id);
$$;

grant execute on function public.can_place_bid_for_team(uuid) to authenticated;

-- Reapply place_bid with dynamic increment tiers so this file is
-- fully self-contained regardless of whether 0016 ran or not.
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

  select coalesce(max(bid_amount), 0) into v_current_high
  from public.bids where player_id = p_player_id;

  select count(*) into v_player_count
  from public.sold_players
  where team_id = p_team_id and reauctioned = false;

  if v_player_count >= v_auction.squad_size then
    raise exception 'BID_REJECTED: squad already full (% / % players).',
      v_player_count, v_auction.squad_size;
  end if;

  if p_bid_amount <= v_current_high then
    raise exception 'BID_REJECTED: bid % must exceed current highest %.',
      p_bid_amount, v_current_high;
  end if;

  if not p_override then
    -- Dynamic increment tiers — mirrors frontend calcIncrement()
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

revoke all on function public.place_bid(uuid,uuid,bigint,text,boolean) from public;
grant execute on function public.place_bid(uuid,uuid,bigint,text,boolean) to authenticated;
