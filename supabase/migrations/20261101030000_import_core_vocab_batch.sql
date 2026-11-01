-- Bulk import of curated six-language cards (data/shared-vocab/batch-NNN.json,
-- format lingo3-vocab/1) into the shared bank.
--
-- Idempotent and duplicate-safe: a concept whose source_key exists is skipped,
-- and so is a concept that shares a (language, lemma_key, part of speech) with
-- a card already in the bank — those are reported, never overwritten. Later
-- batches therefore cannot repeat words from earlier batches or from words
-- users added through the AI.

create or replace function public.import_core_vocab_batch(doc jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  c jsonb;
  lang_code text;
  entry jsonb;
  concept_uuid uuid;
  inserted_count integer := 0;
  existing_count integer := 0;
  clashes jsonb := '[]'::jsonb;
  clash_with text;
begin
  if doc->>'format' is distinct from 'lingo3-vocab/1' or jsonb_typeof(doc->'concepts') <> 'array' then
    raise exception 'Unsupported vocabulary document';
  end if;

  for c in select * from jsonb_array_elements(doc->'concepts') loop
    if exists (select 1 from public.shared_concepts where source_key = c->>'id') then
      existing_count := existing_count + 1;
      continue;
    end if;

    select string_agg(distinct x.concept_key, ',') into clash_with
    from jsonb_each(c->'e') e(lang, v)
    join lateral (
      select sc.source_key as concept_key
      from public.shared_entries se
      join public.shared_concepts sc on sc.id = se.concept_id
      where se.lang = e.lang
        and se.lemma_key = public.shared_lemma_key(e.v->>'h', e.lang)
        and sc.pos = c->>'p'
        and sc.status <> 'rejected'
    ) x on true;
    if clash_with is not null then
      clashes := clashes || jsonb_build_array(jsonb_build_object('id', c->>'id', 'with', clash_with));
      continue;
    end if;

    insert into public.shared_concepts(source_key, source, source_lang, lemma, pos, tags, status, reviewed_at)
    values (c->>'id', 'core', 'sv', c->'e'->'sv'->>'h', c->>'p',
            coalesce(array(select jsonb_array_elements_text(c->'t')), '{}'), 'ready', now())
    returning id into concept_uuid;

    for lang_code, entry in select * from jsonb_each(c->'e') loop
      insert into public.shared_entries(concept_id, lang, headword, morphology, example, notes, source)
      values (concept_uuid, lang_code, entry->>'h', entry->'f', entry->>'x', entry->>'n', 'core');
    end loop;
    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('inserted', inserted_count, 'already_present', existing_count, 'clashes', clashes);
end;
$$;

revoke all on function public.import_core_vocab_batch(jsonb) from public, anon, authenticated;
grant execute on function public.import_core_vocab_batch(jsonb) to service_role;
