# Vocabulary batch 007 — 2026-11-02
Owner requested merging #27 and adding the next 1,000 new concepts. PR #27 merged successfully as `3337687ceea100ac407195ad9bcba140c601e89b`; its CI and Vercel checks passed.
Branch: `data/lexin-1000-batch-007`. Prepared 1,000 new noun concepts / 6,000 cards; import and live verification PENDING. Prior bank data excluded using live six-language lemma keys. No application/schema/auth edits. Preserve existing Grammar/Training Center work below. Next: atomic rollback rehearsal, import and retrieval checks; update this section with verified counts before delivery.

---

# Training Center navigation — 2026-11-02
Owner requested grouping Grammar, Read a story and Review under one Training Center tile, plus a clear scope/status summary.

IMPLEMENTED: one Training Center primary tile; its hub contains Grammar, Read a story, Review and Recall test. Children have compact sibling navigation and a return-to-center button. Existing /grammar, /read, /review and /recall URLs remain supported. The due-word badge is preserved. Five primary tiles, responsive mobile grid. Version 0.7.2.
TESTED/RELEASED: local TypeScript/build and CI run 41479893646 passed (typecheck, regression checks, production build). Preview succeeded. PR #28 merged as ba2064ca4a8ad9261ad84f1a7952fe5412a62e86. Vercel production dpl_DNWhjjA3CyuQHqHcar75xoagH3ge is READY with that commit and lingo3.com/www.lingo3.com aliases. No database changes. Existing learning screens and sync logic unchanged. Signed-in mobile/desktop visual acceptance was not performed.
REMAINING PRODUCT SCOPE: section hierarchy/edit/delete UI; example authoring/translation UI; AI improvements and sharing; optional curated library/levels/tags; physical two-device acceptance and full backup/restore verification. These are not included in the navigation change.
NEXT: optional signed-in mobile/desktop visual acceptance; prioritize Grammar section management and examples if authorized. Previous Grammar release evidence follows.

---

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

DONE VERIFIED RELEASE: PR #26 merged as 8cb282fea50497c7f4801d67c2153a64f36e61a3 after CI run 41476380503 succeeded (typecheck, npm test, production build). Vercel production dpl_DBBPjEU668q1ZqSW7uCTSSXyoUXj is READY with lingo3.com/www.lingo3.com aliases and the matching commit. The original #24 was already merged by concurrent work.
LIMITS: two physical signed-in devices were not available; device behavior was modeled with independent IndexedDB stores, with isolation/CAS also checked on the actual database. Daily backup run 41420511863 skipped dump/encryption/upload; a full backup/restore is NOT verified. No existing vocabulary/auth data was modified. Sharing, AI improvements, curated library and advanced section management remain outside this release.
NEXT: optional physical-device acceptance check using the same account on phone and laptop; configure and restore-test full daily backups separately. No remaining code or database blocker for this release.

---
Previous handoff snapshots (historical; current status above supersedes Grammar statements below):

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
