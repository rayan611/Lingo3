-- Partial bank hit: like lookup_shared_expansion, but the concept only needs the
-- learner's native-language card. Languages the bank lacks come back in
-- "missing" so the server asks the AI for those alone and stores them afterwards.
create or replace function public.lookup_shared_partial(
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
    select e.concept_id, e.lang,
           -- "to love" / "ett hus" typed with the article: the person was explicit,
           -- so it beats a bare-word homograph ("love" the noun).
           (lower(btrim(e.headword)) = lower(btrim(search_term))
            and e.lemma_key <> lower(btrim(search_term))) as explicit
    from public.shared_entries e
    where e.lemma_key = any(keys)
      and e.lemma_key = public.shared_lemma_key(search_term, e.lang)
      and (search_lang is null or e.lang = search_lang)
  ),
  candidates as (
    select c.id,
           (case when c.source = 'core' then 0 else 2 end
            + case when exists (select 1 from hits h where h.concept_id = c.id and h.explicit)
                   then 0 else 1 end) as priority
    from public.shared_concepts c
    where c.status = 'ready'
      and c.id in (select concept_id from hits)
      and not exists (
        select 1 from unnest(array[native_lang]) language_code
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
    ), '[]'::jsonb),
    'missing', to_jsonb(array(
      select l from unnest(wanted) l
      where l <> native_lang and not exists (
        select 1 from public.shared_entries m
        where m.concept_id = c.id and m.lang = l
          and length(trim(m.headword)) > 0 and length(trim(coalesce(m.example, ''))) > 0)
      order by l))
  ) into result
  from public.shared_concepts c where c.id = selected_id;
  return result;
end;
$$;

grant execute on function public.lookup_shared_partial(text,text,text,text[])
  to anon, authenticated;
