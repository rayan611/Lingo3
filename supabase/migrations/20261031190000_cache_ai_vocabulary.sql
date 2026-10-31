-- Only the server's service role can promote a validated AI result.
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
begin
  if cache_key !~ '^ai:[a-z]{2}:.{1,100}$'
     or jsonb_typeof(expansion->'entries') <> 'array'
     or expansion->>'pos' not in ('noun','verb','adjective','adverb','preposition','phrase','other')
     or expansion->>'detectedLang' is null then
    raise exception 'Invalid shared expansion';
  end if;
  entry_count := jsonb_array_length(expansion->'entries');
  if entry_count < 2 or entry_count > 20 or exists (
    select 1 from jsonb_array_elements(expansion->'entries') e
    where nullif(trim(e->>'lang'), '') is null
       or nullif(trim(e->>'headword'), '') is null
       or nullif(trim(e->>'example'), '') is null
  ) then
    raise exception 'Shared expansion is incomplete';
  end if;
  source_lang := expansion->>'detectedLang';
  select e->>'headword' into source_word
    from jsonb_array_elements(expansion->'entries') e
    where e->>'lang' = source_lang limit 1;
  if source_word is null then raise exception 'Missing source language'; end if;

  insert into public.shared_concepts(source_key,source,source_lang,lemma,pos,tags,status)
  values (cache_key,'ai',source_lang,source_word,expansion->>'pos',
          coalesce(array(select jsonb_array_elements_text(expansion->'tags')), '{}'), 'draft')
  on conflict (source_key) do update set updated_at = now()
  returning id into concept_uuid;

  for item in select * from jsonb_array_elements(expansion->'entries') loop
    insert into public.shared_entries(concept_id,lang,headword,morphology,example,notes,source)
    values (concept_uuid,item->>'lang',item->>'headword',item->'morphology',
            item->>'example',item->>'notes','ai')
    on conflict (concept_id,lang) do update set
      headword = excluded.headword,
      morphology = excluded.morphology,
      example = excluded.example,
      notes = excluded.notes,
      updated_at = now();
  end loop;
  update public.shared_concepts set status='ready',updated_at=now()
  where id=concept_uuid;
  return concept_uuid;
end;
$$;

revoke all on function public.cache_ai_expansion(text,jsonb) from public, anon, authenticated;
grant execute on function public.cache_ai_expansion(text,jsonb) to service_role;
