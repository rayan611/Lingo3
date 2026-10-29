-- Lingo3 — linked words: opposites, common synonyms and look-alikes.
--
-- One nullable jsonb column on entries: an array of
--   { kind: 'opposite' | 'synonym' | 'lookalike', word, meaning?, register?,
--     note?, example?, exampleGloss? }
-- kept from the expansion so Review can show "↔ vit · ≈ jobba · ≠ lån" beside a
-- word. Additive only: production clients that predate it never send or read
-- the column, and an upsert without it leaves it as it was.
--
-- Applied to project vfximbxcxczntqywdryd (Lingo3) on 2026-10-29.
--
-- Until this runs, the client sends entries without the column (see
-- isMissingSchema in src/sync/sync.ts), so links stay on the device.

alter table public.entries
  add column if not exists links jsonb;
