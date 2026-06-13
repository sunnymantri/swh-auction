alter table public.players drop constraint if exists players_status_check;
alter table public.players add constraint players_status_check
  check (status in (
    'not_registered','registered','ready_for_auction',
    'in_auction','sold','unsold','reauction','retired'
  ));
comment on column public.players.status is
  'not_registered | registered | ready_for_auction | in_auction | sold | unsold | reauction | retired';
