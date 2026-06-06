-- =====================================================================
--  Cricket Auction App  •  0003_storage.sql
--  Storage buckets for player photos & team logos
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true),
       ('team-logos',    'team-logos',    true)
on conflict (id) do nothing;

-- Public read (images render in the public live view)
create policy "read player-photos" on storage.objects
  for select using (bucket_id = 'player-photos');

create policy "read team-logos" on storage.objects
  for select using (bucket_id = 'team-logos');

-- Admin-only write (insert / update / delete) for both buckets
create policy "admin write player-photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'player-photos' and public.is_admin());

create policy "admin update player-photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'player-photos' and public.is_admin());

create policy "admin delete player-photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'player-photos' and public.is_admin());

create policy "admin write team-logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-logos' and public.is_admin());

create policy "admin update team-logos" on storage.objects
  for update to authenticated
  using (bucket_id = 'team-logos' and public.is_admin());

create policy "admin delete team-logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'team-logos' and public.is_admin());
