-- Require two-language agreement before AI cards merge with an existing sense.
-- A source-key collision without that agreement leaves the stored card intact.
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
  v_lang text;
  v_word text;
  v_key text;
  v_pos text;
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
  v_lang := expansion->>'detectedLang';
  v_pos := expansion->>'pos';
  select e->>'headword' into v_word
    from jsonb_array_elements(expansion->'entries') e
    where e->>'lang' = v_lang limit 1;
  if v_word is null then raise exception 'Missing source language'; end if;
  v_key := public.shared_lemma_key(v_word, v_lang);

  perform pg_advisory_xact_lock(hashtext(v_lang || ':' || v_pos || ':' || v_key));

  -- A matching spelling alone is not enough: Lexin has many homographs and
  -- polysemous words. Merge only when at least two languages independently
  -- match the same ready concept, with no tie at the best score.
  with incoming as (
    select e->>'lang' as lang,
           public.shared_lemma_key(e->>'headword', e->>'lang') as k
    from jsonb_array_elements(expansion->'entries') e
  ), scored as (
    select c.id, count(distinct i.lang) as n
    from incoming i
    join public.shared_entries s on s.lang = i.lang and s.lemma_key = i.k
    join public.shared_concepts c on c.id = s.concept_id
      and c.status = 'ready' and c.pos = v_pos
    group by c.id
    having count(distinct i.lang) >= 2
  )
  select (array_agg(id))[1] into concept_uuid
  from scored where n = (select max(n) from scored)
  having count(*) = 1;

  if concept_uuid is null then
    -- The same source word may already have an AI card for another sense.
    -- A single source-key collision must never add its translations to that card.
    select c.id into concept_uuid
    from public.shared_concepts c where c.source_key = cache_key;
    if concept_uuid is not null then return concept_uuid; end if;
  end if;

t (concept_id,lang) do nothing;
  end loop;

  update public.shared_concepts set status='ready',updated_at=now()
  where id=concept_uuid and status='draft';
  return concept_uuid;
end;
$$;

revoke all on function public.cache_ai_expansion(text,jsonb) from public, anon, authenticated;
grant execute on function public.cache_ai_expansion(text,jsonb) to service_role;
