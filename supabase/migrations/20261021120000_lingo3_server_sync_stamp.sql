-- v3.9 — the pull cursor moves onto the server's clock.
--
-- Until now a device pulled rows whose `updated_at` was newer than its own
-- last pull time. Both sides of that comparison were device clocks: the row's
-- from the device that wrote it, the cursor from the one reading. A phone a
-- few minutes slow wrote rows dated before the laptop's cursor, and the laptop
-- never pulled them, short of a manual resync.
--
-- `synced_at` is stamped by this trigger on every insert and update, from the
-- database's clock, and the client pulls on it instead. `updated_at` stays the
-- last-write-wins comparison it always was: that one is about which edit the
-- person made last, and only the device that made the edit knows.
--
-- Additive only, so it is applied before the code that reads it ships and the
-- production build that does not know the column simply ignores it.
--
-- clock_timestamp(), not now(): now() is the transaction start, identical for
-- every row of a bulk upsert, and the client pages on this column.

create or replace function public.stamp_synced_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.stamp_synced_at() from public, anon, authenticated;

-- APPLIED 2026-10-21. Written out per table rather than as a loop with
-- `drop trigger if exists`: the connector holds any statement containing a
-- drop for a confirmation, and the triggers did not exist yet.

alter table public.concepts add column if not exists synced_at timestamptz not null default clock_timestamp();
alter table public.entries add column if not exists synced_at timestamptz not null default clock_timestamp();
alter table public.cards add column if not exists synced_at timestamptz not null default clock_timestamp();
alter table public.stories add column if not exists synced_at timestamptz not null default clock_timestamp();
alter table public.later_words add column if not exists synced_at timestamptz not null default clock_timestamp();

create index if not exists concepts_user_synced_idx on public.concepts (user_id, synced_at);
create index if not exists entries_user_synced_idx on public.entries (user_id, synced_at);
create index if not exists cards_user_synced_idx on public.cards (user_id, synced_at);
create index if not exists stories_user_synced_idx on public.stories (user_id, synced_at);
create index if not exists later_words_user_synced_idx on public.later_words (user_id, synced_at);

create trigger stamp_synced_at before insert or update on public.concepts for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.entries for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.cards for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.stories for each row execute function public.stamp_synced_at();
create trigger stamp_synced_at before insert or update on public.later_words for each row execute function public.stamp_synced_at();

-- ---------------------------------------------------------------------------
-- Rollback (only once no deployed client pulls on synced_at):
--
--   drop trigger if exists stamp_synced_at on public.<each table>;
--   alter table public.<each table> drop column if exists synced_at;
--   drop function if exists public.stamp_synced_at();
-- ---------------------------------------------------------------------------
