# Development Handoff — Lingo3 Grammar Manager

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
