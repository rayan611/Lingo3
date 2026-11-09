## 2026-11-09 — Highlighted info and personal word removal (0.7.5)

Branch: `feat/review-card-removal`; base `dfa536ed7197aa7de6aa3698859f79cb5adcbb56`. Highlighted accessible info control in Recall and Word Practice opens full native/active-target details. Bottom Remove chooser offers tests-only suspension or personal-list soft removal; shared bank, entries, review history and scheduler parameters are retained. Suspended words stay in manual practice with Restore to tests. Atomic personal Dexie transaction reuses existing synced suspended/deletedAt/updatedAt fields; no migration or shared-bank mutation. Recall skips removed words without grading/incrementing session count; auto-advance pauses while details are open. Practice details support browser Back; keyboard navigation cannot change the underlying word while details are open.

Navigation: reviewed App route map and updated docs/SITEMAP.md + ROUTE_INDEX.md for 0.7.5. No new route/primary menu; info/detail/Back paths and removal behavior documented.

Validation: production TypeScript/Vite/PWA build passes; word-actions fixture covers due queue/count removal, manual-store retention, restoration preserving scheduler state, soft removal and refusal to restore a deleted word. Existing query/scheduling/sync checks pass. All 12 regression scripts pass via node --import tsx. Release evidence recorded below when available. Browser attempt blocked: no installed Chromium; Playwright browser download returned truncated non-ZIP content. No signed-in phone/browser or live cross-device sync acceptance claimed. npm test CLI hits environment IPC EPERM; run same scripts using node --import tsx instead. Rollback: revert app commit; existing personal suspension/deletion state remains synced by design. No production vocabulary changed by development tests. Preview deployment dpl_1EU57jiVwREJTM7DHwQTFky8pV89 is READY on exact commit b0f9e5e60caa77abb40a25ea92de1f5ef9315801 (PR #39). Initial GitHub Actions run 42671870070 failed before creating any job with GitHub Internal server error, correlation 5f8797bc-aa14-48e5-ae6d-856a3d06e9ff; failed-jobs retry rejected because run cannot be retried. Documentation update triggers a fresh PR check. All 12 same scripts pass locally and Vercel remote build passed; production pending.

---

## 2026-11-08 — 200 verbs in eight languages and stored-form speed fix (0.7.4)

Owner authorized adding 200 nonduplicate verbs and fast bank-first inflection lookup. Branch feat/verb-bank-fast-lookup-20261108; reviewed app main 8e42f3261dc6992a728985290c58ea946f401719. Prior batch-009 archive PR #37 merged after successful CI 42477041674 as 11a2595b6a2d40c53a5b7b4ed5e0a6a59c37ccf4; its already-live vocabulary was not reimported.

LIVE DATA: exactly **200 new concepts / 1,600 entries**, all supported languages fa/en/sv/de/es/it/fr/ru. Ready bank **4,483 concepts / 27,290 entries**, **471 verbs**, **0 duplicate groups**. Old shared-record checksums unchanged. Corrected only newly imported aliases; final SHA-256 b37ac48124ebddb0edd0dc4b67ccb399a1eb6b322ce9417cdecb15a09ddfd253. Never reimport the preparatory historical payload as fresh data.

LIVE DATABASE: applied stored_lexical_form_keys migration. Generated form_keys + GIN index and once-per-language query normalization remove repeated parsing under RLS; existing status/ambiguity/core preference/grants/roles unchanged. Anonymous DB samples **13.345–68.234 ms**; previous slow sample 3158.670 ms. Additional conjugations retained by optional typed additionalForms; no new UI route. RELEASED: PR #38 merged as 72e67705487bddf4f3094cc618169c594127a9b3 after CI run 42484015283 passed on 5f6f2329b52af27fd8b0c2123af3a2e92014f89a. Production deployment dpl_Eib5QQ2tsEC2dpGKDGBKX6PPXkGd is READY with that exact code commit and lingo3.com/www aliases; https://lingo3.com/version.json returns 0.7.4. Served main bundle includes additionalForms. No error/fatal logs were returned for this new deployment in the observed 15-minute window (limited traffic; not a signed-in browser acceptance test).

VERIFIED: 1,600/1,600 correct live explicit-language header lookups; local 1,600 morphology/expansion parses and 36,211 entry/form keys; RLS samples anon 16/16 and authenticated 16/16; eight real public HTTPS inflection results (all eight entries each) parse with ExpansionSchema; API unit test proves bank hit skips provider/counter. SQL RLS/ambiguity/metadata/generated-update fixtures pass, rolled back with zero leftovers. Repeat import inserts 0 / 200 existing. Ten existing regression files pass via node --import tsx; npm test CLI itself is blocked by runtime IPC EPERM. Typecheck and production/PWA build pass. Security advisor findings unchanged.

LIMITS: real HTTP first cold request 7.228s; seven warm requests 155–415ms. Server DB time is separate from connection/network latency. Client 1.8s wait and server fallback remain; hints/paired context, missing languages or genuine ambiguity can still use AI. No physical signed-in browser/phone/offline E2E or independent eight-language proofreading. Examples are parallel original grammar-practice frames, not individually contextualized scenes; not every possible compound tense is populated.

NAVIGATION: reviewed and updated docs/SITEMAP.md and ROUTE_INDEX.md to 0.7.4; no path/menu/Back changes. Report/sources: docs/VOCAB_BATCH_010_REPORT.md, batch-010*.json. Rollback restores only old raw lookup definitions via scripts/rollback-stored-forms.sql; additive storage and user data remain. Final immutable archive comparison: 1,600/1,600 exact, final repeat import 0 inserts / 200 existing; no remaining implementation/release step. Next optional action: signed-in phone/desktop and offline acceptance, further contextual usage examples if requested.

---

## 2026-11-08 — Adjectives, opposites and time/place vocabulary (batch 009)

Branch: `data/adjectives-time-place-20261108`; payload commit `f260213b1dd66f0b7cb34fc0753d530c563bfbb5`; reviewed application main `8e42f3261dc6992a728985290c58ea946f401719` (0.7.3). Owner authorized additive shared-bank data.

LIVE DATA COMPLETE: inserted exactly **50 new adjectives with opposites + 50 time/place adverbs/adverbial expressions = 100 concepts / 600 six-language entries** into Supabase vfximbxcxczntqywdryd. All 50 adjectives have localized opposite notes: 20 new pairs plus 10 references to already-existing opposites. No old entries, personal words, auth/RLS, functions or app source changed. Ready totals 4,183/25,090 → **4,283/25,690**; normalized headword/POS duplicate groups remain 0. Before/after old-record checksums match.

Verification: final locked rollback rehearsal passed; import precheck/assertions passed; live explicit-language full-bank lookups **600/600 correct**; stored headwords/examples/forms/notes **600/600 exact**. Anonymous six-language samples 6/6 correct; authenticated real expansion sample correct. Repeat import 0 inserts / 100 existing / no clashes. Focused `node scripts/check-vocab-009.mjs` passed (100 concepts, 600 entries, 250 morphology objects, 300 opposite notes, 30 pairs). No app build required for this data-only change. No browser/phone E2E or independent six-language proofreading.

SPEED GOAL PARTIAL: anonymous EXPLAIN ANALYZE for `efter lunch` measured **3158.670 ms**, exceeding the current **1800 ms** client bank timeout in src/ai/expand.ts. Do not claim the UI always avoids AI or is fast. A full all-card RLS aggregate attempt timed out and rolled back; full RLS coverage remains unverified. Automatic-language ambiguity, hints/paired inputs and unsupported batch languages can still reach AI. No security bypass or timeout change was introduced.

Navigation: reviewed App.tsx route map, Training Center entry/siblings/Back behavior, Settings headings, public showcase and invite parser. Added previously absent **docs/SITEMAP.md** and **docs/ROUTE_INDEX.md**, dated/versioned against the reviewed code; no route or menu change. Active/conditional/compatibility/planned paths distinguished.

See docs/VOCAB_BATCH_009_REPORT.md and data/shared-vocab/batch-009*.json. Data is already live and needs no Vercel app deploy. GitHub data/docs branch is separate from main; merge not performed in this task. Recovery: idempotent reimport; withdraw only exact batch IDs via separately authorized quarantine if necessary, never blanket-delete. Next action: focused bank-query performance profiling under RLS and signed-in UI verification within the client's time budget; preserve data and lookup safety.

---

## 2026-11-05 — Showcase header/footer navigation

Owner requested highlighted App Login controls and complete showcase menus on all three apps. Header and footer now include Home, Features, How it works, Benefits, Install, Share and highlighted App Login. Existing hero/closing entry controls remain. New labels localized for each page's offered languages; login uses the existing app entry route and iframe bridge. Standalone Glowis/Lingo3 entry marks the existing welcome flag so visitors do not loop through the showcase.
Checks: JavaScript syntax, both menu link sets, unique IDs, highlighted login and all install handlers PASS. Responsive flex-wrap and visible keyboard focus retained. Production dpl_CHMo7EbdrTqpMttnvSJmRoZiPKq2 READY on 2637fc6045fd84a1bf6770c67aaf6f550515f357; https://lingo3.com/showcase.html HTTP 200 verified with highlighted login and Footer navigation present. TypeScript/Vite production build passed. Visual device QA not performed. No auth/API/database changes. Rollback: revert showcase files only.

---

## 2026-11-04 — Input language, reset and inflected vocabulary lookup (v0.7.3)

Starting main eb17085; branch fix/source-language-inflected-lookup. Owner authorized implementation and release. Added Word language picker beside Save for later, limited to native + active learning languages, with automatic result language display; explicit language reaches single/pair requests and changing it clears stale results. Replaced + with red reset arrow. Pills wrap on mobile. Reset clears word/result/language.

Shared bank now checks exact headwords and every lexical morphology field, with article-aware keys, accent preservation and comma/semicolon/slash alternatives. Metadata, notes and example sentences are excluded to avoid false matches. GIN expression index supports the lookup. Existing core preference and ambiguous-result refusal remain; no vocabulary/user rows deleted or overwritten. Local saved-word duplicate detection also checks forms and refuses ambiguous form-only matches. Existing saved corrupt AI cards are not automatically repaired; shared Swedish sitter now resolves to the correct core sitta record.

DONE VERIFIED: all ten regression scripts; focused saved sitter/suttit duplicate regression; shared form tests; transactional SQL migration rehearsal and rollback; live migration shared_inflected_lookup applied to vfximbxcxczntqywdryd; live sitter → sitta with Persian نشستن, suttit, partial completeness, language isolation, accents/metadata/alternatives tests pass; anonymous lookup works. Security advisor findings unchanged from baseline (legacy functions/hub/password settings). Production TypeScript/Vite/PWA build passed. Additional transactional ambiguity fixture declined a two-concept inflection match and rolled back cleanly; authenticated-role lookup also passed. One EXPLAIN ANALYZE measured 13.317 ms inside Postgres (not browser/network latency). No auth/RLS/review scheduling changes. No authenticated browser/physical-device E2E performed.

Rollback: restore the two *_raw lookup definitions from migrations 20261101004000 and 20261101040000 (renaming definitions to *_raw); remove shared_entries_form_keys_idx and then shared_form_keys; revert application commit. No data restoration required. RELEASED: PR #36 merged as 8d127395291837c60842791a203e98ab2dec6074 after CI run 41913604886 succeeded on 6326aa3663e9b764bc14b17ff4dd20a2b7ff2b24. Production deployment dpl_68nLLpNq9XjiakMXGFv4DMYdPRst is READY with the matching commit and lingo3.com/www aliases. Live https://lingo3.com/version.json returns HTTP 200 and version 0.7.3. No remaining implementation/release step. Optional next action: signed-in mobile/desktop acceptance; old saved corrupt AI copies require separate review.

---

## 2026-11-04 — Readability and grammar authoring fixes

Branch: fix/readability-grammar-drafts. All five review items implemented: Word Practice instructional text now 15.2–16px, labels >=12px, mobile primary labels 14px; incomplete examples produce numbered validation errors rather than disappearing; account/language-scoped tab drafts restore across navigation/reload; sections support rename and protected empty-only soft deletion; My Word List/Read a story/Grammar headings and grammar theme tokens aligned. Rule creation and section deletion share an atomic transaction to prevent orphan rules. Nonempty sections/child sections are never cascaded. Drafts are tab-local, not cloud-synced; unavailable tab storage falls back to memory. No database migration, auth/RLS or review schedule changes.

Verification: production TypeScript/Vite/PWA build passes; all ten regression scripts pass via node --import tsx, including new grammar-authoring coverage (partial examples retained/rejected, atomic failed update, section rename/protected deletion, soft deletion, tab reload and account/language draft isolation). git diff --check passes. Signed-in browser, mobile and real provider E2E remain unverified.
Release: PR #35 merged as 8ea5b85a6dcf31366361594344e353110d78380d after CI run 41896833741 succeeded on head 5a4a20065fd9d0cf1a261690d98d7b2f30d406b1. Production deployment dpl_EtqBbJgKURRNDQ9gxUtqpvj9p5hM is READY with matching SHA and lingo3.com/www aliases. Rollback: revert application commit; no rows are deleted by this release itself.

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
