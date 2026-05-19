-- Server-side validation on waitlist (CHECK constraints).
-- Catches malformed emails before they hit the table, and caps source/user_agent
-- lengths so a bot can't fill the table with junk.

alter table public.waitlist
  add constraint waitlist_email_format check (
    email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and length(email) between 5 and 254
  ),
  add constraint waitlist_source_short check (source is null or length(source) <= 32),
  add constraint waitlist_user_agent_short check (user_agent is null or length(user_agent) <= 1024);
