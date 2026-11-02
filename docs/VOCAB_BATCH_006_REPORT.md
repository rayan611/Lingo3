# Batch 006: 1,000 additional concepts / 6,000 cards

Date: 2026-11-02, Europe/Stockholm. Agent: Codex.
Status: DONE VERIFIED — additive bank import completed; main application unchanged.
Branch: `data/lexin-1000-batch-006`.
Starting main: `81a26505481d0f692b92d73653b174f938589e47` (previous PR #25 was already merged).
Final data commit: `da68557e7fd09262e9a3325ef13ad8c11e550011`.
Project: Lingo3 Supabase `vfximbxcxczntqywdryd`.

## Actual delivery

Exactly **1,000 newly inserted noun concepts** with **6,000 entries** in fa/en/sv/de/es/it, excluding every concept from previous batches. All 1,000 are ready. Every card has a headword and example. Five languages have language-specific noun morphology (5,000 objects); Persian uses the existing schema without grammatical gender. Count/mass and plural-only cases are documented. Swedish has definite singular and both plurals where applicable; German has gender, plural where applicable and genitive; Spanish/Italian have gender and plural where applicable. This batch adds nouns, not verbs or adjectives.

Translations and examples were authored by the assistant. Most examples use six parallel everyday sentence frames selected by meaning; the push concept has a bespoke parallel example. This is not a collection of 1,000 independently bespoke scenarios. Morphology uses curated forms, Lexin inflections and reviewed regular-language rules, with explicit irregular, gender, weak-declension, mass/plural-only and missing-Lexin-plural overrides. Structural validation is exhaustive; the work has not been independently proofread by human editors in all six languages.

## Selection accounting

| Outcome | Count |
| --- | ---: |
| Candidate rows considered | 1,734 |
| Selected, actually inserted | 1,000 |
| Excluded: not in unused Lexin noun set (includes already-imported words) | 402 |
| Excluded: existing or earlier-candidate headword collision | 216 |
| Excluded: Swedish morphology/plural needs separate review | 6 |
| Excluded: sense or modern usage needs separate review | 3 |
| Unused reserve | 107 |
| Skipped/rejected at actual import | 0 |

Total exclusions: **627**. Reserve is not counted as imported. The earlier 350 concepts and 31 prepositions were excluded. Detailed decisions are in `data/shared-vocab/batch-006-selection.json`. Selected headwords, reviewed translations and original raw Swedish forms are in `batch-006-lexin.json`.

## Import evidence

- Initial live totals: **1,362 concepts / 8,168 entries**.
- Global six-language duplicate prechecks, including in-batch collisions and source IDs: zero clashes.
- Immutable initial JSON fetched from GitHub with `pg_net`, HTTP 200, request 12. SHA-256 matched the local file.
- The complete 1,000-concept import was tested in a transaction and rolled back. Assertions required 1,000 inserts, zero existing IDs, zero clashes and 6,000 entries. Totals remained unchanged after rollback.
- Actual import was **one atomic transaction** containing all 1,000 concepts. `SHARE ROW EXCLUSIVE` locks on shared tables prevented another import or AI write from racing the duplicate check. Any unexpected collision or incomplete count would have rolled the whole batch back.
- Retrieval found one Persian noun/verb ambiguity: `هل دادن`. The new noun card became `هُل`; all six examples of that newly inserted concept were made parallel. Exactly six new entries were adjusted; no older concept was overwritten. Final immutable JSON was fetched as request 13 and matches all 6,000 database payloads, including notes.
- Final file SHA-256: `901a0f7e0f097868f4d0a39007046fcf9c0832b90482f2b72716b1020c4dc4c1`.
- Final live totals: **2,362 concepts / 14,168 entries**.
- Reimporting the final JSON returned `inserted: 0`, `already_present: 1000`, `clashes: []`.
- Entire bank: zero duplicate `(lang, lemma_key, POS)` groups, zero empty examples. This batch: 1,000 ready concepts, 6,000 matching payloads, zero mismatches.

## Test results and limits

| Check | Result |
| --- | --- |
| Count, six-language completeness, unique IDs and source association | Pass |
| App morphology parser | 5,000/5,000 pass |
| App expansion parser, each concept with all six possible native languages | 6,000/6,000 pass |
| Targeted irregular-form, gender and declension assertions | Pass |
| Live authenticated RPC, exact card headers with specified source language | 6,000/6,000 return six-language answers |
| Actual RPC answers parsed through app schemas | 60/60 pass |
| Anonymous RPC, Swedish card headers, automatic source language | 1,000/1,000 pass |
| Existing eight regression scripts, `node --import tsx` invocation | All pass |
| TypeScript typecheck | Pass |
| Production build | Pass |
| Imported headwords, examples, morphology and notes vs final JSON | 6,000/6,000 match |

### Automatic language detection is not universally solved

The app's existing ambiguity policy remains unchanged. Card headers include Swedish/German/Spanish/Italian articles and English `the` to make noun lookups explicit. Header lookup without a source language passes **5,936/6,000**: sv/en/fa/de 1,000 each, es 967, it 969. The remaining 64 share words across languages, such as Spanish/Italian `la corona`.

More realistically, when the user types **bare lemmas without an article and without a source language**, only **758/1,000 Swedish** and **827/1,000 English** tests return an unambiguous bank result. The other cases can still fall back to AI because of shared spelling or part-of-speech ambiguity. Therefore this delivery is 1,000 complete new concepts, not a claim that every possible unqualified query bypasses AI. Solving ambiguity requires a separately approved application change. No performance-saving percentage was inferred or claimed.

No browser login, physical-phone, or offline-to-online end-to-end test was performed. This is a data-only delivery; no app deployment or schema/auth/RLS change was initiated. The independent branch is not merged into main by this session.

## Reproduce

```sh
python3 scripts/build-batch-006.py
node --import tsx scripts/validate-batch-006.ts
npm run typecheck
npm run build
```

The builder reads the committed reviewed source snapshot and makes no network/model calls. Tests use `node --import tsx` because the CLI's IPC socket is not permitted in this execution environment.

Source attribution: **Svenska ord/LEXIN, second edition**, Språkbanken Text, University of Gothenburg, **CC BY 4.0**, https://www.sprakbanken.se/resurser/lexin . Only Swedish headwords and raw inflections were reused; translations and examples are newly authored. Lexin definitions were consulted to check selected polysemous senses, not copied into cards.
