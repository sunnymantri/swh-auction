-- =====================================================================
--  Cricket Auction App  •  0040_bidrule_clarity_and_last_slot.sql
--
--  Three additive fixes (all CREATE OR REPLACE, no schema changes):
--
--   • Bug 6  — max_safe_bid_for_team: when a team needs only its LAST
--              slot, there is no further slot to protect, so the team may
--              bid its full remaining points (reserve nothing).
--
--   • Bug 8  — assert_category_ok: replace the cryptic category-minimum /
--              category-maximum rejection text with plain-English guidance.
--              The 'BID_REJECTED:' machine prefix is preserved so the
--              frontend rpc() wrapper keeps stripping it.
--
--   • Bug 12 — trg_validate_non_regular_bowler: clearer rejection text
--              when a tagged player is not in the team's active squad.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bug 6 — last-slot max safe bid.
--   slots_remaining = squad_size - active_sold_count
--     <= 0  -> 0      (squad full)
--      = 1  -> points_remaining        (nothing left to reserve for)
--     >= 2  -> floor(points_remaining - avg_base_cost * slots_remaining)
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
    when (select id from t) is null then 0                              -- team not found
    when (select squad_size from a) - (select c from sold) <= 0 then 0  -- squad full
    -- Last slot: no future slot to reserve for, so the whole budget is safe.
    when (select squad_size from a) - (select c from sold) = 1
      then greatest((select points_remaining from t), 0)
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
-- Bug 8 — plain-English category-rule rejections.
--   Body is unchanged from 0033 except the two RAISE EXCEPTION texts.
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
        raise exception
          'BID_REJECTED: Your squad already has the maximum of % "%" player(s) allowed. You can''t add another from this category.',
          v_cat_max, v_cat;
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
      'BID_REJECTED: Buying this player would leave only % squad slot(s), but your team still needs % more player(s) from required categories. Buy from a still-required category or free up a slot first.',
      v_slots_after, v_needed;
  end if;
end; $$;

revoke all on function public.assert_category_ok(uuid, uuid) from public;
grant execute on function public.assert_category_ok(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Bug 12 — clearer non-regular tagging rejection.
--   Body unchanged from 0037 except the two RAISE EXCEPTION texts.
-- ---------------------------------------------------------------------
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
    raise exception 'STATE_REJECTED: A team can tag at most two non-regular players.';
  end if;

  if not exists (
    select 1
    from public.sold_players sp
    where sp.auction_id = new.auction_id
      and sp.team_id = new.team_id
      and sp.player_id = new.player_id
      and sp.reauctioned = false
  ) then
    raise exception 'STATE_REJECTED: You can only tag a player who is currently in this team''s squad. Buy the player first, and don''t tag players who were re-auctioned away.';
  end if;

  return new;
end; $$;
