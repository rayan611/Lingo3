-- Run inside a transaction after applying the migration; no fixture rows are needed.
do $$
declare answer jsonb;
begin
  answer := public.lookup_shared_expansion('sitter','sv','fa',array['sv','en','de']);
  assert answer->>'normalisedLemma' = 'sitta', 'sitter must find core sitta, not the mixed AI sitter record';
  assert answer->>'pos' = 'verb';
  assert (select e->>'headword' from jsonb_array_elements(answer->'entries') e where e->>'lang'='fa') = 'نشستن';
  assert public.lookup_shared_expansion('suttit','sv','fa',array['sv','en','de'])->>'normalisedLemma' = 'sitta';
  assert public.lookup_shared_partial('sitter','sv','fa',array['sv','en','de'])->'missing' = '[]'::jsonb;
  assert public.lookup_shared_expansion('sitter','fa','fa',array['sv','en','de']) is null, 'must constrain language';
  assert not ('verb' = any(public.shared_form_keys('sitta','sv','{"kind":"verb","presens":"sitter"}')));
  assert not ('sit' = any(public.shared_form_keys('sitta','sv','{"presens":"sitter"}')));
  assert 'husen' = any(public.shared_form_keys('ett hus','sv','{"indefinitePlural":"hus / husen"}'));
  assert not ('satter' = any(public.shared_form_keys('sätta','sv','{"presens":"sätter"}')));
end $$;
