-- =====================================================================
--  Cricket Auction App  •  0006_security_hardening.sql
--  Tighten RPC authorization and state validation.
-- =====================================================================

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'AUTH_REQUIRED: admin role required';
  end if;
end; $$;

create or replace function public.can_place_bid_for_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.owns_team(p_team_id);
$$;

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
    v_min_next := greatest(v_current_high + v_auction.default_bid_increment, v_player.base_price);
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

create or replace function public.start_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_auction_id uuid;
  v_current_player uuid;
  v_caller uuid;
begin
  perform public.require_admin();
  select id into v_caller from public.profiles where user_id = auth.uid();
  select auction_id into v_auction_id from public.players where id = p_player_id;
  if v_auction_id is null then
    raise exception 'PLAYER_NOT_FOUND: %', p_player_id;
  end if;

  select player_id into v_current_player
  from public.auction_queue
  where auction_id = v_auction_id and status = 'current';

  if v_current_player is not null then
    update public.players set status = 'approved'
    where id = v_current_player and status = 'in_auction';
  end if;

  update public.auction_queue
     set status = 'completed'
   where auction_id = v_auction_id and status = 'current';

  update public.players set status = 'in_auction' where id = p_player_id;

  update public.auction_queue
     set status = 'current'
   where auction_id = v_auction_id and player_id = p_player_id
     and status in ('pending', 'reauction', 'skipped');

  if not found then
    raise exception 'QUEUE_STATE_REJECTED: player is not eligible to be set as current';
  end if;

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

  insert into public.sold_players(auction_id, player_id, team_id, sold_price)
  values (v_auction_id, p_player_id, p_team_id, p_sold_price)
  returning * into v_sale;

  update public.players set status = 'sold' where id = p_player_id;
  update public.auction_queue set status = 'completed'
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
  update public.auction_queue set status = 'skipped'
    where auction_id = v_auction_id and player_id = p_player_id;

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'unsold', v_caller);
end; $$;

create or replace function public.reauction_player(p_sale_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sale     public.sold_players%rowtype;
  v_auction  public.auctions%rowtype;
  v_caller   uuid;
  v_maxorder int;
begin
  perform public.require_admin();
  select id into v_caller from public.profiles where user_id = auth.uid();

  select * into v_sale from public.sold_players
  where id = p_sale_id and reauctioned = false;
  if not found then raise exception 'Active sale not found for %', p_sale_id; end if;

  select * into v_auction from public.auctions where id = v_sale.auction_id;
  update public.sold_players set reauctioned = true where id = p_sale_id;
  update public.players set status = 'reauction' where id = v_sale.player_id;

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

create or replace function public.generate_queue(p_auction_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  perform public.require_admin();
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

revoke all on function public.start_player(uuid) from public;
revoke all on function public.mark_sold(uuid,uuid,bigint) from public;
revoke all on function public.mark_unsold(uuid) from public;
revoke all on function public.reauction_player(uuid) from public;
revoke all on function public.generate_queue(uuid) from public;
revoke all on function public.place_bid(uuid,uuid,bigint,text,boolean) from public;

grant execute on function public.place_bid(uuid,uuid,bigint,text,boolean) to authenticated;
grant execute on function public.start_player(uuid) to authenticated;
grant execute on function public.mark_sold(uuid,uuid,bigint) to authenticated;
grant execute on function public.mark_unsold(uuid) to authenticated;
grant execute on function public.reauction_player(uuid) to authenticated;
grant execute on function public.generate_queue(uuid) to authenticated;
