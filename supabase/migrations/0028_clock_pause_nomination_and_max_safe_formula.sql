-- =====================================================================
--  Cricket Auction App  •  0028_clock_pause_nomination_and_max_safe_formula.sql
--  - Global pause/resume for the current bid clock
--  - Team non-regular bowler nominations (max 2 per team)
--  - Max-safe bid formula based on unauctioned pool average
-- =====================================================================

alter table public.auctions
  add column if not exists initial_bid_timer_seconds int not null default 90,
  add column if not exists bid_timer_seconds int not null default 15;

alter table public.auction_queue
  add column if not exists clock_paused boolean not null default false,
  add column if not exists paused_remaining_seconds int;

create or replace view public.team_summary as
with sold_counts as (
  select team_id, count(*)::int as players_count
  from public.sold_players
  where reauctioned = false
  group by team_id
),
unauctioned_pool as (
  select auction_id, coalesce(sum(base_price), 0)::bigint as base_price_pool
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
    else floor(
      (coalesce(up.base_price_pool, 0)::numeric * coalesce(a.budget_multiplier, 1))
      / greatest(a.squad_size - coalesce(sc.players_count, 0), 1)
    )::bigint
  end as max_safe_bid
from public.teams t
join public.auctions a on a.id = t.auction_id
left join sold_counts sc on sc.team_id = t.id
left join unauctioned_pool up on up.auction_id = t.auction_id;

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
  v_slots_remaining  int;
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

  select coalesce(sum(base_price), 0)::bigint into v_unauctioned_pool
  from public.players
  where auction_id = v_auction.id and status <> 'sold';

  v_slots_remaining := greatest(v_auction.squad_size - v_player_count, 0);
  if v_slots_remaining = 0 then
    v_max_safe := 0;
  else
    v_max_safe := floor(
      (v_unauctioned_pool::numeric * coalesce(v_auction.budget_multiplier, 1))
      / v_slots_remaining
    )::bigint;
  end if;

  if p_bid_amount > v_max_safe then
    raise exception
      'BID_REJECTED: bid % exceeds max safe bid % (pool-average rule).',
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

create or replace function public.start_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_auction_id     uuid;
  v_current_player uuid;
  v_caller         uuid;
  v_timer_seconds  int;
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
  set status = 'completed',
      current_bid_deadline = null,
      clock_paused = false,
      paused_remaining_seconds = null
  where auction_id = v_auction_id and status = 'current';

  update public.players set status = 'in_auction' where id = p_player_id;

  update public.auction_queue
  set status = 'current',
      clock_paused = false,
      paused_remaining_seconds = null
  where auction_id = v_auction_id and player_id = p_player_id
    and status in ('pending', 'reauction', 'skipped', 'completed');

  if not found then
    raise exception 'QUEUE_STATE_REJECTED: player is not eligible to be set as current';
  end if;

  select greatest(coalesce(initial_bid_timer_seconds, 90), 1)
  into v_timer_seconds
  from public.auctions
  where id = v_auction_id;

  update public.auction_queue
  set current_bid_deadline = now() + make_interval(secs => v_timer_seconds)
  where auction_id = v_auction_id and player_id = p_player_id and status = 'current';

  insert into public.auction_events(auction_id, player_id, event_type, created_by)
  values (v_auction_id, p_player_id, 'player_started', v_caller);
end; $$;

create or replace function public.pause_current_clock(p_auction_id uuid)
returns public.auction_queue
language plpgsql security definer set search_path = public as $$
declare
  v_queue public.auction_queue%rowtype;
  v_remaining int;
begin
  perform public.require_admin();

  select * into v_queue
  from public.auction_queue
  where auction_id = p_auction_id and status = 'current'
  for update;

  if not found then
    raise exception 'STATE_REJECTED: no current player to pause';
  end if;

  if v_queue.clock_paused then
    return v_queue;
  end if;

  v_remaining := case
    when v_queue.current_bid_deadline is null then 0
    else greatest(0, ceil(extract(epoch from (v_queue.current_bid_deadline - now())))::int)
  end;

  update public.auction_queue
  set clock_paused = true,
      paused_remaining_seconds = v_remaining,
      current_bid_deadline = null
  where id = v_queue.id
  returning * into v_queue;

  return v_queue;
end; $$;

create or replace function public.resume_current_clock(p_auction_id uuid)
returns public.auction_queue
language plpgsql security definer set search_path = public as $$
declare
  v_queue public.auction_queue%rowtype;
  v_seconds int;
begin
  perform public.require_admin();

  select * into v_queue
  from public.auction_queue
  where auction_id = p_auction_id and status = 'current'
  for update;

  if not found then
    raise exception 'STATE_REJECTED: no current player to resume';
  end if;

  if not v_queue.clock_paused then
    return v_queue;
  end if;

  v_seconds := greatest(coalesce(v_queue.paused_remaining_seconds, 1), 1);

  update public.auction_queue
  set clock_paused = false,
      paused_remaining_seconds = null,
      current_bid_deadline = now() + make_interval(secs => v_seconds)
  where id = v_queue.id
  returning * into v_queue;

  return v_queue;
end; $$;

create table if not exists public.team_non_regular_bowlers (
  id         uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (auction_id, team_id, player_id)
);

create index if not exists idx_team_non_regular_bowlers_team
  on public.team_non_regular_bowlers(auction_id, team_id);

alter table public.team_non_regular_bowlers enable row level security;

drop policy if exists team_non_regular_bowlers_read on public.team_non_regular_bowlers;
create policy team_non_regular_bowlers_read
  on public.team_non_regular_bowlers
  for select
  using (true);

create or replace function public.trg_validate_non_regular_bowler()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_role text;
begin
  select count(*) into v_count
  from public.team_non_regular_bowlers
  where auction_id = new.auction_id
    and team_id = new.team_id
    and id <> coalesce(new.id, gen_random_uuid());

  if v_count >= 2 then
    raise exception 'STATE_REJECTED: a team can nominate at most two non-regular bowlers';
  end if;

  if not exists (
    select 1
    from public.sold_players sp
    where sp.auction_id = new.auction_id
      and sp.team_id = new.team_id
      and sp.player_id = new.player_id
      and sp.reauctioned = false
  ) then
    raise exception 'STATE_REJECTED: nominated player must be actively sold to this team';
  end if;

  select coalesce(role, '') into v_role
  from public.players
  where id = new.player_id;

  if position('bowler' in lower(v_role)) = 0 then
    raise exception 'STATE_REJECTED: nominated player must be a bowler';
  end if;

  return new;
end; $$;

drop trigger if exists team_non_regular_bowlers_validate on public.team_non_regular_bowlers;
create trigger team_non_regular_bowlers_validate
  before insert or update on public.team_non_regular_bowlers
  for each row execute function public.trg_validate_non_regular_bowler();

create or replace function public.set_non_regular_bowlers(
  p_team_id uuid,
  p_player_ids uuid[]
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_caller uuid;
  v_ids uuid[];
  v_id uuid;
begin
  if not public.can_place_bid_for_team(p_team_id) then
    raise exception 'AUTH_REQUIRED: cannot manage nominations for this team';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'STATE_REJECTED: team not found';
  end if;

  select id into v_caller from public.profiles where user_id = auth.uid();

  select coalesce(array_agg(distinct id), '{}') into v_ids
  from unnest(coalesce(p_player_ids, '{}')) as id;

  if cardinality(v_ids) > 2 then
    raise exception 'STATE_REJECTED: a team can nominate at most two non-regular bowlers';
  end if;

  delete from public.team_non_regular_bowlers
  where auction_id = v_team.auction_id and team_id = p_team_id;

  foreach v_id in array v_ids loop
    insert into public.team_non_regular_bowlers(auction_id, team_id, player_id, created_by)
    values (v_team.auction_id, p_team_id, v_id, v_caller);
  end loop;
end; $$;

revoke all on function public.pause_current_clock(uuid) from public;
revoke all on function public.resume_current_clock(uuid) from public;
revoke all on function public.set_non_regular_bowlers(uuid, uuid[]) from public;

grant execute on function public.pause_current_clock(uuid) to authenticated;
grant execute on function public.resume_current_clock(uuid) to authenticated;
grant execute on function public.set_non_regular_bowlers(uuid, uuid[]) to authenticated;

grant select on public.team_non_regular_bowlers to anon, authenticated;
