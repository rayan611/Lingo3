# Vocabulary batch 012 (2026-11-27)

Source: owner's `lingo3_vocab_5000.db` (first 5,000 Swedish words, Copilot translations, not reviewed by native speakers).
Files: `data/shared-vocab/batch-012-part-01..04.json`, format `lingo3-vocab/1`, 8 languages, one example per entry.

| Part | Imported | Notes |
|---|---|---|
| 01 | 74 | |
| 02 | 69 | |
| 03 | 84 | `drunk` skipped by the importer (sv `full` clashes with `core.a.full`) |
| 04 | 56 | |
| **Total** | **283 concepts / 2,264 entries** | 0 pre-check clashes |

How the 5,000 were narrowed (kept concepts: 1,035 after automatic filters, 283 imported so far):
- 1,645 already linked to the bank, 1,592 had at least one language already in the bank (strict: any pos), 301 nouns without article,
  208 without pos, 73 non-infinitive verbs, 2 modals; 135 repeats inside the file were dropped (first rank wins).
- Manual review of the first 4 parts rejected ~115 more (wrong or ambiguous pairs, e.g. `mile` ↔ sv `mil`, `lord`, `host`, `self`, `bar`, comparatives, hyphen stems).
- Adverbs the source had marked adjective were re-typed (`daily`, `definitely`, `generally`, `literally`, `obviously`, `honestly`, `specifically`, `ultimately`, `significantly`, `widely`, `worldwide`, `constantly`, `somehow`, `initially`, `effectively`, `necessarily`, `shortly`, `respectively`, `successfully`, `meanwhile`, `basically`).
- Morphology (`f`) comes from the source where complete; es/it/fr/ru verbs and adjectives have none (the source has none), so look-up of their inflected forms is weaker.
- All example sentences were written fresh for this batch (the source examples often lacked the Swedish headword).

Still open: about 750 clean concepts remain (ids in the source DB, ranks above ~2760); native-speaker review of fa/es/it/fr/ru.

## Update — second pass (same day)
Owner asked that the source database be used as given and only missing example sentences be added. Parts 05 and 06
(542 concepts) were built that way: every source word, article, translation and existing example was kept; only blanks
(and examples that lacked the headword) were written. The ~115 pairs rejected in the first pass were put back.
Total imported from the 5,000-word database: **825 concepts** (parts 01-06), 0 clashes in the last two parts.

Not importable and still outside the bank: 300 nouns with no article in sv/de/es/it/fr, 208 rows with no part of speech
(importer needs one), 1,645 already in the bank, 1,599 sharing a word with the bank, 170 repeated inside the file.
Known weak spots left as in the source: modal pairs (`would`, `could`), `mile` ↔ sv `mil`, `lord`, `host`, `self`; `ultra` is typed adverb.
