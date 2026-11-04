## 2026-11-04 — Readability and grammar authoring fixes

Branch: fix/readability-grammar-drafts. All five review items implemented: Word Practice instructional text now 15.2–16px, labels >=12px, mobile primary labels 14px; incomplete examples produce numbered validation errors rather than disappearing; account/language-scoped tab drafts restore across navigation/reload; sections support rename and protected empty-only soft deletion; My Word List/Read a story/Grammar headings and grammar theme tokens aligned. Rule creation and section deletion share an atomic transaction to prevent orphan rules. Nonempty sections/child sections are never cascaded. Drafts are tab-local, not cloud-synced; unavailable tab storage falls back to memory. No database migration, auth/RLS or review schedule changes.

Verification: production TypeScript/Vite/PWA build passes; all ten regression scripts pass via node --import tsx, including new grammar-authoring coverage (partial examples retained/rejected, atomic failed update, section rename/protected deletion, soft deletion, tab reload and account/language draft isolation). git diff --check passes. Signed-in browser, mobile and real provider E2E remain unverified.
Release: awaiting PR/merge and exact-SHA production deployment. Rollback: revert application commit; no rows are deleted by this release itself.

---

## 2026-11-04 — Training clarity and mobile navigation

Renamed free Review to Word Practice with explicit schedule-neutral description; retained /review. Due badge now appears only on Recall test. Home wording/add-word entry retained; Word Practice Home now opens the actual add-word home. Mobile sibling navigation uses two columns with 44px minimum button height and wrapping; activity spacing tightened without reducing label size. No schema/auth/scheduling changes.
Checks: TypeScript + production/PWA build, scheduling and query regressions (node --import tsx), git diff --check pass. Signed-in mobile/device/AI E2E unavailable because browser session is signed out; no production auth bypass attempted.
Released main commit aa0c97617a7c4e80fd0d28375ace93cbcc40097d. Production deployment dpl_BgNn4t3yxHPz9XjxedcfkpwZxqXw is READY with matching SHA and lingo3.com/www aliases. Remaining verification: signed-in visual mobile/device and real AI flows require an authenticated session.

---

## 2026-11-04 — Training Center word list and readability

Small UI update on main: moved My words from primary navigation into Training Center as My Word List; /words remains supported, with Training Center active state, return link and sibling navigation. Increased activity title text to 1.1rem, descriptions to 0.9rem and sibling buttons to 1rem. No data, auth or API changes.
Checks: production build (TypeScript + Vite/PWA), git diff --check and focused navigation assertions passed. Signed-in visual/device QA not performed.
Released main commit f47b8a05b33ecc4bcdf26e158e69ddae6850affd. Production deployment dpl_EiBtqkJfvzS427Bmfjt58yQqSHof is READY with matching SHA and lingo3.com/www aliases; live entry returns HTTP 200. No remaining implementation. Optional signed-in visual/device acceptance.

---

## 2026-11-04 — Showcase navigation links

Implemented from `fix/showcase-navigation`; released main commit `23ddb01039f773763b454174f8e0ab78ec962e09`. Added same-tab Home / Showcase anchors to the sign-in intro and Settings → Help & About → About, both targeting `/showcase.html`. Existing first-visit/session/installed-app entry behavior unchanged. No auth, database or routing changes.
Checks: `npm run build` (TypeScript + production/PWA build) and `git diff --check` pass. Reviewed both anchors and existing standalone showcase Open app return to `/`. Signed-in browser/device QA not performed. Production deployment `dpl_4bjVzGz6gynr4q2EvWpyAdHMi2LD` is READY with matching commit and lingo3.com/www aliases. HTTP retrieval of the live entry and Settings JS confirms both Home / Showcase links; showcase.html returns HTTP 200. No remaining implementation; optional signed-in visual/device acceptance.

---

## 2026-11-03 — Vocabulary batch 008 part 001 imported and verified

Imported **1,079 new concepts / 6,474 cards** atomically after successful rollback rehearsal; zero existing IDs/collisions/skips. Target 2,000 remains incomplete by **921** because Gemini still returns HTTP 402; backup samples failed semantic review and none were accepted. PR #34 / `data/lexin-2000-batch-008`. Payload commit e59902bf442c3b7c99186144d05d2ebe69d69cbf, pg_net request 18, matching SHA-256 8482d0e6c900834fce8adea84677b46095618b779877d8b75fbc07266a6a647a. Stored-card comparison 6,474/6,474 exact; repeat import 0 inserts / 1,079 existing. Active bank now **4,181 concepts / 25,082 cards**, zero duplicate groups/empty examples.

All 6,474 lookups pass in each of five rounds: anonymous automatic headers/database-bare/explicit headers, authenticated automatic headers/database-bare. Correct-concept comparison used; Italian l' retention limitation remains. App schemas: 5,395 morphology / 6,474 expansions / 60 real RPC samples pass. Nine local regression scripts and build pass; CI run 41637538221 passed on preparation commit. Repository delivery and final commit checks are tracked in PR #34. No app/schema/auth/RLS changes, browser/phone/offline E2E or independent human proofreading. See `docs/VOCAB_BATCH_008_REPORT.md` and `batch-008-part-001-verification.json`. Provider scopes restored; isolated temporary ops previews still require deletion. Next: restore usable primary quota and finish remaining 921 without re-counting this imported part. Existing unrelated handoffs preserved below.

---

## 2026-11-03 — Showcase CSP release follow-up

Fixed same-origin showcase iframe permissions in vercel.json: X-Frame-Options SAMEORIGIN, frame-ancestors 'self', frame-src 'self' plus Cloudflare. Latest source fix 2d685aafb04a846c6d7daf25035107cc83508400 on main. Production deployment dpl_373Shtoromk6UrA1KWwuBSFpM5UA triggered manually because main auto deployment is disabled; BUILDING at last inspection. Previous production bcebc3e READY. No full repository test suite or authenticated browser QA was executed in this session; do not mark functional acceptance. Next: confirm deployment READY, run npm test and npm run build in CI, test language selection, Settings invite, showcase entry and mobile flow.

## 2026-11-03 — Cross-app Showcase / Settings / Invitation review

Scope: Concordia360, Lingo3 and Glowis. GitHub main is canonical. This is a status and verification record, not a claim of browser QA.

Delivered:
- Public multilingual product showcase for each app, connected to homepage and/or welcome entry.
- Showcase link integrated into Settings invitation area in all three apps.
- Personal invitation links remain distinct from public showcase URLs; invitation sharing supports messaging channels.
- Localized feature descriptions and sharing copy added; Concordia360 invite JSON includes en/fa/sv/de/es/ar.
- Showcase pull requests merged to main: Concordia #21 (f49cfb7), Lingo3 #33 (5306dde), Glowis #32 (131b641).
- Follow-up Concordia main commits: d6d564a (Settings link), 2d125ef (localized invitation templates).
- Vercel production deployment check on 2026-11-03: Concordia 2d125ef READY, Lingo3 5306dde READY, Glowis 131b641 READY.

Verification boundaries and open work:
1. READY means deployment/build status only; signed-in functional QA on mobile and desktop has NOT been completed.
2. Verify homepage/welcome open-app CTA, navigation, invitation deep links and greeting, Settings links, clipboard and social share flows.
3. Check all selected languages for untranslated prompts, installation guidance and metadata; full localization audit not verified.
4. Check mobile sizing, iframe scrolling, accessibility and CSP/PWA/offline behavior; automated browser/device test not verified.
5. Validate production domains and custom-domain routing independently; READY preview/production URL alone does not establish full end-to-end health.
6. Concordia invitation localization was updated in data/invite.json; check language-specific greeting rendering on the actual landing page.
7. Confirm there are no regressions in authenticated flows, and record actual QA results before marking release fully accepted.

Status: MERGED / PRODUCTION BUILDS READY; FUNCTIONAL ACCEPTANCE PENDING.
Rollback: revert the respective main commits or redeploy the preceding known-good production deployment if regression is observed. No database changes were made as part of this showcase review.
Next: targeted browser QA, fix only observed defects, update this handoff with tested URLs, devices and outcomes.

---

# Vocabulary batch 007 ambiguity cleanup — 2026-11-03
Owner authorised repeated checks, correction/removal of ambiguous words and merging PR #31. Final active package is **740 concepts / 4,440 cards**, after reversibly quarantining 260 of the original 1,000 concepts (`status="rejected"`). Physical records retained; user cards and all older batches unchanged. An attempted physical-delete rehearsal required tool confirmation which expired; no physical deletion occurred. Quarantine rollback rehearsal passed before commit.

Four lookup rounds: (1) anonymous exact headers plus bare lemmas in all six languages found 19 header-ambiguous concepts and 260 distinct ambiguous concepts in total; (2) authenticated repeat confirmed the same 260, while explicit-language lookups passed 1,560/1,560; (3) after quarantine, anonymous automatic headers **4,440/4,440** and automatic bare lemmas **4,440/4,440** return the correct concept; (4) authenticated automatic bare lemmas again **4,440/4,440** pass. Full card archive and numerical evidence are committed as `batch-007-quarantined.json` and `batch-007-ambiguity-audit.json`. No invented translations or filler labels were used to hide ambiguity.

Current bank: **3,102 ready concepts / 18,608 ready cards**. Raw records remain 3,362 / 20,168 including the quarantined records. Canonical import JSON and source snapshot contain only the retained 740; do not restore the quarantined file automatically. Client schemas: 3,700 morphology and 4,440 expansion parses pass. CI run 41581540009 passed TypeScript, all regression checks and the production build on `0ee724314a6b932d5af9814d968d7701c5517638`; Vercel preview check passed. No app source/schema/auth/RLS changes. No physical-phone E2E or independent six-language human proofreading.

Previous PR #27 merged as `3337687ceea100ac407195ad9bcba140c601e89b`. Initial 1,000-concept import evidence remains historical in the verification file and report. PR #31 merged and independently confirmed as `c5174c2c94faabc60bbc16c6c4feec1dc4fa3e33`. Requested cleanup and merge complete. No pending implementation; quarantine review/restoration is optional future work. Production bank state is live; no browser/phone E2E was performed. Unrelated handoffs below preserved.

---

2026-11-03 | Lingo3 | fix/grammar-ai-examples-feedback
Fixed silent grammar AI failures: show API/auth/rate-limit errors, report success, keep editing form in sync with generated examples, and accept short/long notes (bounded prompt). No schema changes. CI, merge and production verification pending. Signed-in end-to-end generation remains to be checked.

---
Date: 2026-11-03 | Project: Lingo3 | Branch: feature/grammar-organized-accordion
Changes: grammar section/rule nested collapsible cards; separate explanation and examples panels; explicit AI example generation alongside manual edit; grammar language picker limited to active learning languages. No schema changes. Existing examples remain in grammar JSONB sync.
Checks: CI and preview pending at handoff edit. Production deployment pending merge.
Next: verify CI, merge, deploy, verify production SHA; signed-in AI and cross-device E2E still require browser testing.

---
Date: 2026-11-02
Project: Lingo3
Branch: feature/training-grammar-editor-examples
Scope: Recall test moved out of Training Center; Home icon added; grammar editor supports paragraphs, bold Markdown, headings, lists, preview, editing saved rules and examples. Authenticated background AI generates examples for new rules without blocking save. Grammar remains per-language and per-user; examples are stored in existing JSONB sync payload. Production Supabase additive generated language columns and indexes applied; RLS unchanged.
Verification: GitHub CI and production deployment to be checked after merge; real cross-device AI/browser E2E remains unverified. No sharing with other users enabled (future opt-in only).
Next: validate CI, merge, deploy main, confirm production SHA, test signed-in example generation and sync on two devices.

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
