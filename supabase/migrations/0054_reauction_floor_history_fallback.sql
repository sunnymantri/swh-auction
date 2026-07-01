-- If a player was released to re-auction but status drifted to in_auction,
-- still enforce re-auction floor from auction.min_player_price.

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
  v_team               public.teams%rowtype;
  v_player             public.players%rowtype;
  v_auction            public.auctions%rowtype;
  v_queue              public.auction_queue%rowtype;
  v_current_high       bigint;
  v_increment          bigint;
  v_min_next           bigint;
  v_floor_price        bigint;
  v_caller             uuid;
  v_bid                public.bids%rowtype;
  v_max_safe           bigint;
  v_is_reauction_round boolean;
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
  if v_player.status not in ('in_auction', 'reauction') then
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

  if (select count(*) from public.sold_players
      where team_id = p_team_id and reauctioned = false) >= v_auction.squad_size then
    raise exception 'BID_REJECTED: squad already full (% players).', v_auction.squad_size;
  end if;

  if p_bid_amount <= v_current_high then
    raise exception 'BID_REJECTED: bid % must exceed current highest %.',
      p_bid_amount, v_current_high;
  end if;

  v_is_reauction_round := v_player.status = 'reauction' or exists (
    select 1 from public.sold_players
    where player_id = p_player_id and reauctioned = true
  );

  v_floor_price := case
    when v_is_reauction_round then v_auction.min_player_price
    else v_player.base_price
  end;

  if v_is_reauction_round and p_bid_amount < v_auction.min_player_price then
    raise exception 'BID_REJECTED: minimum bid for re-auction player is %.',
      v_auction.min_player_price;
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
