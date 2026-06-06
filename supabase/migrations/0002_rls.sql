-- =====================================================================
--  Cricket Auction App  •  0002_rls.sql
--  Role helper functions + Row Level Security policies
--
--  Model:
--    * READ  -> public (anon + authenticated).  The live view, scoreboard
--               and results are meant to be projected / shared, so all
--               auction data is world-readable.  profiles is the only
--               table restricted to authenticated users.
--    * WRITE -> admin only, EXCEPT bids which a team_owner may insert for
--               their own team.  All multi-row state changes (sold,
--               unsold, re-auction, place_bid) go through SECURITY DEFINER
--               functions in 0004_logic.sql, which is the only sanctioned
--               write path for sold_players / auction_events.
--
--  DEMO NOTE: see README "Demo mode" for running the role-selector demo
--  without seeding real auth users.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers  (SECURITY DEFINER so they can read profiles safely)
-- ---------------------------------------------------------------------
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.profiles where user_id = auth.uid()),
    'public'
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.owns_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teams t
    join public.profiles p on p.id = t.owner_user_id
    where t.id = p_team_id and p.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.auctions          enable row level security;
alter table public.teams             enable row level security;
alter table public.players           enable row level security;
alter table public.player_categories enable row level security;
alter table public.bids              enable row level security;
alter table public.auction_events    enable row level security;
alter table public.sold_players      enable row level security;
alter table public.auction_queue     enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_read_auth on public.profiles
  for select to authenticated using (true);

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Generic "public read / admin write" helper applied per table.
-- (Written out explicitly so each table is self-documenting.)
-- ---------------------------------------------------------------------

-- auctions
create policy auctions_read   on public.auctions for select using (true);
create policy auctions_write  on public.auctions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- teams
create policy teams_read      on public.teams for select using (true);
create policy teams_write     on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- players
create policy players_read    on public.players for select using (true);
create policy players_write   on public.players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- player_categories
create policy categories_read  on public.player_categories for select using (true);
create policy categories_write on public.player_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- auction_queue
create policy queue_read      on public.auction_queue for select using (true);
create policy queue_write     on public.auction_queue for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- bids  (read public; insert by admin OR the owning team; no update/delete)
create policy bids_read       on public.bids for select using (true);
create policy bids_insert     on public.bids for insert to authenticated
  with check (public.is_admin() or public.owns_team(team_id));

-- auction_events  (read public; direct writes admin only - functions use definer)
create policy events_read     on public.auction_events for select using (true);
create policy events_write    on public.auction_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- sold_players  (read public; direct writes admin only - functions use definer)
create policy sold_read       on public.sold_players for select using (true);
create policy sold_write      on public.sold_players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
