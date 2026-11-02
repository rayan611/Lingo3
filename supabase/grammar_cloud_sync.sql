-- Additive migration. Apply only after verifying a successful restorable backup.
-- User-authored grammar stays private; curated grammar remains separate.
create table if not exists public.grammar_sections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  payload jsonb not null
);
create table if not exists public.grammar_rules (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  payload jsonb not null
);
create index if not exists grammar_sections_user_id_idx on public.grammar_sections(user_id);
create index if not exists grammar_rules_user_id_idx on public.grammar_rules(user_id);
alter table public.grammar_sections enable row level security;
alter table public.grammar_rules enable row level security;
create policy "grammar sections owner" on public.grammar_sections for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "grammar rules owner" on public.grammar_rules for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.grammar_sections to authenticated;
grant select, insert, update, delete on public.grammar_rules to authenticated;
