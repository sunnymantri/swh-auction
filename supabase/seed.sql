-- =====================================================================
--  Cricket Auction App  •  seed.sql
--  Demo data: 1 live auction, 4 categories, 6 teams, 30 players,
--  a generated queue, and the first player started.
--  All names/stats are FICTIONAL (no real players) for a club demo.
--  Run on a fresh DB AFTER 0001-0005. Safe to re-run (clears its own data).
-- =====================================================================

do $$
declare
  v_auction uuid := gen_random_uuid();
  v_teams   uuid[];
  v_names   text[] := array[
    'Liam Carter','Noah Bradman','Oliver Finch','Ethan Marsh','Jack Hollis',
    'Lucas Pereira','Mason Akhtar','Logan Reddy','Hudson Nair','Cooper Singh',
    'Riley Dawson','Aarav Menon','Kabir Joshi','Zane Mitchell','Felix Romano',
    'Dev Sharma','Harvey Lowe','Asher Kaur','Theo Vance','Rohan Iyer',
    'Beau Sutton','Ari Kapoor','Jasper Quinn','Vihaan Rao','Max Donnelly',
    'Eli Chaudhary','Reuben Frost','Ishaan Bose','Cody Walsh','Aryan Mehta'];
  v_roles  text[] := array['Wicketkeeper','Batter','All-rounder','Bowler'];
  v_cats   text[] := array['Wicketkeeper','Batter','All-rounder','Bowler'];
  v_team_names text[] := array[
    'Harbour Hawks','Western Warriors','Northern Knights','Coastal Cobras',
    'Summit Strikers','River City Royals'];
  v_team_short text[] := array['HAW','WAR','KNI','COB','STR','ROY'];
  i int;
  v_role text;
  v_cat  text;
  v_tid  uuid;
begin
  -- ---- auction ----
  insert into public.auctions(
    id, name, season, sport, auction_date, auction_time, status,
    total_teams, squad_size, default_team_budget, default_base_price,
    default_bid_increment, min_player_price, reauction_refund_enabled)
  values (
    v_auction, 'Club Championship Auction', 'Season 17', 'Cricket',
    current_date, '19:00', 'live',
    6, 7, 100000, 500, 500, 500, true);

  -- ---- categories (auction sequence) ----
  insert into public.player_categories(auction_id, name, sequence_order, minimum_required, maximum_allowed)
  values (v_auction,'Wicketkeeper',1,1,2),
         (v_auction,'Batter',2,2,4),
         (v_auction,'All-rounder',3,1,3),
         (v_auction,'Bowler',4,2,4);

  -- ---- teams ----
  for i in 1..6 loop
    insert into public.teams(auction_id, name, short_name, owner_name, owner_email,
                             total_budget, max_players)
    values (v_auction, v_team_names[i], v_team_short[i],
            v_team_names[i] || ' Owner',
            lower(v_team_short[i]) || '@example.com',
            100000, 7)
    returning id into v_tid;
    v_teams[i] := v_tid;
  end loop;

  -- ---- players (30, cycling role/category) ----
  for i in 1..30 loop
    v_role := v_roles[((i-1) % 4) + 1];
    v_cat  := v_cats[((i-1) % 4) + 1];
    insert into public.players(
      auction_id, name, role, category, batting_style, bowling_style,
      matches, runs, wickets, catches, strike_rate, economy,
      base_price, status)
    values (
      v_auction, v_names[i], v_role, v_cat,
      case when i % 3 = 0 then 'Left-hand bat' else 'Right-hand bat' end,
      case when v_role in ('Bowler','All-rounder')
           then (array['Right-arm fast','Left-arm orthodox','Right-arm offbreak','Leg break'])[((i-1)%4)+1]
           else null end,
      40 + (i * 3) % 80,                 -- matches
      300 + (i * 137) % 2500,            -- runs
      case when v_role in ('Bowler','All-rounder') then 20 + (i*7) % 90 else (i*2) % 15 end,
      5 + (i*3) % 40,                    -- catches
      round((105 + (i*7) % 60)::numeric, 2),   -- strike rate
      round((4 + (i*3) % 5)::numeric, 2),       -- economy
      case when i % 5 = 0 then 1500 when i % 3 = 0 then 1000 else 500 end,
      'auction');
  end loop;
end $$;

-- ---- build the run sheet, then start the first player ----
-- Inlined so seed.sql has no dependency on 0004_logic functions.
do $$
declare v_auction uuid;
declare v_first uuid;
begin
  select id into v_auction from public.auctions order by created_at desc limit 1;

  -- Build ordered queue from auction-eligible players (mirrors generate_queue logic).
  insert into public.auction_queue(auction_id, player_id, category, queue_order, status)
  select
    p.auction_id,
    p.id,
    p.category,
    row_number() over (
      order by coalesce(c.sequence_order, 999), p.base_price desc, p.name
    ),
    'pending'
  from public.players p
  left join public.player_categories c
    on  c.auction_id = p.auction_id
    and c.name       = p.category
  where p.auction_id = v_auction
    and p.status in ('auction', 'reauction', 'unsold');

  select player_id into v_first
  from public.auction_queue
  where auction_id = v_auction order by queue_order limit 1;

  update public.players set status = 'in_auction' where id = v_first;
  update public.auction_queue set status = 'current'
    where auction_id = v_auction and player_id = v_first;
  insert into public.auction_events(auction_id, player_id, event_type)
  values (v_auction, v_first, 'player_started');
end $$;
