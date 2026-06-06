-- =====================================================================
--  Cricket Auction App  •  0008_branding.sql
--  Banner + sponsor branding for auctions, and an optional team sponsor.
-- =====================================================================

alter table public.auctions
  add column if not exists banner_logo_url text,
  add column if not exists sponsor_logos   jsonb not null default '[]'::jsonb;

alter table public.teams
  add column if not exists sponsor_logo_url text;

-- Dedicated public bucket for banner + sponsor artwork.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "read branding" on storage.objects
  for select using (bucket_id = 'branding');

create policy "admin write branding" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin());

create policy "admin update branding" on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and public.is_admin());

create policy "admin delete branding" on storage.objects
  for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin());
