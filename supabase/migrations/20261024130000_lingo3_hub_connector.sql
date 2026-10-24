-- lingo3_hub_connector
--
-- Connects Lingo3 to the Rayan control center (rayan611.vercel.app): numbers,
-- the user list and the suggestion box, through public.hub_call(), plus
-- public.hub_feedback_status() to mark a suggestion read or done.
--
-- Both can be called with the publishable key and do nothing without the
-- hub's secret token. Only the SHA-256 hash of the token is stored, in a
-- table with RLS on and no policies, so the API cannot read it. The hub
-- sees no cards, words, stories or review history.
--
-- A trigger pokes the hub when a suggestion arrives (pg_net, no data in
-- the call) so the red dot there lights up at once.

create extension if not exists pg_net with schema extensions;

create table if not exists public.hub_access (
  id         int primary key default 1 check (id = 1),
  token_hash text not null,
  hub_url    text not null default 'https://rayan611.vercel.app',
  app_id     text not null default 'lingo3',
  updated_at timestamptz not null default now()
);
alter table public.hub_access enable row level security;
revoke all on public.hub_access from anon, authenticated;

create or replace function public.hub_set_token_hash(p_hash text)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'expected a sha-256 hex hash'; end if;
  insert into public.hub_access (id, token_hash) values (1, p_hash)
  on conflict (id) do update set token_hash = excluded.token_hash, updated_at = now();
end $$;
revoke execute on function public.hub_set_token_hash(text) from public, anon, authenticated;

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
    from (select u.id, s.display_name as name, u.email, u.created_at, u.last_sign_in_at as last_active
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

create or replace function public.hub_feedback_status(p_token text, p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare ok boolean;
begin
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') = token_hash into ok
  from public.hub_access where id = 1;
  if not coalesce(ok, false) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('new', 'read', 'done') then raise exception 'bad status'; end if;
  update public.suggestions set status = p_status, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.hub_feedback_status(text, uuid, text) from public;
grant execute on function public.hub_feedback_status(text, uuid, text) to anon, authenticated;

create or replace function public.hub_poke() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
declare u text; a text;
begin
  select hub_url, app_id into u, a from public.hub_access where id = 1;
  if u is not null then
    begin
      perform net.http_post(url := u || '/api/ingest/' || a, body := '{}'::jsonb, timeout_milliseconds := 3000);
    exception when others then null;
    end;
  end if;
  return null;
end $$;
revoke execute on function public.hub_poke() from public, anon, authenticated;

drop trigger if exists hub_poke_suggestions on public.suggestions;
create trigger hub_poke_suggestions after insert on public.suggestions
  for each statement execute function public.hub_poke();

notify pgrst, 'reload schema';
