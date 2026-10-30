-- lingo3_hub_audit_tts_limit
--
-- Two fixes from the 2026-10-30 audit, both additive:
--
-- 1. Every user action the Rayan control center takes (delete, suspend,
--    unsuspend, feedback status) is written to public.hub_audit, and deletes
--    through the hub are capped at 3 an hour and suspends at 20. The hub
--    token can be called by anyone who holds it; if it ever leaks, this caps
--    the damage to a handful of accounts and leaves a record of which.
--    The audit row keeps the email, because after a delete nothing else does.
--    Readable by admins only, writable by nobody but these functions.
--
-- 2. Speech (api/tts.ts) gets its own hourly bucket, 300 a user, in the same
--    consume_ai_rate_limit() the AI endpoints use. Apply this BEFORE deploying
--    the api/tts.ts that calls it: the limiter fails closed in production.

create table if not exists public.hub_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  target uuid,
  detail jsonb not null default '{}'::jsonb
);
alter table public.hub_audit enable row level security;
revoke all on public.hub_audit from anon, authenticated;
grant select on public.hub_audit to authenticated;
drop policy if exists hub_audit_admin_read on public.hub_audit;
create policy hub_audit_admin_read on public.hub_audit
  for select to authenticated using ((select public.is_admin()));
create index if not exists hub_audit_action_at_idx on public.hub_audit (action, at desc);

create or replace function public.hub_user_manage(
  p_token text, p_action text, p_user_id uuid default null,
  p_email text default null, p_password text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare ok boolean; uid uuid; mail text; recent int;
begin
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') = token_hash into ok
  from public.hub_access where id = 1;
  if not coalesce(ok, false) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- By id only: an e-mail could match the wrong account.
  select id, email into uid, mail from auth.users where id = p_user_id;
  if uid is null then raise exception 'user_not_found'; end if;

  if p_action in ('delete', 'suspend') then
    select count(*) into recent from public.hub_audit
    where action = p_action and at > now() - interval '1 hour';
    -- Not a CASE expression here: PL/pgSQL ends an IF condition at the first THEN.
    if (p_action = 'delete' and recent >= 3) or (p_action = 'suspend' and recent >= 20) then
      raise exception 'too_many_%s_this_hour', p_action using errcode = '54000';
    end if;
  end if;

  if p_action = 'delete' then
    insert into public.hub_audit (action, target, detail) values ('delete', uid, jsonb_build_object('email', mail));
    delete from auth.users where id = uid;
    return jsonb_build_object('ok', true);
  elsif p_action = 'suspend' then
    insert into public.hub_audit (action, target, detail) values ('suspend', uid, jsonb_build_object('email', mail));
    update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = uid;
    delete from auth.sessions where user_id = uid;
    return jsonb_build_object('ok', true, 'suspended', true);
  elsif p_action = 'unsuspend' then
    insert into public.hub_audit (action, target, detail) values ('unsuspend', uid, jsonb_build_object('email', mail));
    update auth.users set banned_until = null, updated_at = now() where id = uid;
    return jsonb_build_object('ok', true, 'suspended', false);
  else
    raise exception 'unsupported_action';
  end if;
end;
$$;
revoke all on function public.hub_user_manage(text, text, uuid, text, text) from public, authenticated;
grant execute on function public.hub_user_manage(text, text, uuid, text, text) to anon;

create or replace function public.hub_feedback_status(p_token text, p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare ok boolean;
begin
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') = token_hash into ok
  from public.hub_access where id = 1;
  if not coalesce(ok, false) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('new', 'read', 'done') then raise exception 'bad status'; end if;
  insert into public.hub_audit (action, detail) values ('feedback_status', jsonb_build_object('id', p_id, 'status', p_status));
  update public.suggestions set status = p_status, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.consume_ai_rate_limit(p_endpoint text)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz := date_trunc('hour', now());
  v_limit integer;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_endpoint = 'expand' then
    v_limit := 80;
  elsif p_endpoint = 'story' then
    v_limit := 20;
  elsif p_endpoint = 'translate' then
    v_limit := 60;
  elsif p_endpoint = 'tts' then
    v_limit := 300;
  else
    raise exception 'Unknown AI endpoint';
  end if;
  insert into public.ai_rate_limits (user_id, endpoint, window_start, request_count)
  values (v_user_id, p_endpoint, v_window_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set request_count = public.ai_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= v_limit;
end;
$$;
