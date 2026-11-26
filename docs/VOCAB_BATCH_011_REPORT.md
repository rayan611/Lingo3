# Vocabulary batch 011 — from the owner's word lists (2026-11-26)

Source files (owner): `Vocabulary_Bank_EN_SV_DE_8000_v2.xlsx` (8,000 ranked words, EN/SV/DE, levels A1–C1, forms, examples for 853 A1 words) and `3_i_1_SE-EN-DE.xlsx` (personal notebook: verbs, nouns, daily phrases, grammar, links; informal, not used for this batch).

## Analysis of the 8,000-word list against the live bank (project vfximbxcxczntqywdryd)
| | Count |
|---|---|
| Words in the file | 8,000 |
| Nouns/verbs/adjectives/adverbs processed | 7,781 |
| Function words (pronouns, prepositions, numbers, conjunctions) — not processed | 219 |
| **Already in the bank** (same pos, same headword in en/sv/de) | **2,756** (1,637 match in two or more languages, 1,119 in one) |
| Duplicates inside the file itself | 225 (662 words involved) |
| **New, no clash anywhere** | **4,800** |
| Bank concepts without French and Russian before this batch | 4,284 of 4,484 |

## Imported: batch 011
- File: `data/shared-vocab/batch-011.json`, 73 concepts / 584 entries, **all eight languages** (fa, en, sv, de, es, it, fr, ru) for every concept: 47 nouns, 9 verbs, 16 adjectives, 1 adverb. Each entry has a headword, forms and an example sentence. English/Swedish/German heads, forms and examples come from the list (examples rewritten only where the file's example did not contain the headword); Persian, Spanish, Italian, French and Russian were written fresh.
- Selection: highest-frequency clean words (rank order), then curated: 20 candidates dropped because another concept already owns the same headword in fa/es/it (job, home, photo, keep, hope, …); 2 more dropped by the final pre-check (field, league); some rewritten (e.g. Persian heads for complete, general, personal, version).
- Import result: `{inserted: 73, already_present: 0, clashes: []}`. Bank now: ready concepts 4,484 → **4,557**, ready entries 27,294 → **27,878**, French and Russian entries 200 → **273** each.
- Checks: schema validation with the app's own `MorphologySchema`/`ExpansionSchema` (`scripts/check-vocab-011.ts`, in `npm test`); `precheck_core_vocab` returned `[]` before import; health queries after import: no empty examples, no morphology/pos mismatch, 73/73 concepts with 8 languages. Five real `lookup_shared_expansion` calls (ru→sv/fr/en, en→fa/fr/ru, fr→fa/ru/de, de→en/fr, en→sv/ru) all returned a bank hit, no AI.
- One duplicate group exists in the bank and is **not** from this batch: Persian `قوی` (adjective) in `core.a.strong` and the AI-added `ai:sv:adjective:kraftig`. Left as is.

## Limits (be aware)
- Only 73 of the 4,800 new words are in; the rest need the same careful per-word writing and pre-check. Existing bank concepts still lack French/Russian (4,211 of them).
- French/Italian nouns that start with a vowel are stored with `l'` (e.g. `l'air`); the bank's lookup strips only `le/la/les` (fr) and `il/lo/la/…` (it), so a user typing the bare word may miss. Verbs have no `additionalForms` (extra conjugations), so inflected verb forms in fr/es/it/ru may not match until added.
- Spanish/Italian/French/Russian/Persian text was written in one pass without a native-speaker review; a periodic review of the new cards is recommended.

## Next steps
1. Batch 012+: next ~100 clean words by rank, same procedure (pre-check first, then cards).
2. A French/Russian completion batch for existing concepts (adds `fr`,`ru` entries to concepts that already have fa/en/sv/de/es/it) — needs an additive importer (the current one skips existing concepts).
3. Decide whether to widen the pre-check to synonyms (e.g. job/work, photo/picture), which caused most of the 20 drops.
