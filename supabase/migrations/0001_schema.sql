-- =====================================================================
--  Cricket Auction App  •  0001_schema.sql
--  Core tables, types and indexes
--  Run order: 0001 -> 0002 -> 0003 -> 0004 -> 0005, then seed.sql
-- =====================================================================

create extension if not exists "pgcrypto";   -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- profiles  (1 row per auth user; role drives all RLS)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'public'
              check (role in ('admin','team_owner','public')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- auctions  (the master config for one auction event)
-- ---------------------------------------------------------------------
create table public.auctions (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  season                   text,
  sport                    text   not null default 'Cricket',
  auction_date             date,
  auction_time             time,
  status                   text   not null default 'draft'
                           check (status in ('draft','live','paused','completed')),
  total_teams              int    not null default 0,
  squad_size               int    not null default 11,
  default_team_budget      bigint not null default 100000,
  default_base_price       bigint not null default 100,
  default_bid_increment    bigint not null default 100,
  min_player_price         bigint not null default 100,
  reauction_refund_enabled boolean not null default true,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- teams
--   points_spent / points_remaining are MAINTAINED BY TRIGGER
--   (see 0004_logic.sql) - never write them by hand.
--   owner_user_id links a team to a profile so a team owner can only
--   bid for their own team under RLS.
-- ---------------------------------------------------------------------
create table public.teams (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references public.auctions(id) on delete cascade,
  name             text not null,
  short_name       text,
  logo_url         text,
  owner_name       text,
  owner_email      text,
  owner_user_id    uuid references public.profiles(id),
  total_budget     bigint not null default 100000,
  points_spent     bigint not null default 0,
  points_remaining bigint not null default 0,
  max_players      int    not null default 11,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------
create table public.players (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references public.auctions(id) on delete cascade,
  name             text not null,
  photo_url        text,
  email            text,
  phone            text,
  role             text,                       -- Batter / Bowler / All-rounder / Wicketkeeper
  category         text,                       -- maps to player_categories.name
  batting_style    text,
  bowling_style    text,
  matches          int default 0,
  runs             int default 0,
  wickets          int default 0,
  catches          int default 0,
  strike_rate      numeric(6,2) default 0,
  economy          numeric(6,2) default 0,
  base_price       bigint not null default 100,
  calculated_value bigint,
  status           text not null default 'registered'
                   check (status in ('registered','approved','in_auction','sold','unsold','reauction')),
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- player_categories  (defines auction sequence + min/max rules)
-- ---------------------------------------------------------------------
create table public.player_categories (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references public.auctions(id) on delete cascade,
  name             text not null,
  sequence_order   int  not null default 0,
  minimum_required int  default 0,
  maximum_allowed  int,
  created_at       timestamptz not null default now(),
  unique (auction_id, name)
);

-- ---------------------------------------------------------------------
-- bids  (append-only ledger of every bid)
-- ---------------------------------------------------------------------
create table public.bids (
  id           uuid primary key default gen_random_uuid(),
  auction_id   uuid not null references public.auctions(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  team_id      uuid references public.teams(id) on delete set null,
  bid_amount   bigint not null,
  bid_type     text   not null default 'team_bid'
               check (bid_type in ('team_bid','auctioneer_manual_bid')),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- auction_events  (full audit trail for the activity feed)
-- ---------------------------------------------------------------------
create table public.auction_events (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references public.auctions(id) on delete cascade,
  player_id   uuid references public.players(id) on delete set null,
  event_type  text not null
              check (event_type in ('player_started','bid_placed','sold','unsold','reauctioned','skipped')),
  team_id     uuid references public.teams(id) on delete set null,
  amount      bigint,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- sold_players  (transactional record of purchases; drives team spend)
--   reauctioned = true means the sale was reversed.
--   original_sale_id chains a re-sold player back to its first sale.
-- ---------------------------------------------------------------------
create table public.sold_players (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references public.auctions(id) on delete cascade,
  player_id        uuid not null references public.players(id) on delete cascade,
  team_id          uuid not null references public.teams(id) on delete cascade,
  sold_price       bigint not null,
  sold_at          timestamptz not null default now(),
  reauctioned      boolean not null default false,
  original_sale_id uuid references public.sold_players(id) on delete set null
);

-- ---------------------------------------------------------------------
-- auction_queue  (ordered run sheet; one player is 'current' at a time)
-- ---------------------------------------------------------------------
create table public.auction_queue (
  id           uuid primary key default gen_random_uuid(),
  auction_id   uuid not null references public.auctions(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  category     text,
  queue_order  int  not null default 0,
  status       text not null default 'pending'
               check (status in ('pending','current','completed','skipped','reauction')),
  created_at   timestamptz not null default now(),
  unique (auction_id, player_id)
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index idx_profiles_user        on public.profiles(user_id);
create index idx_teams_auction        on public.teams(auction_id);
create index idx_players_auction      on public.players(auction_id);
create index idx_players_status       on public.players(auction_id, status);
create index idx_categories_auction   on public.player_categories(auction_id, sequence_order);
create index idx_bids_player          on public.bids(player_id, created_at desc);
create index idx_bids_auction         on public.bids(auction_id);
create index idx_events_auction       on public.auction_events(auction_id, created_at desc);
create index idx_sold_team_active     on public.sold_players(team_id) where reauctioned = false;
create index idx_sold_auction         on public.sold_players(auction_id);
create index idx_queue_auction_order  on public.auction_queue(auction_id, queue_order);
create index idx_queue_status         on public.auction_queue(auction_id, status);
