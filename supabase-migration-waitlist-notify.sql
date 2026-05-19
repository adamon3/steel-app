-- Push notification on new waitlist signup via ntfy.sh
-- Topic 'steel-signups-7k9x2qp4mr' — hard-to-guess so randos can't snoop.
-- Adam subscribes via the ntfy app on his phone.
--
-- Requires pg_net extension (enabled here in case it isn't already).

create extension if not exists pg_net;

create or replace function public.notify_waitlist_signup()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://ntfy.sh',
    body := jsonb_build_object(
      'topic', 'steel-signups-7k9x2qp4mr',
      'title', 'New Steel waitlist signup',
      'message', NEW.email || ' (' || coalesce(NEW.source, 'unknown') || ')',
      'tags', jsonb_build_array('tada'),
      'click', 'https://supabase.com/dashboard/project/tkrwctmzftnmdspioohw/editor'
    )
  );
  return NEW;
end;
$$;

drop trigger if exists waitlist_signup_notify on public.waitlist;
create trigger waitlist_signup_notify
  after insert on public.waitlist
  for each row execute function public.notify_waitlist_signup();
