-- Privacy mode for profiles
-- Run this once in the Supabase SQL Editor.
--
-- Values:
--   normal  - default. Workouts visible in feeds, leaderboards, gym feeds.
--   private - your workouts are hidden from others, but you can still see + Steel theirs.
--   solo    - no social at all. Hidden from others; social tabs hidden in your app.

alter table public.profiles
  add column if not exists privacy_mode text not null default 'normal'
    check (privacy_mode in ('normal', 'private', 'solo'));

create index if not exists profiles_privacy_mode_idx on public.profiles (privacy_mode);
