-- Lock down the waitlist table: anon can INSERT, no one else can read via REST.
--
-- An older permissive SELECT policy ("Anyone can read waitlist count") was
-- letting anyone with the public anon key dump the entire email list. The
-- intent was probably to show a live signup count on the landing, but it
-- exposed individual emails too.
--
-- Result: INSERT still works for the signup form. SELECT via the public
-- anon key returns []. Adam reads the list via Supabase dashboard /
-- service_role.

drop policy if exists "Anyone can read waitlist count" on public.waitlist;
drop policy if exists "Anyone can join waitlist" on public.waitlist;

-- Keep a single canonical INSERT policy.
drop policy if exists "Anyone can sign up" on public.waitlist;
create policy "Anyone can sign up" on public.waitlist
  for insert to anon, authenticated
  with check (true);
