-- Support many users linked to one team while enforcing one bidder per team.

alter table public.profiles
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists idx_profiles_team_id on public.profiles(team_id);

-- Backfill existing team-owner links into profiles.team_id.
update public.profiles p
set team_id = t.id
from public.teams t
where t.owner_user_id = p.id
  and p.team_id is null;

comment on column public.profiles.team_id is
  'Optional team linkage for visibility/access. Multiple users may share one team link.';
