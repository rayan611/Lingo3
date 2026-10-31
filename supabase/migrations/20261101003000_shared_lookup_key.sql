-- Shared vocabulary: find words the way people type them, and let every
-- user-added word grow the shared bank.
--
-- Before this, lookup compared lower(headword) with the typed text, so the
-- stored "ett hus", "el agua" and "to eat" were never found by "hus", "agua"
-- or "eat". The key below drops the article / infinitive marker and case, and
-- keeps accents on purpose: "schon" (already) must not return "schön".

create or replace function public.shared_bare_word(word text, lang text)
returns text language sql immutable parallel safe set search_path = ''
as $$
  select case
    when cardinality(w) > 1 and (
         (lang = 'sv' and w[1] in ('en', 'ett', 'att'))
      or (lang = 'de' and w[1] in ('der', 'die', 'das'))
      or (lang = 'en' and w[1] in ('a', 'an', 'the', 'to'))
      or (lang = 'es' and w[1] in ('el', 'la', 'los', 'las'))
      or (lang = 'it' and w[1] in ('il', 'lo', 'la', 'le', 'gli', 'i'))
      or (lang = 'fr' and w[1] in ('le', 'la', 'les'))
    ) then array_to_string(w[2:cardinality(w)], ' ')
    else array_to_string(w, ' ')
  end
  from (select regexp_split_to_array(btrim(normalize(word, NFC)), '\s+') as w) s
$$;

create or replace function public.shared_lemma_key(word text, lang text)
returns text language sql immutable parallel safe set search_path = ''
as $$
  select translate(lower(public.shared_bare_word(word, lang)), 'يك', 'یک')
$$;

alter table public.shared_entries
  add column if not exists lemma_key text
  generated always as (public.shared_lemma_key(headword, lang)) stored;

create index if not exists shared_entries_lemma_key_idx
  on public.shared_entries (lemma_key, lang);

-- Same signature as before, so the app and /api/expand need no change to call it.
create or replace function public.lookup_shared_expansion(
  search_term text, search_lang text, native_lang text, target_langs text[]
) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  selected_id uuid;
  matches integer;
  matched_lang text;
  matched_word text;
  language_matches integer;
  native_word text;
  native_example text;
  result jsonb;
  wanted text[];
  keys text[];
begin
  if search_term is null or length(trim(search_term)) = 0 or length(search_term) > 100
     or native_lang is null or target_langs is null then
    return null;
  end if;
  wanted := array(select distinct x from unnest(array_append(target_langs, native_lang)) x
                  where x is not null);
  if cardinality(wanted) = 0 then return null; end if;
  keys := array(select distinct public.shared_lemma_key(search_term, l)
                from unnest(array['sv','de','en','es','it','fr','fa']) l);

  with hits as (
    select e.concept_id, e.lang
    from public.shared_entries e
    where e.lemma_key = any(keys)
      and e.lemma_key = public.shared_lemma_key(search_term, e.lang)
      and (search_lang is null or e.lang = search_lang)
  ),
  candidates as (
    select c.id, case when c.source = 'core' then 0 else 1 end as priority
    from public.shared_concepts c
    where c.status = 'ready'
      and c.id in (select concept_id from hits)
      and not exists (
        select 1 from unnest(wanted) language_code
        where not exists (
          select 1 from public.shared_entries entry
          where entry.concept_id = c.id and entry.lang = language_code
            and length(trim(entry.headword)) > 0
            and length(trim(coalesce(entry.example, ''))) > 0
        )
      )
  )
  select count(*), (array_agg(id))[1] into matches, selected_id
  from candidates where priority = (select min(priority) from candidates);
  if matches is distinct from 1 then return null; end if;

  select count(*), (array_agg(lang))[1], (array_agg(headword))[1]
    into language_matches, matched_lang, matched_word
  from public.shared_entries
  where concept_id = selected_id
    and lemma_key = public.shared_lemma_key(search_term, lang)
    and (search_lang is null or lang = search_lang);
  if language_matches is distinct from 1 then return null; end if;

  select headword, example into native_word, native_example
  from public.shared_entries where concept_id = selected_id and lang = native_lang;

  select jsonb_build_object(
    'pos', c.pos,
    'tags', to_jsonb(c.tags),
    'normalisedLemma', public.shared_bare_word(matched_word, matched_lang),
    'detectedLang', matched_lang,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lang', e.lang,
        'headword', e.headword,
        'meaning', case when e.lang = native_lang then e.headword else native_word end,
        'morphology', e.morphology,
        'example', e.example,
        'exampleGloss', case when e.lang = native_lang then null else native_example end,
        'notes', e.notes
      ) order by e.lang)
      from public.shared_entries e
      where e.concept_id = c.id and e.lang = any(wanted)
    ), '[]'::jsonb)
  ) into result
  from public.shared_concepts c where c.id = selected_id;
  return result;
end;
$$;

grant execute on function public.lookup_shared_expansion(text,text,text,text[])
  to anon, authenticated;

-- Words people add that the bank did not have. The server calls this with the
-- service role after a successful AI expansion. Differences from the first
-- version:
--  * the word is matched by lemma_key + part of speech, so "hus", "ett hus"
--    and "Hus" all land on one concept instead of three;
--  * languages accumulate: a later request for another language adds that
--    language to the same concept;
--  * an entry already stored (core or earlier AI) is never overwritten, so one
--    odd AI answer cannot replace reviewed data.
create or replace function public.cache_ai_expansion(
  cache_key text,
  expansion jsonb
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  concept_uuid uuid;
  item jsonb;
  entry_count integer;
  source_lang text;
  source_word text;
  source_key text;
  pos_value text;
begin
  if cache_key !~ '^ai:[a-z]{2}:.{1,160}$'
     or jsonb_typeof(expansion->'entries') <> 'array'
     or expansion->>'pos' not in ('noun','verb','adjective','adverb','preposition','phrase','other')
     or expansion->>'detectedLang' is null then
    raise exception 'Invalid shared expansion';
  end if;
  entry_count := jsonb_array_length(expansion->'entries');
  if entry_count < 2 or entry_count > 20 or exists (
    select 1 from jsonb_array_elements(expansion->'entries') e
    where e->>'lang' !~ '^[a-z]{2}$'
       or nullif(trim(e->>'headword'), '') is null
       or length(e->>'headword') > 100
       or nullif(trim(e->>'example'), '') is null
       or length(e->>'example') > 500
  ) then
    raise exception 'Shared expansion is incomplete';
  end if;
  source_lang := expansion->>'detectedLang';
  pos_value := expansion->>'pos';
  select e->>'headword' into source_word
    from jsonb_array_elements(expansion->'entries') e
    where e->>'lang' = source_lang limit 1;
  if source_word is null then raise exception 'Missing source language'; end if;
  source_key := public.shared_lemma_key(source_word, source_lang);

  perform pg_advisory_xact_lock(hashtext(source_lang || ':' || pos_value || ':' || source_key));

  select c.id into concept_uuid
  from public.shared_concepts c
  join public.shared_entries e on e.concept_id = c.id
  where c.status = 'ready' and c.pos = pos_value
    and e.lang = source_lang and e.lemma_key = source_key
  order by case when c.source = 'core' then 0 else 1 end, c.created_at
  limit 1;

  if concept_uuid is null then
    insert into public.shared_concepts(source_key,source,source_lang,lemma,pos,tags,status)
    values (cache_key,'ai',source_lang,source_word,pos_value,
            coalesce(array(select jsonb_array_elements_text(expansion->'tags')), '{}'), 'draft')
    on conflict (source_key) do update set updated_at = now()
    returning id into concept_uuid;
  end if;

  for item in select * from jsonb_array_elements(expansion->'entries') loop
    insert into public.shared_entries(concept_id,lang,headword,morphology,example,notes,source)
    values (concept_uuid,item->>'lang',item->>'headword',item->'morphology',
            item->>'example',item->>'notes','ai')
    on conflict (concept_id,lang) do nothing;
  end loop;

  update public.shared_concepts set status='ready',updated_at=now()
  where id=concept_uuid and status='draft';
  return concept_uuid;
end;
$$;

revoke all on function public.cache_ai_expansion(text,jsonb) from public, anon, authenticated;
grant execute on function public.cache_ai_expansion(text,jsonb) to service_role;
