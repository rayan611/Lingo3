-- Words typed in different languages are one concept when two or more of their
-- languages already agree.
--
-- Before: a stored concept was found only by the typed language's headword, so
-- the same meaning typed in Persian and in Spanish became two concepts. Now, if
-- that lookup finds nothing, the answer is matched against stored concepts of
-- the same part of speech by every language it carries. Two or more languages
-- with the same word (article and case ignored, accents kept) is strong
-- evidence of the same sense; one is not, so it never merges on a single
-- overlap, and it does not merge when two concepts tie for best.
-- Stored entries are still never overwritten.
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

  -- 1. the typed word, in the typed language
  select c.id into concept_uuid
  from public.shared_concepts c
  join public.shared_entries e on e.concept_id = c.id
  where c.status = 'ready' and c.pos = v_pos
    and e.lang = v_lang and e.lemma_key = v_key
  order by case when c.source = 'core' then 0 else 1 end, c.created_at
  limit 1;

  -- 2. two or more languages agree with one stored concept
  if concept_uuid is null then
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
  end if;

  if concept_uuid is null then
    insert into public.shared_concepts(source_key,source,source_lang,lemma,pos,tags,status)
    values (cache_key,'ai',v_lang,v_word,v_pos,
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
