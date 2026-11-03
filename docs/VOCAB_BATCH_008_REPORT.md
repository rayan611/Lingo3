# Vocabulary batch 008 — part 001, 2026-11-03

## Scope and status
Original target: 2,000 additional concepts / 12,000 six-language cards.
Prepared part 001: **1,079 concepts / 6,474 cards**. Remaining target: **921 concepts**.
This is an explicitly partial delivery; it does not satisfy the full 2,000-concept target.
**Imported and verified live**. Repository delivery is tracked in PR #34. The original 2,000-concept target remains incomplete by 921.

## Preparation and review
- 7,273 unused Lexin noun candidates; 2,612 distinct generated proposals, 1,533 excluded.
- Selected original proposals/source attribution retained in batch-008-part-001-lexin.json. Canonical payload is batch-008-part-001.json; all are nouns in fa/en/sv/de/es/it.
- All six-language headwords reviewed for sense consistency. Uncertain/mismatched cases were excluded, including billion/trillion, butchered compounds, false-friend translations and several culture-specific terms. This is assistant review, not independent human proofreading.
- Duplicate/automatic-language collision filtering covers all languages/POS/statuses in the old bank snapshot, including the 260 previously quarantined concepts. A fresh live precheck is required before writing.
- Swedish inflections come from the Lexin snapshot. Persian irrelevant morphology fields removed. Italian lo mapped to masculine gender il without changing the phonetic article; obvious article/gender contradictions rejected. Missing German genitives use conservative declension rules with reviewed weak-noun and compound-See corrections.
- 5,395 morphology and 6,474 expansion schema parses pass with zero failures.
- Standalone rebuild produces byte-identical SHA-256: 8482d0e6c900834fce8adea84677b46095618b779877d8b75fbc07266a6a647a.
- All nine repository regression scripts passed locally. Production build passed. CI run 41637538221 passed on preparation commit e59902bf442c3b7c99186144d05d2ebe69d69cbf; final commit checks are recorded on PR #34.

## Live import and verification
Immutable JSON fetched via pg_net request 18, HTTP 200; database and local SHA-256 match.
Fresh live precheck: zero existing IDs, zero cross-language old-key collisions and zero in-batch collisions.
Atomic import rehearsal inserted 1,079 / 6,474, then rolled back; batch count returned to zero and ready-bank count stayed 3,102.
Actual import committed under write locks with hash/count assertions: 1,079 inserts, zero skips or clashes.
Repeat import: zero inserts, 1,079 already present, zero clashes.
All 6,474 stored headwords/examples/morphology/notes exactly match the immutable JSON.

Active bank: **4,181 concepts / 25,082 cards**, up from 3,102 / 18,608. Whole ready bank has zero duplicate lemma/POS groups and zero empty examples.

| Live lookup round | Passed |
| --- | ---: |
| Anonymous automatic full headers | 6,474 / 6,474 |
| Anonymous automatic database-bare terms | 6,474 / 6,474 |
| Anonymous explicit-language full headers | 6,474 / 6,474 |
| Authenticated automatic full headers | 6,474 / 6,474 |
| Authenticated automatic database-bare terms | 6,474 / 6,474 |

Each round covers all six languages (1,079 per language), requiring six entries and the correct Swedish concept, not merely a nonempty answer. Database-bare means the actual shared_bare_word convention, which retains Italian l' elision. Sixty real anonymous RPC responses also passed the app expansion schema. Evidence: batch-008-part-001-verification.json.

## Provider limitation
Gemini still returns HTTP 402. Smaller sequential GPT-OSS and Qwen requests on the configured Groq backup answered, but sample translations were unacceptable. Mistral samples also failed semantic review. No backup-provider proposals are accepted and no credit purchase/top-up occurred. New generation stopped; do not populate the remaining 921 with poor translations to meet the count.

## Verify/rebuild
`python3 scripts/build-batch-008-part-001.py`
`node --import tsx scripts/validate-batch-008.ts data/shared-vocab/batch-008-part-001.json /tmp/batch008-failures.json`

Part validation explicitly permits a partial package through the third argument. Final batch validation without it still requires 2,000.

## Limits and operations
No app-source/schema/auth/RLS/lookup-policy change. No browser, physical-phone or offline E2E. The existing database key function retains Italian l' elision; tests using shared_bare_word must not be described as truly article-free Italian tests. Source snapshots with missing Swedish plural forms carry a note rather than an invented plural.

Generation helpers live only on ops/vocab-batch008-generator, never on this data branch/main. Provider environment targets were restored to production-only after each preview snapshot, with no provider values read or exposed. Preview snapshots retain credentials. Latest helpers expire 2026-11-04; older helper deployments may lack expiry. Deletion of our temporary preview deployments remains pending: the available connector has no deployment-delete tool. Never delete the project or production deployments.

Next: restore usable primary-provider quota before completing the remaining 921 concepts. Do not reimport this part as new work or count it twice.
