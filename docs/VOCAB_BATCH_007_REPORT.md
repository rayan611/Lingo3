# Batch 007 — final 740 active concepts / 4,440 cards

Date: 2026-11-03 (Europe/Stockholm). Supabase `vfximbxcxczntqywdryd`. PR #31.

## Final cleanup outcome

The original package imported 1,000 concepts / 6,000 cards. The owner subsequently authorised repeated checks, correcting/removing ambiguous words and merging the PR. **260 concepts / 1,560 cards were reversibly removed from active lookup** by changing only their shared-concept status from ready to rejected. Physical rows, the full committed card archive, user cards and all older batches are preserved. A physical-delete confirmation expired; no physical deletion was performed.

**Canonical import data now contains 740 active concepts / 4,440 cards.** The original 1,000-import evidence below is historical. Current ready bank: **3,102 concepts / 18,608 cards**; raw stored totals remain 3,362 / 20,168 including quarantined records. Do not automatically import `batch-007-quarantined.json` or report its words as active.

| Round | Result |
| --- | --- |
| Anonymous initial audit, full headers and bare lemmas in all six languages | 19 header-ambiguous concepts; 260 concepts ambiguous in at least one query |
| Authenticated repeat on those 260 concepts | Same 260 confirmed; 1,560/1,560 explicit-language lookups passed |
| Anonymous after quarantine, automatic full headers | **4,440/4,440 correct concepts** |
| Anonymous after quarantine, automatic bare lemmas | **4,440/4,440 correct concepts** |
| Authenticated after quarantine, automatic bare lemmas | **4,440/4,440 correct concepts** |
| Client schema validation for retained data | 3,700 morphology / 4,440 expansion parses pass |

Correctness checks compare the returned Swedish headword to the expected concept, rather than merely checking that an answer is nonempty. Most ambiguity came from shared spellings between languages or parts of speech, not mistranslations. Useful but ambiguous words were quarantined rather than given invented translations or artificial dictionary labels. The original learning-data quantity was deliberately reduced under the owner's removal authorisation. Lookup policy and application source code are unchanged; this cleanup concerns batch 007 only, not every older bank entry.

Quarantine was first rehearsed and rolled back (all 1,000 stayed active), then committed atomically under a table lock with assertions requiring 260 state changes and 740 remaining ready concepts. Evidence: `batch-007-ambiguity-audit.json`. Archive commit: `a99ee75a243e603ddee1a0ae92c18fc4242ed1a5`; archive SHA-256: `33a20e9586e87ae37be2ad2ebddb8fbfbc5f15e55824008548d66b3678c60068`.

No independent six-language human proofreading, browser or physical-phone/offline E2E. Existing CI/build checks are required before merge. Remaining examples predominantly use parallel practice frames.

## Original import history (superseded active totals)

## Delivery and accounting

The previous 1,000-concept package (PR #27) was merged into main as `3337687ceea100ac407195ad9bcba140c601e89b`, after successful CI and Vercel checks. This package is separate: **1,000 new noun concepts**, each with fa/en/sv/de/es/it cards, examples and applicable noun morphology. No previous concept was counted again; no older entry was overwritten.

| Outcome | Count |
| --- | ---: |
| Candidate rows considered | 1,233 |
| New concepts actually inserted | 1,000 |
| New language cards actually inserted | 6,000 |
| Excluded for headword collisions | 173 |
| Excluded for source/grammar review | 9 |
| Excluded for semantic overlap/specialised sense review | 4 |
| Unused reserve | 47 |
| Skipped/rejected at actual import | 0 |

The candidate pool includes 107 unused reserve candidates from preparation of the previous package; those reserve words had never been imported. All candidates were checked again against the live bank. Selection accounting is in `batch-007-selection.json`; the selected source snapshot and explicit language genders are in `batch-007-lexin.json`.

## Import evidence

- Before: **2,362 concepts / 14,168 cards**. After: **3,362 concepts / 20,168 cards**.
- Immutable final JSON fetched from GitHub with pg_net request 15, HTTP 200. Server and local SHA-256 match: `817b7c42b4fd132c4fc2b6002b8bda2ea87ace17edb93d06e3a1a015376223f2`.
- Database precheck: zero existing IDs, zero six-language headword collisions, zero in-batch duplicate lemma/POS groups. The older quadratic precheck was cancelled after 87 seconds and replaced with materialised normalized keys plus grouped/joined checks; no database functions were changed.
- Full 1,000-concept rehearsal succeeded, then rolled back. Counts remained 2,362 / 14,168 and batch-007 count remained zero.
- Actual import used one transaction, a 3-second lock timeout, a 60-second statement timeout, table write locks, payload hash validation and assertions requiring exactly 1,000 inserts, zero already-present concepts, zero clashes and 6,000 cards. Assertions passed and the transaction committed.
- Repeat import: `inserted: 0`, `already_present: 1000`, `clashes: []`.
- Final comparison: **6,000 stored headwords/examples/morphology/notes match JSON**, zero mismatches, 1,000 ready concepts. Whole bank: zero `(lang, lemma_key, POS)` duplicate groups and zero empty examples.

## Validation

| Check | Result |
| --- | --- |
| Unique IDs, Lexin source association, six languages, nonempty examples | Pass |
| App morphology schemas | 5,000/5,000 |
| App expansion schemas, all six possible native languages | 6,000/6,000 |
| Live public RPC with anonymous role and explicit source language | 6,000/6,000 return six-language answers |
| Real RPC responses through app schemas | 60/60 |
| Existing regression scripts, including grammar | 9/9 pass |
| Production TypeScript/Vite build | Pass |

Targeted assertions cover Italian gender/plural corrections, Spanish stressed-a articles with feminine gender, Swedish irregular/compound forms and German genitives. Translations and examples were authored/reviewed by the assistant. Swedish morphology comes from the attributed Lexin snapshot with reviewed overrides. Structural checks are exhaustive; there has been no independent six-language human proofreading.

Automatic source-language detection remains ambiguous for some shared spellings:

| Query | Successful |
| --- | ---: |
| Exact card headers, no specified source language | 5,964/6,000 |
| Bare Swedish lemmas, automatic language | 850/1,000 |
| Bare English lemmas, automatic language | 870/1,000 |

These cases may still use AI under the existing app lookup policy. No lookup-policy, schema, authentication or RLS changes were made. Browser, physical-phone and offline-to-online end-to-end tests were not performed. All concepts are nouns; most examples use parallel everyday practice frames rather than independently bespoke scenarios. No app deployment was initiated for this data package. This new data branch remains separate from main.

## Reproduce

```sh
python3 scripts/build-batch-007.py
node --import tsx scripts/validate-batch-007.ts
npm run build
```

`batch-007-verification.json` records numerical evidence. The builder reads the committed source snapshot and makes no network/model/database calls. Existing checks ran using `node --import tsx` for each script listed by package.json, avoiding this runtime's tsx CLI IPC issue.

Source attribution: **Svenska ord/LEXIN, second edition**, Språkbanken Text, University of Gothenburg, **CC BY 4.0**, <https://www.sprakbanken.se/resurser/lexin>. Only Swedish headwords/inflections were reused; translations and examples are newly authored. Targeted lexical checks included Treccani's [asma](https://www.treccani.it/vocabolario/asma/) and Duden's [Fötus](https://www.duden.de/rechtschreibung/Foetus) and [Grafit](https://www.duden.de/rechtschreibung/Grafit); source text was not copied into cards.
