# Development Handoff — Lingo3 Grammar Manager

## Vocabulary batch 006 — 2026-11-02

DONE VERIFIED: owner requested 1,000 more concepts as one package. Imported exactly **1,000 new nouns / 6,000 six-language entries** into the shared Supabase bank in one atomic transaction after a rollback dry run and six-language duplicate checks. Starting main `81a26505481d0f692b92d73653b174f938589e47` already contains PR #25; do not count/reimport the earlier 350 as new work. New branch `data/lexin-1000-batch-006`, final data commit `da68557e7fd09262e9a3325ef13ad8c11e550011`.

Live totals: 1,362/8,168 → **2,362 concepts / 14,168 entries**. Drafts 1,734 → 1,000 inserted, 627 excluded, 107 unused reserve. Zero skips at import; repeat import inserts zero and reports 1,000 already present. Only the six newly created entries for the Persian push-noun ambiguity were subsequently adjusted; no old data was overwritten. Entire bank has zero duplicates/empty examples; all 6,000 new headwords/examples/morphology/notes match final GitHub JSON.

Verification: 5,000 morphology parses, 6,000 expansion parses, 6,000 explicit-language live header lookups, 60 real RPC response parses, 1,000 anonymous Swedish-header lookups pass; all eight existing regression scripts, typecheck and production build pass. Existing automatic-language ambiguity remains: exact headers 5,936/6,000; bare Swedish 758/1,000 and bare English 827/1,000. Do not claim all unqualified queries avoid AI. No browser/phone/offline E2E, schema/auth/RLS changes, main merge or production app deploy were performed. All 1,000 concepts are nouns; examples mostly use six parallel practice frames.

Files: `data/shared-vocab/batch-006*`, `scripts/build-batch-006.py`, `scripts/validate-batch-006.ts`, `docs/VOCAB_BATCH_006_REPORT.md`. Agent: Codex. Owner authorized additive data work, with previous independent-branch constraint preserved. Exact next action: owner reviews the new data-only PR; do not reimport or count it again. A lookup-policy change is separate scope. Existing grammar work and prior handoffs below remain preserved.

---

## Vocabulary session — 2026-11-02

DONE VERIFIED: imported exactly 350 new Lexin-derived noun concepts / 2,100 six-language entries into the production shared vocabulary bank, separately from all prior batches (including the 31 prepositions). Data branch: `data/lexin-350-20261102`; starting main `bc487f9e2cba4631fc88ef56acbf63c75fc7539c`; final data commit `a9101ffcb7be2b68f571b0216c782a7402ff4ec3`. Agent: Codex; owner explicitly authorized this additive production data import and prohibited changes to main application code. Main was not merged or deployed.

Live totals: 1,012/6,068 → 1,362 concepts/8,168 entries. Preselection excluded 97 rows and retained 180 unused reserve rows; zero skips at import. Import was first tested and rolled back, then committed under write locks with assertions. Only 11 newly created card headers/examples were subsequently adjusted for retrieval ambiguity. All 2,100 database card payloads match final GitHub data. Reimport inserted zero and reported 350 already present. Zero bank duplicates and zero empty examples.

Tests: 1,750 morphology parses and 2,100 static expansion parses pass; all 2,100 explicit-language authenticated RPC lookups pass, 36 live responses parse, anonymous automatic Swedish header lookup 350/350 passes; all eight existing test scripts, typecheck and production build pass. Remaining existing limitation: automatic source-language detection returns 2,018/2,100; 82 ambiguous cross-language lookups can still fall back to AI. Browser/physical-phone/offline E2E was not exercised. No schema/auth/RLS changes. See `docs/VOCAB_BATCH_005_REPORT.md` for evidence, source attribution, reproducibility and limitations; source/batch files are under `data/shared-vocab/batch-005*`.

Exact next action: owner reviews this data-only PR; do not reimport as new work or merge main without approval. Automatic-language ambiguity requires a separately approved app change. Existing grammar work and the prior handoff below are preserved; no grammar tables or app source were edited in this vocabulary session.

---
Date: 2026-11-02
Status: PARTIAL IMPLEMENTATION — NOT DEPLOYED
Branch: feature/grammar-manager-phase1

Implemented and committed:
- docs/GRAMMAR_MANAGER_PHASE1.md: phase-one scope and acceptance checklist.
- src/db/db.ts: additive Dexie version 8 grammarSections and grammarRules stores, preserving existing tables.
- src/db/grammar.ts: typed local section/rule records and basic offline CRUD, soft deletion and language search.

Not implemented:
- UI and navigation.
- Supabase migration, RLS and cross-device sync.
- Curated standard grammar library and personal-copy behavior.
- Anonymous-to-account grammar adoption.
- Grammar section update/delete, parent cycle checks, cascade semantics.
- Tests and verified backup/restore.

Verification: GitHub commits confirmed. No typecheck, npm test, browser test or deployment performed. No production database changes.
Rollback: Production Vercel deployment dpl_AGqu3263JvTXk3SpAnBUeKDAoaCU previously identified as rollback candidate; database restore not verified.
Risk: Production and preview share Supabase. Never deploy schema changes until backup and restore are verified.
Next action: inspect actual current database schema and backup success, add isolated migration and tests, implement UI and sync, then stage and release.
