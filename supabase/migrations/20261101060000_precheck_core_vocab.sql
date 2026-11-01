-- Pre-check candidate cards BEFORE writing them, so duplicate rows are prevented rather than discovered at import.
-- Input: [{"id":"core.n.x","p":"noun","e":{"fa":"..","en":"..","sv":"..","de":"..","es":"..","it":".."}}]
-- Output: [{"id","why","with"}] ; empty array = nothing clashes.
create or replace function public.precheck_core_vocab(candidates jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with c as (
    select x->>'id' as id, x->>'p' as pos, x->'e' as e from jsonb_array_elements(candidates) x
  ), words as (
    select c.id, c.pos, w.key as lang, w.value as headword
    from c cross join lateral jsonb_each_text(c.e) w(key, value)
  ), hits as (
    select c.id, 'id exists' as why, sc.source_key as with_concept
      from c join public.shared_concepts sc on sc.source_key = c.id
    union all
    select w.id, w.lang || ':' || w.headword, sc.source_key
      from words w
      join public.shared_entries se on se.lang = w.lang and se.lemma_key = public.shared_lemma_key(w.headword, w.lang)
      join public.shared_concepts sc on sc.id = se.concept_id and sc.pos = w.pos and sc.status <> 'rejected'
    union all
    select a.id, a.lang || ':' || a.headword, b.id
      from words a join words b
        on b.id < a.id and b.pos = a.pos and b.lang = a.lang
       and public.shared_lemma_key(b.headword, b.lang) = public.shared_lemma_key(a.headword, a.lang)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'why', why, 'with', with_concept) order by id), '[]'::jsonb) from hits
$$;
revoke all on function public.precheck_core_vocab(jsonb) from public, anon, authenticated;
grant execute on function public.precheck_core_vocab(jsonb) to service_role;
