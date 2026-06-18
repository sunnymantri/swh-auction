-- Allow public vacation form submissions without granting full player-table update rights.
create or replace function public.submit_player_vacation(
  p_player_id uuid,
  p_vacation_dates jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players%rowtype;
  v_dates jsonb;
begin
  if p_player_id is null then
    raise exception 'STATE_REJECTED: player id is required';
  end if;

  if p_vacation_dates is null then
    v_dates := '[]'::jsonb;
  else
    v_dates := p_vacation_dates;
  end if;

  if jsonb_typeof(v_dates) <> 'array' then
    raise exception 'STATE_REJECTED: vacation dates must be a JSON array';
  end if;

  select *
  into v_player
  from public.players
  where id = p_player_id;

  if not found then
    raise exception 'STATE_REJECTED: player not found';
  end if;

  update public.players
  set vacation_dates = v_dates,
      weeks_away = jsonb_array_length(v_dates)
  where id = p_player_id;
end;
$$;

grant execute on function public.submit_player_vacation(uuid, jsonb) to anon, authenticated;
