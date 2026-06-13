-- Allow non-regular tagging for any sold player (max 2 per team).
create or replace function public.trg_validate_non_regular_bowler()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.team_non_regular_bowlers
  where auction_id = new.auction_id
    and team_id = new.team_id
    and id <> coalesce(new.id, gen_random_uuid());

  if v_count >= 2 then
    raise exception 'STATE_REJECTED: a team can tag at most two non-regular players';
  end if;

  if not exists (
    select 1
    from public.sold_players sp
    where sp.auction_id = new.auction_id
      and sp.team_id = new.team_id
      and sp.player_id = new.player_id
      and sp.reauctioned = false
  ) then
    raise exception 'STATE_REJECTED: tagged player must be actively sold to this team';
  end if;

  return new;
end; $$;

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
    raise exception 'AUTH_REQUIRED: cannot manage non-regular tags for this team';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'STATE_REJECTED: team not found';
  end if;

  select id into v_caller from public.profiles where user_id = auth.uid();

  select coalesce(array_agg(distinct id), '{}') into v_ids
  from unnest(coalesce(p_player_ids, '{}')) as id;

  if cardinality(v_ids) > 2 then
    raise exception 'STATE_REJECTED: a team can tag at most two non-regular players';
  end if;

  delete from public.team_non_regular_bowlers
  where auction_id = v_team.auction_id and team_id = p_team_id;

  foreach v_id in array v_ids loop
    insert into public.team_non_regular_bowlers(auction_id, team_id, player_id, created_by)
    values (v_team.auction_id, p_team_id, v_id, v_caller);
  end loop;
end; $$;
