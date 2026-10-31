-- Small, bounded Swedish context for AI generation on a shared-card miss.
create or replace function public.lexin_context(search_term text)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'lemma', x.lemma,
    'pos', x.pos,
    'definition_sv', x.definition_sv,
    'example_sv', x.example_sv
  ) order by x.pos, x.sense_order), '[]'::jsonb)
  from (
    select w.lemma, w.pos, s.sense_order, s.definition_sv,
           s.examples_sv[1] as example_sv
    from public.dictionary_words w
    join public.dictionary_senses s on s.word_id = w.id
    where length(trim(search_term)) between 1 and 100
      and lower(w.lemma) = lower(trim(search_term))
      and (length(trim(coalesce(s.definition_sv, ''))) > 0
           or cardinality(s.examples_sv) > 0)
    order by w.pos, s.sense_order
    limit 5
  ) x;
$$;
grant execute on function public.lexin_context(text) to anon, authenticated;
