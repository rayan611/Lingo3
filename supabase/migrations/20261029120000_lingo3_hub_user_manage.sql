-- lingo3_hub_user_manage
--
-- Brings the Rayan control center's user actions into the repository (the
-- function existed only in the live database) and makes suspend real:
--
--   delete     the auth user; every Lingo3 table cascades from auth.users
--   suspend    auth.users.banned_until far in the future (Supabase Auth then
--              refuses sign-in and token refresh) and every session ended
--   unsuspend  banned_until cleared
--
-- Answers { ok, suspended } for suspend/unsuspend, which is how the hub
-- knows the action really happened. Passwords are never set through the
-- hub; any other action is refused. The user list also reports suspended.

create or replace function public.hub_call(p_token text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, pg_catalog as $$
declare
  ok boolean;
  lim int := least(greatest(coalesce((p_args->>'limit')::int, 50), 1), 500);
  off int := least(greatest(coalesce((p_args->>'offset')::int, 0), 0), 100000);
  q text := nullif(trim(coalesce(p_args->>'q', '')), '');
  r jsonb;
begin
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') = token_hash into ok
  from public.hub_access where id = 1;
  if not coalesce(ok, false) then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_op = 'health' then
    return jsonb_build_object('ok', true, 'time', now());

  elsif p_op = 'stats' then
    return jsonb_build_object(
      'users', jsonb_build_object(
        'total', (select count(*) from auth.users),
        'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
        'new_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
        'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days')),
      'db_bytes', pg_database_size(current_database()),
      'feedback', jsonb_build_object(
        'new', (select count(*) from public.suggestions where status = 'new'),
        'total', (select count(*) from public.suggestions)),
      'ai', (select coalesce(jsonb_object_agg(endpoint || '_7d', n), '{}'::jsonb)
             from (select endpoint, sum(request_count) as n from public.ai_rate_limits
                   where window_start > now() - interval '7 days' group by endpoint) a),
      'extra', jsonb_build_object(
        'cards', (select count(*) from public.cards),
        'reviews_7d', (select count(*) from public.review_log where reviewed_at > now() - interval '7 days')));

  elsif p_op = 'users' then
    select jsonb_build_object(
      'total', (select count(*) from auth.users u left join public.user_settings s on s.user_id = u.id
                where q is null or u.email ilike '%' || q || '%' or s.display_name ilike '%' || q || '%'),
      'items', coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb))
    into r
    from (select u.id, s.display_name as name, u.email, u.created_at, u.last_sign_in_at as last_active,
                 coalesce(u.banned_until > now(), false) as suspended
          from auth.users u left join public.user_settings s on s.user_id = u.id
          where q is null or u.email ilike '%' || q || '%' or s.display_name ilike '%' || q || '%'
          order by u.created_at desc limit lim offset off) x;
    return r;

  elsif p_op = 'feedback' then
    select jsonb_build_object('items', coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)) into r
    from (select g.id, 'suggestion' as kind, g.body as message, g.context as page,
                 s.display_name as name, u.email,
                 case g.status when 'dismissed' then 'done' else g.status end as status,
                 g.created_at
          from public.suggestions g
          left join auth.users u on u.id = g.user_id
          left join public.user_settings s on s.user_id = g.user_id
          order by g.created_at desc limit lim) x;
    return r;

  else
    raise exception 'unknown op %', p_op;
  end if;
end $$;
revoke execute on function public.hub_call(text, text, jsonb) from public;
grant execute on function public.hub_call(text, text, jsonb) to anon, authenticated;

drop function if exists public.hub_user_manage(text, text, uuid, text, text);
create function public.hub_user_manage(p_token text, p_action text, p_user_id uuid default null,
                                       p_email text default null, p_password text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare ok boolean; uid uuid;
begin
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') = token_hash into ok
  from public.hub_access where id = 1;
  if not coalesce(ok, false) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- By id only: an e-mail could match the wrong account.
  select id into uid from auth.users where id = p_user_id;
  if uid is null then raise exception 'user_not_found'; end if;

  if p_action = 'delete' then
    delete from auth.users where id = uid;
    return jsonb_build_object('ok', true);
  elsif p_action = 'suspend' then
    update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = uid;
    delete from auth.sessions where user_id = uid;
    return jsonb_build_object('ok', true, 'suspended', true);
  elsif p_action = 'unsuspend' then
    update auth.users set banned_until = null, updated_at = now() where id = uid;
    return jsonb_build_object('ok', true, 'suspended', false);
  else
    raise exception 'unsupported_action';
  end if;
end $$;
revoke execute on function public.hub_user_manage(text, text, uuid, text, text) from public, authenticated;
grant execute on function public.hub_user_manage(text, text, uuid, text, text) to anon;

notify pgrst, 'reload schema';
