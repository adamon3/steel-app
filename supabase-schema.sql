-- ============================================
-- STEEL - Database Schema
-- Paste this ENTIRE file into Supabase SQL Editor
-- ============================================

-- 1. PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  bio text default '',
  sport text default '',
  gym text default '',
  avatar_url text default '',
  unit_pref text default 'kg' check (unit_pref in ('kg', 'lbs')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. EXERCISES (global library)
create table public.exercises (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  muscle_group text not null,
  is_custom boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 3. WORKOUTS
create table public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  notes text default '',
  duration_mins integer default 0,
  total_volume numeric default 0,
  total_sets integer default 0,
  has_pr boolean default false,
  is_public boolean default true,
  steeled_from uuid references public.workouts(id),
  created_at timestamptz default now()
);

-- 4. WORKOUT EXERCISES (exercises within a workout)
create table public.workout_exercises (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) not null,
  sort_order integer not null default 0,
  notes text default ''
);

-- 5. SETS (individual sets within a workout exercise)
create table public.sets (
  id uuid default gen_random_uuid() primary key,
  workout_exercise_id uuid references public.workout_exercises(id) on delete cascade not null,
  set_number integer not null,
  weight numeric not null default 0,
  reps integer not null default 0,
  is_pr boolean default false,
  set_type text default 'normal' check (set_type in ('normal', 'warmup', 'dropset', 'failure'))
);

-- 6. FOLLOWS
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- 7. LIKES
create table public.likes (
  user_id uuid references public.profiles(id) on delete cascade not null,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, workout_id)
);

-- 8. COMMENTS
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

-- Profiles: anyone can read, only owner can update
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Exercises: anyone can read, authenticated can create custom
create policy "Exercises are viewable by everyone" on public.exercises for select using (true);
create policy "Authenticated users can create exercises" on public.exercises for insert with check (auth.uid() = created_by);

-- Workouts: public ones visible to all, owner can CRUD
create policy "Public workouts are viewable" on public.workouts for select using (is_public = true or auth.uid() = user_id);
create policy "Users can create workouts" on public.workouts for insert with check (auth.uid() = user_id);
create policy "Users can update own workouts" on public.workouts for update using (auth.uid() = user_id);
create policy "Users can delete own workouts" on public.workouts for delete using (auth.uid() = user_id);

-- Workout exercises: visible if workout is visible
create policy "Workout exercises visible with workout" on public.workout_exercises for select using (
  exists (select 1 from public.workouts w where w.id = workout_id and (w.is_public = true or w.user_id = auth.uid()))
);
create policy "Users can create workout exercises" on public.workout_exercises for insert with check (
  exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
);
create policy "Users can delete workout exercises" on public.workout_exercises for delete using (
  exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
);

-- Sets: visible if workout is visible
create policy "Sets visible with workout" on public.sets for select using (
  exists (select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and (w.is_public = true or w.user_id = auth.uid()))
);
create policy "Users can create sets" on public.sets for insert with check (
  exists (select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = auth.uid())
);
create policy "Users can delete sets" on public.sets for delete using (
  exists (select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = auth.uid())
);

-- Follows: anyone can see, authenticated can follow/unfollow
create policy "Follows are viewable" on public.follows for select using (true);
create policy "Users can follow" on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = follower_id);

-- Likes: anyone can see, authenticated can like/unlike
create policy "Likes are viewable" on public.likes for select using (true);
create policy "Users can like" on public.likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike" on public.likes for delete using (auth.uid() = user_id);

-- Comments: anyone can see, authenticated can create
create policy "Comments are viewable" on public.comments for select using (true);
create policy "Users can comment" on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- SEED EXERCISES (common gym exercises)
-- ============================================

insert into public.exercises (name, muscle_group) values
  ('Bench Press', 'Chest'),
  ('Incline Bench Press', 'Chest'),
  ('Incline DB Press', 'Chest'),
  ('Dumbbell Fly', 'Chest'),
  ('Cable Fly', 'Chest'),
  ('Push-ups', 'Chest'),
  ('Squat', 'Legs'),
  ('Front Squat', 'Legs'),
  ('Leg Press', 'Legs'),
  ('Leg Extension', 'Legs'),
  ('Leg Curl', 'Legs'),
  ('Romanian Deadlift', 'Legs'),
  ('Bulgarian Split Squat', 'Legs'),
  ('Calf Raise', 'Legs'),
  ('Deadlift', 'Back'),
  ('Barbell Row', 'Back'),
  ('Dumbbell Row', 'Back'),
  ('Pull-ups', 'Back'),
  ('Chin-ups', 'Back'),
  ('Lat Pulldown', 'Back'),
  ('Cable Row', 'Back'),
  ('T-Bar Row', 'Back'),
  ('Overhead Press', 'Shoulders'),
  ('Dumbbell Shoulder Press', 'Shoulders'),
  ('Lateral Raises', 'Shoulders'),
  ('Front Raises', 'Shoulders'),
  ('Face Pulls', 'Shoulders'),
  ('Rear Delt Fly', 'Shoulders'),
  ('Barbell Curl', 'Arms'),
  ('Dumbbell Curl', 'Arms'),
  ('Hammer Curl', 'Arms'),
  ('Tricep Pushdown', 'Arms'),
  ('Skull Crushers', 'Arms'),
  ('Tricep Dips', 'Arms'),
  ('Overhead Tricep Extension', 'Arms'),
  ('Plank', 'Core'),
  ('Cable Crunch', 'Core'),
  ('Hanging Leg Raise', 'Core'),
  ('Ab Rollout', 'Core'),
  ('Hip Thrust', 'Glutes'),
  ('Glute Bridge', 'Glutes');
