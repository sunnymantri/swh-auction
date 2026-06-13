-- Add optional public access code to auctions.
-- When set, visitors must supply this code to view public pages.
-- When null/empty, public pages remain openly accessible.
alter table public.auctions add column if not exists public_code text;

create or replace function public.verify_public_code(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  -- If no auction has a public_code configured, access is open for any code (including blank).
  -- If at least one auction has a code set, the supplied code must match one of them.
  select case
    when not exists (
      select 1 from public.auctions where public_code is not null and public_code <> ''
    ) then true
    else exists (
      select 1 from public.auctions
      where public_code = p_code and public_code is not null and public_code <> ''
    )
  end;
$$;

grant execute on function public.verify_public_code(text) to anon, authenticated;
