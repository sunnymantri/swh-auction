-- Prevent accidental owner reassignment by requiring explicit unlink first.
-- This guards all code paths (UI, edge functions, manual SQL updates).

create or replace function public.trg_guard_team_owner_reassignment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    -- Allow: initial link (null -> user), unlink (user -> null), no-op.
    -- Block: direct transfer from one user to another in a single update.
    if old.owner_user_id is not null
       and new.owner_user_id is not null
       and old.owner_user_id <> new.owner_user_id then
      raise exception 'STATE_REJECTED: team is already linked to another user; unlink first before reassigning';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_team_owner_reassignment on public.teams;
create trigger guard_team_owner_reassignment
before update of owner_user_id on public.teams
for each row
execute function public.trg_guard_team_owner_reassignment();
