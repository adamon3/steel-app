-- Waitlist table for landing-page email signups
-- Anon role can INSERT only (no SELECT) — Adam views via dashboard/service role.

create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  source text default 'landing',
  user_agent text,
  created_at timestamptz default now()
);

create unique index if not exists waitlist_email_lower_idx on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can sign up" on public.waitlist;
create policy "Anyone can sign up" on public.waitlist
  for insert to anon, authenticated
  with check (true);
