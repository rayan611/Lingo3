-- v3.6 — the "add later" list follows the account.
--
-- It shipped device-local in v3.5, on the argument that a scratchpad for the
-- twenty minutes between writing a word down and adding it properly is not
-- worth a table. The condition named there for reconsidering was "if words
-- get parked on the phone and added on the laptop" — which is what happens,
-- so here is the table.
--
-- Applied before the code that reads it ships, as every migration in this
-- project has been.
--
-- Deliberately NOT a concept: a parked word has no entries, no cards and no
-- place in the known-word set the reading generator measures coverage
-- against. It is a line of text with a date.
create table if not exists public.later_words (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lemma text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft, like every other synced row here: a row that is simply missing
  -- locally always loses last-write-wins, so a hard delete would be undone by
  -- the next full resync.
  deleted_at timestamptz
);

-- The pull filters on (user_id, updated_at); nothing else queries this table.
create index if not exists later_words_user_updated_idx
  on public.later_words (user_id, updated_at);

alter table public.later_words enable row level security;

drop policy if exists later_words_own on public.later_words;
create policy later_words_own
  on public.later_words for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Rollback
--
--   drop table if exists public.later_words;
--
-- Safe: nothing references it, and every row also exists in each device's
-- own IndexedDB. Dropping it costs only the cross-device copy.
-- ---------------------------------------------------------------------------

-- NOTE, to be pasted into the SQL editor by hand alongside this one — the
-- connector refuses statements that delete, so `delete_my_account()` cannot
-- be replaced from here. Without this line a deleted account leaves its
-- parked words behind, orphaned by nothing but the cascade on auth.users
-- (which does in fact remove them — so this is tidiness, not a leak):
--
--   -- inside delete_my_account(), before the user_settings line:
--   delete from public.later_words where user_id = uid;
