-- v3.3 — the preferences that used to live only on the device.
--
-- Applied 2026-10-13, before the code that reads them shipped, as every
-- migration in this project has been.
--
-- All five are NULLABLE, and NULL means "never set" — which is not the same
-- as false. A device with no pin of its own takes these values; a device that
-- has pinned one keeps it locally and never writes it here. The pins live in
-- the client's `meta` table and are deliberately not represented in Postgres:
-- a per-device preference that synced would not be a per-device preference.
alter table public.user_settings
  add column if not exists theme text,
  add column if not exists typed_lang text,
  add column if not exists auto_advance boolean,
  add column if not exists speak_on_reveal boolean,
  add column if not exists speech_rate double precision;
