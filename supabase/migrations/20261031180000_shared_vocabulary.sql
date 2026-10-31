-- Reusable, sense-aware card content. Personal FSRS state remains in cards.
create table if not exists public.shared_concepts (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source text not null,
  source_lang text not null,
  lemma text not null,
  pos text not null,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_entries (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.shared_concepts(id) on delete cascade,
  lang text not null,
  headword text not null,
  morphology jsonb,
  example text,
  notes text,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (concept_id, lang)
);

create index if not exists shared_entries_exact_lookup
  on public.shared_entries (lang, lower(headword));
create index if not exists shared_entries_concept_id
  on public.shared_entries (concept_id);

alter table public.shared_concepts enable row level security;
alter table public.shared_entries enable row level security;

create policy shared_concepts_read_ready on public.shared_concepts
  for select to anon, authenticated using (status = 'ready');
create policy shared_entries_read_ready on public.shared_entries
  for select to anon, authenticated using (
    exists (select 1 from public.shared_concepts c
            where c.id = concept_id and c.status = 'ready')
  );

grant select on public.shared_concepts, public.shared_entries to anon, authenticated;

-- A single result in the same shape as /api/expand. Ambiguous spellings fall
-- through to AI, which can use the user's context to choose the right sense.
create or replace function public.lookup_shared_expansion(
  search_term text,
  search_lang text,
  native_lang text,
  target_langs text[]
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  selected_id uuid;
  matches integer;
  matched_lang text;
  language_matches integer;
  native_word text;
  native_example text;
  result jsonb;
  wanted text[];
begin
  if length(trim(search_term)) = 0 or length(search_term) > 100
     or native_lang is null or target_langs is null then
    return null;
  end if;
  wanted := array(select distinct x from unnest(array_append(target_langs, native_lang)) x
                  where x is not null);
  if cardinality(wanted) = 0 then return null; end if;

  with candidates as (
    select c.id, case when c.source = 'core' then 0 else 1 end as priority
    from public.shared_concepts c
    where c.status = 'ready'
      and exists (
        select 1 from public.shared_entries source_entry
        where source_entry.concept_id = c.id
          and lower(source_entry.headword) = lower(trim(search_term))
          and (search_lang is null or source_entry.lang = search_lang)
      )
      and not exists (
        select 1 from unnest(wanted) language_code
        where not exists (
          select 1 from public.shared_entries entry
          where entry.concept_id = c.id and entry.lang = language_code
            and length(trim(entry.headword)) > 0 and length(trim(coalesce(entry.example, ''))) > 0
        )
      )
  )
  select count(*), (array_agg(id))[1] into matches, selected_id
  from candidates where priority = (select min(priority) from candidates);
  if matches != 1 then return null; end if;

  select count(*), (array_agg(lang))[1] into language_matches, matched_lang
  from public.shared_entries
  where concept_id = selected_id and lower(headword) = lower(trim(search_term))
    and (search_lang is null or lang = search_lang);
  if language_matches != 1 then return null; end if;

  select headword, example into native_word, native_example
  from public.shared_entries where concept_id = selected_id and lang = native_lang;

  select jsonb_build_object(
    'pos', c.pos,
    'tags', to_jsonb(c.tags),
    'normalisedLemma', trim(search_term),
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
    ), '[]'::jsonb)
  ) into result
  from public.shared_concepts c where c.id = selected_id;
  return result;
end;
$$;

grant execute on function public.lookup_shared_expansion(text,text,text,text[])
  to anon, authenticated;
