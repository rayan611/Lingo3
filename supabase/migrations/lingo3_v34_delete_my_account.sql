-- v3.4 — account deletion from inside the app.
--
-- NOT APPLIED BY CLAUDE: the Supabase connector refuses to run statements that
-- delete, so this one has to be pasted into the SQL editor by hand. Until it
-- is, the Delete account flow in Settings reaches its last step and fails with
-- "function does not exist" — nothing is lost, it simply cannot complete.
--
-- The later_words line was added by hand in v3.6 (see that migration); this
-- file now matches what is live.
--
-- Required by Apple for any app with accounts, and by Google as a documented
-- deletion route.
--
-- Three things keep this narrow:
--   1. No arguments. The caller cannot name a victim: the function reads
--      auth.uid() and deletes that and nothing else.
--   2. search_path is pinned. A SECURITY DEFINER function with a
--      caller-controlled search_path is an escalation route.
--   3. Execute is revoked from anon, so a signed-out caller cannot reach it.
--
-- SECURITY DEFINER is unavoidable here: auth.users is not writable by the
-- caller. The alternative was a serverless endpoint holding the service-role
-- key, which bypasses row-level security for every table and every user and
-- would live in an environment variable next to a public site — a far larger
-- thing to get wrong than one function that can only delete its own caller.
--
-- The auth row is deleted too. Rows gone but user kept would mean the email
-- can never sign up again and the account is not gone in any sense the person
-- would recognise.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_my_account: no signed-in user';
  end if;

  delete from public.review_log    where user_id = uid;
  delete from public.cards         where user_id = uid;
  delete from public.entries       where user_id = uid;
  delete from public.concepts      where user_id = uid;
  delete from public.stories       where user_id = uid;
  delete from public.suggestions   where user_id = uid;
  delete from public.later_words   where user_id = uid;
  delete from public.user_settings where user_id = uid;

  -- Last: once this row is gone the caller's token refers to nobody, so
  -- anything after it would run without an auth.uid().
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
