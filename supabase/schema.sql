-- Lingo3 — snapshot of the live `public` schema, 2026-10-21.
--
-- NOT a migration, and not applied by anything. The first five tables
-- (concepts, entries, cards, review_log, user_settings) were created from the
-- dashboard before this repo kept migrations, so until now nothing here said
-- what they look like. Generated from the catalog of the production database
-- after lingo3_server_sync_stamp; ordered so it runs top to bottom on an empty
-- Supabase project (concepts before the tables that reference it, functions
-- before the policies that call them).
--
-- Refresh it after any migration by re-running the catalog query it came
-- from, or with `supabase db dump --schema public` once the CLI is linked.
-- Grants are Supabase's defaults except where the migrations revoke them.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.concepts (
  id uuid not null,
  user_id uuid not null,
  lemma text not null,
  source_lang text not null,
  pos text not null default 'other'::text,
  category text not null default 'uncategorised'::text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  tags text[] not null default '{}'::text[],
  synced_at timestamp with time zone not null default clock_timestamp(),
  constraint concepts_pkey PRIMARY KEY (id),
  constraint concepts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.concepts enable row level security;

create table public.entries (
  id text not null,
  user_id uuid not null,
  concept_id uuid not null,
  lang text not null,
  headword text not null,
  meaning text not null,
  morphology jsonb,
  example text,
  example_gloss text,
  notes text,
  updated_at timestamp with time zone not null default now(),
  synced_at timestamp with time zone not null default clock_timestamp(),
  constraint entries_concept_id_lang_key UNIQUE (concept_id, lang),
  constraint entries_pkey PRIMARY KEY (id),
  constraint entries_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
  constraint entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.entries enable row level security;

create table public.cards (
  id text not null,
  user_id uuid not null,
  concept_id uuid not null,
  lang text not null,
  due timestamp with time zone not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0,
  last_review timestamp with time zone,
  suspended boolean not null default false,
  updated_at timestamp with time zone not null default now(),
  synced_at timestamp with time zone not null default clock_timestamp(),
  constraint cards_concept_id_lang_key UNIQUE (concept_id, lang),
  constraint cards_pkey PRIMARY KEY (id),
  constraint cards_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
  constraint cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.cards enable row level security;

create table public.review_log (
  id uuid not null,
  user_id uuid not null,
  card_id text not null,
  concept_id uuid not null,
  lang text not null,
  grade smallint not null,
  state smallint not null,
  due timestamp with time zone not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null,
  last_elapsed_days integer not null,
  scheduled_days integer not null,
  reviewed_at timestamp with time zone not null,
  constraint review_log_pkey PRIMARY KEY (id),
  constraint review_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.review_log enable row level security;

create table public.user_settings (
  user_id uuid not null,
  native_lang text not null default 'fa'::text,
  target_langs text[] not null default ARRAY['sv'::text, 'de'::text, 'en'::text],
  active_langs text[] not null default ARRAY['sv'::text, 'de'::text, 'en'::text],
  daily_new_limit integer not null default 15,
  daily_review_limit integer not null default 150,
  request_retention double precision not null default 0.9,
  updated_at timestamp with time zone not null default now(),
  display_name text,
  is_admin boolean not null default false,
  theme text,
  typed_lang text,
  auto_advance boolean,
  speak_on_reveal boolean,
  speech_rate double precision,
  translate_from text,
  translate_to text[],
  constraint user_settings_pkey PRIMARY KEY (user_id),
  constraint user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.user_settings enable row level security;

create table public.stories (
  id uuid not null,
  user_id uuid not null,
  title text not null default ''::text,
  body text not null default ''::text,
  lang text not null,
  genre text not null default 'fun'::text,
  topics text[] not null default '{}'::text[],
  word_count integer not null default 0,
  known_count integer not null default 0,
  unknown_words text[] not null default '{}'::text[],
  glossary jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  synced_at timestamp with time zone not null default clock_timestamp(),
  constraint stories_pkey PRIMARY KEY (id),
  constraint stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.stories enable row level security;

create table public.later_words (
  id uuid not null,
  user_id uuid not null,
  lemma text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  synced_at timestamp with time zone not null default clock_timestamp(),
  constraint later_words_pkey PRIMARY KEY (id),
  constraint later_words_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.later_words enable row level security;

create table public.suggestions (
  id uuid not null,
  user_id uuid not null,
  body text not null,
  context text,
  status text not null default 'new'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint suggestions_pkey PRIMARY KEY (id),
  constraint suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint suggestions_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000))),
  constraint suggestions_status_check CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'done'::text, 'dismissed'::text])))
);
alter table public.suggestions enable row level security;

create table public.ai_rate_limits (
  user_id uuid not null,
  endpoint text not null,
  window_start timestamp with time zone not null,
  request_count integer not null default 1,
  constraint ai_rate_limits_pkey PRIMARY KEY (user_id, endpoint, window_start),
  constraint ai_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint ai_rate_limits_endpoint_check CHECK ((endpoint = ANY (ARRAY['expand'::text, 'story'::text, 'translate'::text]))),
  constraint ai_rate_limits_request_count_check CHECK ((request_count >= 1)),
  constraint ai_rate_limits_window_start_check CHECK ((window_start = date_trunc('hour'::text, window_start)))
);
alter table public.ai_rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX cards_due_idx ON public.cards USING btree (user_id, lang, due);
CREATE INDEX cards_sync_idx ON public.cards USING btree (user_id, updated_at);
CREATE INDEX cards_user_synced_idx ON public.cards USING btree (user_id, synced_at);
CREATE INDEX concepts_sync_idx ON public.concepts USING btree (user_id, updated_at);
CREATE INDEX concepts_tags_idx ON public.concepts USING gin (tags);
CREATE INDEX concepts_user_synced_idx ON public.concepts USING btree (user_id, synced_at);
CREATE INDEX entries_sync_idx ON public.entries USING btree (user_id, updated_at);
CREATE INDEX entries_user_synced_idx ON public.entries USING btree (user_id, synced_at);
CREATE INDEX later_words_user_synced_idx ON public.later_words USING btree (user_id, synced_at);
CREATE INDEX later_words_user_updated_idx ON public.later_words USING btree (user_id, updated_at);
CREATE INDEX review_log_sync_idx ON public.review_log USING btree (user_id, reviewed_at);
CREATE INDEX stories_user_synced_idx ON public.stories USING btree (user_id, synced_at);
CREATE INDEX stories_user_updated_idx ON public.stories USING btree (user_id, updated_at);
CREATE INDEX suggestions_created_idx ON public.suggestions USING btree (created_at DESC);
CREATE INDEX suggestions_user_idx ON public.suggestions USING btree (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Functions (see the migrations for why each is shaped the way it is)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select coalesce(
    (select s.is_admin from public.user_settings s where s.user_id = auth.uid()),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_active_7d', (
      select count(distinct user_id) from public.review_log
      where reviewed_at > now() - interval '7 days'
    ),
    'concepts', (select count(*) from public.concepts where deleted_at is null),
    'entries', (select count(*) from public.entries),
    'cards', (select count(*) from public.cards),
    'reviews', (select count(*) from public.review_log),
    'stories', (select count(*) from public.stories where deleted_at is null),
    'suggestions_new', (
      select count(*) from public.suggestions where status = 'new'
    ),
    'db_bytes', (
      select coalesce(sum(pg_total_relation_size(c.oid)), 0)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    )
  ) into result;

  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(p_endpoint text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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

  delete from auth.users where id = uid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_is_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin cannot be changed from the app'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_ai_rate_limit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.stamp_synced_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$function$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
revoke all on function public.consume_ai_rate_limit(text) from public, anon;
grant execute on function public.consume_ai_rate_limit(text) to authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.protect_ai_rate_limit_row() from public, anon, authenticated;
revoke all on function public.stamp_synced_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

create policy "own concepts" on public.concepts as permissive for all to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "own entries" on public.entries as permissive for all to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "own cards" on public.cards as permissive for all to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "own review log" on public.review_log as permissive for all to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "own settings" on public.user_settings as permissive for all to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "stories are private to their owner" on public.stories as permissive for all to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy later_words_own on public.later_words as permissive for all to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy suggestions_insert_own on public.suggestions as permissive for insert to authenticated
  with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy suggestions_select on public.suggestions as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));

create policy suggestions_update_admin on public.suggestions as permissive for update to authenticated
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));

create policy suggestions_delete_admin on public.suggestions as permissive for delete to authenticated
  using (( SELECT is_admin() AS is_admin));

create policy "Users can read their own AI rate limits" on public.ai_rate_limits as permissive for select to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert their own AI rate limits" on public.ai_rate_limits as permissive for insert to authenticated
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update their own AI rate limits" on public.ai_rate_limits as permissive for update to authenticated
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

grant select, insert, update on public.ai_rate_limits to authenticated;
revoke all on public.ai_rate_limits from anon;
revoke delete, truncate, references, trigger on public.ai_rate_limits from authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger guard_is_admin before insert or update on public.user_settings for each row execute function public.guard_is_admin();
create trigger protect_ai_rate_limit_row before insert or update on public.ai_rate_limits for each row execute function public.protect_ai_rate_limit_row();
create trigger stamp_synced_at before insert or update on public.concepts for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.entries for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.cards for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.stories for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.later_words for each row execute function public.stamp_synced_at();
