-- Lingo3 — collections: the one list a word is filed in.
--
-- Additive only, and that is deliberate rather than incidental: beta and
-- production share this database, so production is running against this schema
-- the moment it is applied. A new table it never selects from and two nullable
-- columns it never writes are invisible to it; a NOT NULL column or a renamed
-- one would take the live site down. `collection_id` is therefore nullable
-- here and resolved to the default list in the client, not in the database.
--
-- Applied to project vfximbxcxczntqywdryd (Lingo3) on 2026-10-23 — everything
-- below EXCEPT the `delete_my_account` rewrite, which is still to run. That
-- one is not urgent: `collections.user_id` cascades from `auth.users`, and
-- the function deletes that row last, so a deleted account still takes its
-- lists with it. The rewrite only makes the clean-up explicit, in the order
-- the rest of the function already follows. Re-run this whole file when
-- convenient; every statement in it is idempotent.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.collections (
  id uuid not null,
  user_id uuid not null,
  name text not null,
  -- 'user' is one you made; 'library' was filled from a pack that ships with
  -- the app. Checked rather than free text so a typo cannot create a third
  -- kind that nothing knows how to render.
  kind text not null default 'user',
  -- Which shipped pack filled it. Only ever set on kind = 'library'.
  pack_id text,
  sort_order integer not null default 0,
  -- Whether its words are in the review queue. Off touches no FSRS state.
  active boolean not null default true,
  in_export boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  synced_at timestamp with time zone not null default clock_timestamp(),
  constraint collections_pkey primary key (id),
  constraint collections_user_id_fkey foreign key (user_id)
    references auth.users(id) on delete cascade,
  constraint collections_kind_check check (kind in ('user', 'library')),
  constraint collections_name_check
    check (char_length(name) >= 1 and char_length(name) <= 60)
);

alter table public.collections enable row level security;

-- ---------------------------------------------------------------------------
-- Concepts gain their list, and the catalogue item they came from
-- ---------------------------------------------------------------------------
--
-- No foreign key from concepts.collection_id to collections.id, on purpose.
-- Sync pushes tables one at a time: concepts go up before collections on the
-- very first push from a device, and a constraint would reject the whole
-- batch for a list the server has not been told about yet. Last-write-wins
-- cannot offer ordering guarantees, so the schema must not demand them.
--
-- seed_id is what lets the packs overlap. A1 and the everyday list both
-- contain "red" under the same seed_id; the second pack enabled sees it is
-- already there and skips it instead of making a second card.

alter table public.concepts add column if not exists collection_id uuid;
alter table public.concepts add column if not exists seed_id text;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists collections_user_synced_idx
  on public.collections using btree (user_id, synced_at);
create index if not exists collections_user_updated_idx
  on public.collections using btree (user_id, updated_at);

-- Every count on the word-lists screen is this index.
create index if not exists concepts_collection_idx
  on public.concepts using btree (user_id, collection_id);

-- Partial: only pack words carry a seed_id, and they are a small minority of
-- a real account's rows.
create index if not exists concepts_seed_idx
  on public.concepts using btree (user_id, seed_id)
  where seed_id is not null;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

drop policy if exists collections_own on public.collections;
create policy collections_own on public.collections
  as permissive for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Sync stamp
-- ---------------------------------------------------------------------------
--
-- The pull cursor is a server timestamp, so every synced table needs this
-- trigger or a row written on one device is never pulled by the other.

drop trigger if exists stamp_synced_at on public.collections;
create trigger stamp_synced_at
  before insert or update on public.collections
  for each row execute function public.stamp_synced_at();

-- ---------------------------------------------------------------------------
-- Account deletion has to know about the new table
-- ---------------------------------------------------------------------------
--
-- collections cascades from auth.users, so the final delete would clear it
-- anyway — but this function deletes the rows itself in dependency order and
-- leaving a table out of it is how a future non-cascading constraint turns
-- "delete my account" into an error. Listed after concepts, since that is the
-- side holding the reference.

create or replace function public.delete_my_account()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_my_account: no signed-in user';
  end if;

  delete from public.review_log    where user_id = uid;
  delete from public.cards         where user_id = uid;
  delete from public.entries       where user_id = uid;
  delete from public.concepts      where user_id = uid;
  delete from public.collections   where user_id = uid;
  delete from public.stories       where user_id = uid;
  delete from public.suggestions   where user_id = uid;
  delete from public.later_words   where user_id = uid;
  delete from public.user_settings where user_id = uid;

  delete from auth.users where id = uid;
end;
$function$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- The plan, on the account
-- ---------------------------------------------------------------------------
--
-- Null means the default (free). Nothing sells this yet: there is no billing,
-- so the column records a choice made in Settings rather than a payment.

alter table public.user_settings add column if not exists plan text;

alter table public.user_settings drop constraint if exists user_settings_plan_check;
alter table public.user_settings add constraint user_settings_plan_check
  check (plan is null or plan in ('free', 'full'));
