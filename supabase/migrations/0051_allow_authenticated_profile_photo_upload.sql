-- Allow any authenticated user to upload their own profile photo.
--
-- The "Edit my profile → Upload photo" flow (used by team owners, not just
-- admins) writes to the player-photos storage bucket via uploadUserPhoto().
-- The original 0003_storage policies gated ALL writes to that bucket behind
-- public.is_admin(), so non-admins hit
--   "new row violates row-level security policy"
-- on storage.objects when uploading. (Admins worked, hence the inconsistency.)
--
-- Fix: allow authenticated INSERT into player-photos. Uploads use unique
-- timestamped object names, so this can't clobber existing photos. UPDATE and
-- DELETE stay restricted — to the original admin path OR the object's own
-- uploader (storage.objects.owner) so a user can replace/remove what they put
-- there. Player-photo management by admins is unchanged.

-- Replace the admin-only insert with an authenticated insert.
drop policy if exists "admin write player-photos" on storage.objects;

create policy "authenticated write player-photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'player-photos');

-- Broaden update/delete to admins OR the original uploader.
drop policy if exists "admin update player-photos" on storage.objects;
create policy "admin or owner update player-photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'player-photos' and (public.is_admin() or owner = auth.uid()));

drop policy if exists "admin delete player-photos" on storage.objects;
create policy "admin or owner delete player-photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'player-photos' and (public.is_admin() or owner = auth.uid()));
