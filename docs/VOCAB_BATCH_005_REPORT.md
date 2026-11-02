# Batch 005 — 350 new six-language noun concepts

Date: 2026-11-02 (Europe/Stockholm)
Status: DONE VERIFIED — data imported; application source/main not changed.
Branch: `data/lexin-350-20261102`
Baseline application commit: `bc487f9e2cba4631fc88ef56acbf63c75fc7539c`
Final data commit: `a9101ffcb7be2b68f571b0216c782a7402ff4ec3`
Database: Supabase Lingo3, `vfximbxcxczntqywdryd`.

## Delivered

- Exactly **350 newly inserted concepts / 2,100 language entries**, all nouns.
- Languages: Persian, English, Swedish, German, Spanish, Italian.
- All 350 Swedish lemmas came from the existing Lexin `dictionary_words` table and were absent from the shared Swedish noun bank before selection.
- Every card has a translated headword and an original example. Five languages have noun morphology (1,750 morphology objects); Persian follows the existing no-morphology schema. Uncountable senses explicitly note the absence of a normal plural. Swedish cards include gender and definite singular, with both plural forms where applicable. German cards include gender, plural where applicable and genitive singular. Spanish/Italian cards include gender and plural. No verbs/adjectives were added in this batch.
- Examples use six original parallel everyday sentence frames, selected by meaning (objects, food, places, people, observations, discussions). They are intentionally repetitive practice sentences, not 350 independently bespoke scenarios. Lexin examples and definitions were not copied.
- Auditable Swedish source forms, curated translations and selection decisions are included; `scripts/build-batch-005.py` rebuilds the batch without network or AI calls.

## Selection accounting

627 drafted candidate rows:

| Outcome | Count |
| --- | ---: |
| Selected and actually inserted | 350 |
| Excluded: not in the unused Lexin noun set (includes existing Swedish words and invalid candidates) | 57 |
| Excluded: existing-bank or earlier-candidate headword collision in any of six languages | 39 |
| Excluded: Swedish morphology needed separate review | 1 |
| Unused reserve beyond the requested 350 | 180 |

Thus **97 excluded candidates**, **180 reserve candidates**, and **zero skips/rejections at actual import**. The previous 31 prepositions and all other existing concepts are outside this count.

## Database write and concurrency evidence

1. Starting live count: **1,012 concepts / 6,068 entries**.
2. `precheck_core_vocab` passed in fourteen 25-concept slices; a global materialized-key check also found zero existing or in-batch collisions. The original all-at-once function timed out without writing anything; slices avoided that expensive cross-product.
3. Immutable GitHub data was fetched using `pg_net` (HTTP 200, request 10). Dry-run import under a transaction with table write locks asserted exactly 350 new concepts / 2,100 entries, then rolled back. Counts remained 1,012 / 6,068.
4. Actual import repeated those assertions and committed. `SHARE ROW EXCLUSIVE` locks on the two shared-bank tables prevented overlapping imports/AI writes from racing the duplicate check. Existing rows were not overwritten.
5. Live retrieval exposed 11 ambiguous new headwords. Ten English noun headers gained `the` for explicit noun lookup; Persian feather became `پر پرنده`. Only these 11 entries created by this batch were updated. Final immutable data was fetched with HTTP 200 as request 11.
6. All **2,100** database headwords/examples/morphology exactly match the final GitHub JSON: **zero mismatches**.
7. Final live count: **1,362 concepts / 8,168 entries**. This batch: 350 ready concepts / 2,100 entries. Entire ready bank: zero duplicate `(language, lemma_key, POS)` groups, zero empty examples.
8. Reimporting the final file returned `{inserted:0, already_present:350, clashes:[]}`. No duplicate cards were created.

## Validation and retrieval

| Check | Result |
| --- | --- |
| Batch count, six-language completeness, unique IDs, Lexin provenance | Pass |
| Per-language app `MorphologySchema` | 1,750 / 1,750 pass |
| App `ExpansionSchema`, all concepts × six native languages | 2,100 / 2,100 pass |
| Live RPC as `authenticated`, exact card headword and specified source language | 2,100 / 2,100 return six-language answers |
| Real RPC response samples parsed by app schemas | 36 / 36 pass |
| Live RPC as `anon`, Swedish card headers, automatic source detection | 350 / 350 pass |
| Existing regression scripts (all eight `npm test` checks, executed through `node --import tsx`) | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Byte-for-field equality of imported card data with final file | 2,100 / 2,100 match |

### Existing automatic-language ambiguity remains

Without specifying the source language, exact-headword retrieval passes **2,018 / 2,100**:

| Language | Pass / test |
| --- | ---: |
| sv | 350 / 350 |
| fa | 350 / 350 |
| de | 350 / 350 |
| en | 284 / 350 |
| es | 342 / 350 |
| it | 342 / 350 |

The remaining 82 lookups return null under the app's existing ambiguity rule (e.g. English/German `album`, or Spanish/Italian `la piscina`). These are complete, valid cards retrievable with a specified language; the automatic path can still fall back to AI. Bare homographs such as `fly` likewise remain ambiguous; `the fly` explicitly selects the noun. No lookup code was changed because the owner authorized data changes on an independent branch and prohibited unapproved main application changes. Resolving this behavior is a separate application change.

No logged-in browser or physical-phone/offline end-to-end test was performed. Offline storage and application code were unchanged. There was no main merge or production app deployment initiated for this batch; data is already live and needs no deployment.

## Reproduce local validation

```sh
python3 scripts/build-batch-005.py
node --import tsx scripts/validate-batch-005.ts
npm run typecheck
npm run build
```

`tsx` CLI's local IPC socket is prohibited in this runtime, so tests used `node --import tsx` to run the same TypeScript scripts. All eight scripts from `npm test` passed through this invocation.

Source attribution: **Svenska ord/LEXIN, 2nd edition**, Språkbanken Text, University of Gothenburg, CC BY 4.0, https://www.sprakbanken.se/resurser/lexin . Source snapshot contains only headwords and raw inflections; translations and practice sentences are newly authored. Linguistic checks were performed by the assistant and structural parsers, not an independent six-language human editorial panel.
