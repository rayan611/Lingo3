# Grammar release completion — 2026-11-02
Agent: Codex. Owner requested completion and merge.
Starting Grammar PR #24 head: 47cf468; concurrent work merged #24 as c7b1573 while this session was running. Existing vocabulary batch changes are preserved.

DONE VERIFIED:
- Added atomic conditional grammar writes using the previously observed updated_at token. Blind upsert removed; conflicts retain visible copies. Local edits during upload and account switches are guarded.
- Added visible grammar sync status/retry, rule editing, language selection, sync triggers for grammar writes, anonymous-note adoption and regression checks.
- TypeScript, all existing regression scripts, focused grammar checks and production build passed locally. In this runtime the tsx CLI cannot create its IPC socket; the same scripts ran with node --import tsx. CI runs normal npm test.
- Database tests inside BEGIN/ROLLBACK passed owner CRUD, stale-write rejection, soft deletion, cross-user read/update/delete denial, forged owner denial and anonymous denial. Zero fixture rows remain.
- Applied Supabase migration grammar_least_privilege on vfximbxcxczntqywdryd: anonymous grants revoked, authenticated limited to SELECT/INSERT/UPDATE/DELETE. Both grammar tables have RLS enabled; unsafe grants count = 0.
- Numeric-version RPC was rehearsed and rolled back, then discarded after migration confirmation expired twice. Final code needs no RPC/new columns and uses the existing deployed schema.

IN PROGRESS: publish follow-up PR, require CI success, merge and verify production deployment. The original #24 is already merged by concurrent work.
LIMITS: two physical signed-in devices were not available; device behavior was modeled with independent IndexedDB stores, with isolation/CAS also checked on the actual database. Daily backup run 41420511863 skipped dump/encryption/upload; a full backup/restore is NOT verified. No existing vocabulary/auth data was modified. Sharing, AI improvements, curated library and advanced section management remain outside this release.
NEXT: verify the final deployed commit and /grammar response, then record release evidence.

---
Previous handoff snapshots (historical; current status above supersedes Grammar statements below):

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
