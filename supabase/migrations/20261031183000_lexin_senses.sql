-- Preserve Lexin's distinct meanings and examples without pretending that
-- Swedish-only source material is already a multilingual flash card.
create table if not exists public.dictionary_senses (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.dictionary_words(id) on delete cascade,
  source_key text not null unique,
  sense_order integer not null,
  definition_sv text,
  usage_sv text,
  comment_sv text,
  valency_sv text,
  examples_sv text[] not null default '{}',
  idioms_sv text[] not null default '{}',
  compounds_sv text[] not null default '{}'
);
create index if not exists dictionary_senses_word_id
  on public.dictionary_senses(word_id);
alter table public.dictionary_senses enable row level security;
create policy dictionary_senses_read on public.dictionary_senses
  for select to anon, authenticated using (true);
grant select on public.dictionary_senses to anon, authenticated;

comment on table public.dictionary_senses is
  'Svenska ord/LEXIN (2nd ed.), Språkbanken Text, CC BY 4.0. https://www.sprakbanken.se/resurser/lexin';
