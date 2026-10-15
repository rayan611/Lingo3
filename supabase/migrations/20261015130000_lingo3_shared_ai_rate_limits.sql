create table if not exists public.ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint in ('expand', 'story')),
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count >= 1),
  primary key (user_id, endpoint, window_start),
  check (window_start = date_trunc('hour', window_start))
);

alter table public.ai_rate_limits enable row level security;

drop policy if exists "Users can read their own AI rate limits" on public.ai_rate_limits;
create policy "Users can read their own AI rate limits"
  on public.ai_rate_limits for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own AI rate limits" on public.ai_rate_limits;
create policy "Users can insert their own AI rate limits"
  on public.ai_rate_limits for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own AI rate limits" on public.ai_rate_limits;
create policy "Users can update their own AI rate limits"
  on public.ai_rate_limits for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.ai_rate_limits to authenticated;
revoke all on public.ai_rate_limits from anon;
revoke delete, truncate, references, trigger on public.ai_rate_limits from authenticated;

create or replace function public.protect_ai_rate_limit_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() or new.request_count <> 1 then
      raise exception 'Invalid AI rate limit row';
    end if;
  else
    if new.user_id is distinct from old.user_id
       or new.endpoint is distinct from old.endpoint
       or new.window_start is distinct from old.window_start
       or new.request_count < old.request_count then
      raise exception 'AI rate limit counters cannot be reset or reassigned';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_ai_rate_limit_row() from public, anon, authenticated;

drop trigger if exists protect_ai_rate_limit_row on public.ai_rate_limits;
create trigger protect_ai_rate_limit_row
  before insert or update on public.ai_rate_limits
  for each row execute function public.protect_ai_rate_limit_row();

create or replace function public.consume_ai_rate_limit(p_endpoint text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
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

revoke all on function public.consume_ai_rate_limit(text) from public, anon;
grant execute on function public.consume_ai_rate_limit(text) to authenticated;
