-- =====================================================================
--  Cricket Auction App  •  0015_player_status_simplification.sql
--  Simplify player statuses to a cleaner set:
--
--  User-managed:
--    not_registered   – player exists in system but hasn't registered
--    registered       – player has registered (waiting for approval)
--    ready_for_auction – approved and ready to be put up for auction
--    sold             – sold at auction
--    unsold           – went through auction, not sold
--
--  System-managed (set by auction engine):
--    in_auction       – currently on the block
--    reauction        – marked for re-auction
--
--  Migration plan:
--    'auction' (old)  →  'ready_for_auction' (new)
--    All others stay the same.
-- =====================================================================

-- 1. Drop the old check constraint
alter table public.players
  drop constraint if exists players_status_check;

-- 2. Rename existing 'auction' rows to 'ready_for_auction'
update public.players
  set status = 'ready_for_auction'
  where status = 'auction';

-- 3. Add the new constraint
alter table public.players
  add constraint players_status_check
  check (status in (
    'not_registered',
    'registered',
    'ready_for_auction',
    'in_auction',
    'sold',
    'unsold',
    'reauction'
  ));

comment on column public.players.status is
  'not_registered | registered | ready_for_auction | in_auction | sold | unsold | reauction';
