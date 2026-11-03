# Vocabulary batch 008 — part 001, 2026-11-03

## Scope and status
Original target: 2,000 additional concepts / 12,000 six-language cards.
Prepared part 001: **1,079 concepts / 6,474 cards**. Remaining target: **921 concepts**.
This is an explicitly partial delivery; it does not satisfy the full 2,000-concept target.
Import, live lookup verification and merge are pending in this preparation commit.

## Preparation and review
- 7,273 unused Lexin noun candidates; 2,612 distinct generated proposals, 1,533 excluded.
- Selected original proposals/source attribution retained in batch-008-part-001-lexin.json. Canonical payload is batch-008-part-001.json; all are nouns in fa/en/sv/de/es/it.
- All six-language headwords reviewed for sense consistency. Uncertain/mismatched cases were excluded, including billion/trillion, butchered compounds, false-friend translations and several culture-specific terms. This is assistant review, not independent human proofreading.
- Duplicate/automatic-language collision filtering covers all languages/POS/statuses in the old bank snapshot, including the 260 previously quarantined concepts. A fresh live precheck is required before writing.
- Swedish inflections come from the Lexin snapshot. Persian irrelevant morphology fields removed. Italian lo mapped to masculine gender il without changing the phonetic article; obvious article/gender contradictions rejected. Missing German genitives use conservative declension rules with reviewed weak-noun and compound-See corrections.
- 5,395 morphology and 6,474 expansion schema parses pass with zero failures.
- Standalone rebuild produces byte-identical SHA-256: 8482d0e6c900834fce8adea84677b46095618b779877d8b75fbc07266a6a647a.
- Focused shared-vocabulary regression checks passed. Exact final commit CI remains pending.

## Provider limitation
Gemini still returns HTTP 402. Smaller sequential GPT-OSS and Qwen requests on the configured Groq backup answered, but sample translations were unacceptable. Mistral samples also failed semantic review. No backup-provider proposals are accepted and no credit purchase/top-up occurred. New generation stopped; do not populate the remaining 921 with poor translations to meet the count.

## Verify/rebuild
`python3 scripts/build-batch-008-part-001.py`
`node --import tsx scripts/validate-batch-008.ts data/shared-vocab/batch-008-part-001.json /tmp/batch008-failures.json`

Part validation explicitly permits a partial package through the third argument. Final batch validation without it still requires 2,000.

## Limits and operations
No app-source/schema/auth/RLS/lookup-policy change. No browser, physical-phone or offline E2E. The existing database key function retains Italian l' elision; tests using shared_bare_word must not be described as truly article-free Italian tests. Source snapshots with missing Swedish plural forms carry a note rather than an invented plural.

Generation helpers live only on ops/vocab-batch008-generator, never on this data branch/main. Provider environment targets were restored to production-only after each preview snapshot, with no provider values read or exposed. Preview snapshots retain credentials. Latest helpers expire 2026-11-04; older helper deployments may lack expiry. Deletion of our temporary preview deployments remains pending: the available connector has no deployment-delete tool. Never delete the project or production deployments.

Next: fetch/hash immutable part JSON, fresh live collision checks, atomic rollback rehearsal, actual import, stored-payload comparison, anonymous/authenticated lookup verification, idempotency, CI and data PR merge. Restore usable primary-provider quota before completing the remaining 921 concepts.
