-- Quick translate (v3.7). Additive only: safe for the production app that
-- shares this database, which simply ignores the new columns.

-- 1) The translator's own languages, synced like the other account prefs.
alter table public.user_settings
  add column if not exists translate_from text,
  add column if not exists translate_to text[];

-- 2) Its own hourly AI cap.
alter table public.ai_rate_limits
  drop constraint if exists ai_rate_limits_endpoint_check;
alter table public.ai_rate_limits
  add constraint ai_rate_limits_endpoint_check
  check (endpoint in ('expand', 'story', 'translate'));

create or replace function public.consume_ai_rate_limit(p_endpoint text)
returns boolean
language plpgsql
set search_path to ''
as $function$
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
$function$;

-- Rollback:
--   delete from public.ai_rate_limits where endpoint = 'translate';
--   alter table public.ai_rate_limits drop constraint ai_rate_limits_endpoint_check;
--   alter table public.ai_rate_limits add constraint ai_rate_limits_endpoint_check
--     check (endpoint in ('expand', 'story'));
--   (re-run the function body without the translate branch)
--   alter table public.user_settings drop column translate_from, drop column translate_to;
