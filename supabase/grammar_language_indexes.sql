-- Applied to production 2026-11-02. Additive, no existing rows removed.
alter table public.grammar_sections add column if not exists lang text generated always as (payload ->> 'lang') stored;
alter table public.grammar_rules add column if not exists lang text generated always as (payload ->> 'lang') stored;
create index if not exists grammar_sections_user_lang_idx on public.grammar_sections (user_id, lang);
create index if not exists grammar_rules_user_lang_idx on public.grammar_rules (user_id, lang);
