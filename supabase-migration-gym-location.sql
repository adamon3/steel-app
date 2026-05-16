-- Gym location columns on profiles
-- Stores canonical name + OSM-derived coordinates + place_id when a user joins a gym
-- via the new Nominatim-backed typeahead. Existing rows are left null; users keep
-- their text gym name until they re-join through the new picker.

alter table public.profiles
  add column if not exists gym_lat numeric,
  add column if not exists gym_lng numeric,
  add column if not exists gym_place_id text;

create index if not exists profiles_gym_place_id_idx on public.profiles (gym_place_id);
create index if not exists profiles_gym_coords_idx on public.profiles (gym_lat, gym_lng);
