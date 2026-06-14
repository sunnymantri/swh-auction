-- Add optional profile photo for header avatar and user management editing.
alter table public.profiles
  add column if not exists photo_url text;
