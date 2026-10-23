-- Lingo3 — the list new words are filed in when none is picked.
--
-- One nullable column on user_settings. Additive only, for the same reason as
-- 20261023120000_lingo3_collections.sql: production shares this database and
-- never reads it. Text rather than a uuid foreign key on purpose: the default
-- list has a fixed, client-made id that may not exist as a row on the server
-- yet, and a removed list must not be able to fail a settings write. The
-- client resolves a missing or stale id to the built-in default list.
--
-- Applied to project vfximbxcxczntqywdryd (Lingo3) on 2026-10-24.
--
-- Until this runs, the client sends settings without the column (see
-- isMissingSchema in src/sync/sync.ts), so the choice stays on the device.

alter table public.user_settings
  add column if not exists default_collection_id text;
