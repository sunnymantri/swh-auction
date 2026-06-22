-- Prevent bypassing re-auction workflow by directly moving sold players to
-- ready_for_auction through ad-hoc updates.

create or replace function public.trg_guard_sold_ready_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.status = 'sold'
     and new.status = 'ready_for_auction' then
    raise exception 'STATE_REJECTED: sold player must be moved via re-auction workflow';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_sold_ready_transition on public.players;
create trigger guard_sold_ready_transition
before update of status on public.players
for each row
execute function public.trg_guard_sold_ready_transition();
