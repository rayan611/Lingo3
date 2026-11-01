-- The bank's answers carried JSON nulls (empty notes, Farsi has no morphology).
-- The app and /api/expand validate with zod `.optional()`, which rejects null, so
-- every bank hit was thrown away and the AI ran instead. The public lookup
-- functions now strip nulls; the original logic lives in the *_raw functions.
alter function public.lookup_shared_expansion(text,text,text,text[]) rename to lookup_shared_expansion_raw;
alter function public.lookup_shared_partial(text,text,text,text[]) rename to lookup_shared_partial_raw;

create or replace function public.lookup_shared_expansion(
  search_term text, search_lang text, native_lang text, target_langs text[]
) returns jsonb language sql stable set search_path = ''
as $$ select jsonb_strip_nulls(public.lookup_shared_expansion_raw(search_term, search_lang, native_lang, target_langs)) $$;

create or replace function public.lookup_shared_partial(
  search_term text, search_lang text, native_lang text, target_langs text[]
) returns jsonb language sql stable set search_path = ''
as $$ select jsonb_strip_nulls(public.lookup_shared_partial_raw(search_term, search_lang, native_lang, target_langs)) $$;

grant execute on function public.lookup_shared_expansion(text,text,text,text[]) to anon, authenticated;
grant execute on function public.lookup_shared_partial(text,text,text,text[]) to anon, authenticated;
grant execute on function public.lookup_shared_expansion_raw(text,text,text,text[]) to anon, authenticated;
grant execute on function public.lookup_shared_partial_raw(text,text,text,text[]) to anon, authenticated;
