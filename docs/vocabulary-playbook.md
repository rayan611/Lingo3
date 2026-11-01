# Lingo3 — Shared Vocabulary Bank: Playbook for Future Chats

Give this whole file to a new chat. It explains what exists, the rules, and the exact procedure to add the next batch of 250 words without creating duplicates.

Last updated: 2026-11-01 (after batch 001).

---

## 1. Goal

Lingo3 has one **central shared vocabulary bank** in Supabase. Every word is a *concept* with one card per language: **fa, en, sv, de, es, it**. Each card has a headword, morphology (forms), an example sentence, optional notes.

Why: the app's AI should only answer when the bank cannot. Cards prepared in advance (by Claude in a chat, not by the app's AI) are cheaper, faster and consistent.

Current state: core batch (299) + batch 001 (237 imported) + words users added through the AI. About 537+ concepts, 3,200+ entries. Check live numbers with SQL before starting.

## 2. How the app uses the bank (runtime flow)

1. User types a word (any of the six languages, with or without article / `to` / `att`).
2. The app first asks the bank: `lookup_shared_expansion(search_term, search_lang, native_lang, target_langs)`.
   - Matching uses `shared_lemma_key(word, lang)`: lowercase, article / `to` / `att` removed, NFC, **accents kept** (schon ≠ schön), Arabic ي/ك → ی/ک.
   - A candidate must be `status = 'ready'` and have **all wanted languages** (user's native + target languages) with headword and example.
   - `core` beats `ai`; a form typed with its article/`to` beats a bare homograph.
   - If not exactly one concept / one matching language → returns null (ambiguous words go to the AI).
3. Partial hit (word in bank, some selected languages missing): `lookup_shared_partial` + AI for the missing languages only; combined card saved after the answer.
3b. Bank hit → show the card, label "Shared bank". No AI call.
4. Bank miss → AI answers (chain Gemini → Groq → Mistral → DeepSeek → Claude), label "AI".
5. **After the result is shown to the user**, the AI answer is written to the bank via `cache_ai_expansion(cache_key, expansion)` (service role only), for all languages in the answer. Rationale: the write and any missing-language generation cost extra time, so the user must never wait for them.
   - Implemented in `api/expand.ts`: the write is deferred with the platform's `waitUntil` (or after `res.end()` on the Node convention), so the user never waits. Only if neither is available is it awaited before returning.
6. Merge rules in `cache_ai_expansion`: find stored concept by typed word's (lang, lemma_key, pos); else merge into a concept sharing ≥2 languages' words with the same pos (ties never merge); else create a new `ai` concept. Entries use `ON CONFLICT DO NOTHING` — existing core/AI entries are never overwritten. Words with a hint or a partner stay personal and are not cached.
7. AI-added concepts go `ready` immediately with structural checks only. Review later (section 8).

## 3. Database objects

Tables
- `shared_concepts` (id, source_key unique, source `core|ai`, source_lang, lemma, pos, tags, status `draft|ready|rejected`, reviewed_at)
- `shared_entries` (concept_id, lang, headword, morphology jsonb, example, notes, source, generated `lemma_key`; unique (concept_id, lang)). Read access (RLS) only for `ready` concepts.
- Lexin (Swedish dictionary): `dictionary_words` (id, lemma, pos, pronunciation, inflection_raw, source, lexin_compounds, lexin_idioms), `dictionary_senses` (word_id, definition_sv, usage_sv, examples_sv, idioms_sv, compounds_sv …). ~18,880 words / 21,179 senses. `dictionary_entries` is empty.

Functions
- `shared_bare_word`, `shared_lemma_key`
- `lookup_shared_expansion` (anon, authenticated, service_role)
- `cache_ai_expansion` (service_role only)
- `review_shared_concept(concept, approve)` + view `shared_review_queue` (service_role only)
- `import_core_vocab_batch(doc jsonb)` (service_role only) — bulk importer, see section 5

Project: Supabase project **Lingo3**, id `vfximbxcxczntqywdryd` (eu-west-1). Repo: `rayan611/lingo3`. Production deploys on Vercel are manual (git auto-deploy for main is off); a data-only batch needs **no** app deploy.

## 4. Golden rule: no duplicates, ever

Before choosing words for a batch, and again before importing:

1. Query what is in the bank (per language lemma keys and existing ids):
   ```sql
   select lang, lemma_key from public.shared_entries where lang = 'sv';   -- or all langs
   select source_key from public.shared_concepts;
   ```
2. Candidate Swedish words must not be in `shared_entries` (lang `sv`) **and** their English/German/etc. translations must not collide either (synonyms are the usual trap: pretty/beautiful, real/true, before/already).
3. IDs (`core.n.xxx`, `core.v.xxx`, `core.a.xxx`, `core.d.xxx`) must be new. Batch 001 had 3 id collisions (`a.full`, `d.still`, `d.soon`) — those concepts were silently skipped, so re-add them under different slugs in a later batch.
4. Within one batch headwords must be unique per language after stripping the article and diacritics (sv `var`/`vår`, `svar`/`svår` clash in the app).
5. The importer is the final safety net: it skips any concept whose `source_key` exists, **and** any concept that shares (language, lemma_key, pos) with an existing non-rejected card, and reports both. Always read its report.

Skipped from batch 001 (re-use ideas, but with a different word choice): pretty, warm, calm, clear, real, fake, approximately, fairly, before, later, ever, away, moon, photo, plus the 3 id collisions (full, still, soon).

## 5. Procedure for a new batch of 250

Work directory suggestion: a scratch folder with `src/` (pipe files), `build_batch.py`, `check/validate.ts`.

1. **Pick words.** Source: Lexin Swedish words not yet in the bank. Query the DB directly (no need to paste the list):
   ```sql
   select w.lemma, w.pos
   from public.dictionary_words w
   where not exists (select 1 from public.shared_entries e
                     where e.lang='sv' and e.lemma_key = public.shared_lemma_key(w.lemma,'sv'))
   order by w.lemma limit 400;
   ```
   Prefer frequent, everyday nouns, verbs, adjectives, adverbs (about 100 N / 70 V / 50 A / 30 D). Skip proper names, abbreviations, very rare or very technical words.
2. **Write source files** `n.txt, v.txt, a.txt, d.txt` in pipe format (section 6).
3. **Build:** `python3 build_batch.py <srcdir> <outdir>` → `batch.json` (format `lingo3-vocab/1`). Fix every reported problem (field counts, in-batch clashes).
4. **Validate morphology** with the repo's own parser: `npx tsx check/validate.ts batch.json` (must print `bad: 0`).
5. **Commit** the JSON as `data/shared-vocab/batch-NNN.json` on a branch; push; open a PR.
6. **Import into the DB.** The repo is public, so Postgres can fetch the file itself (avoids retyping data through chat):
   ```sql
   select net.http_get('https://raw.githubusercontent.com/rayan611/lingo3/<commit-sha>/data/shared-vocab/batch-NNN.json', timeout_milliseconds := 15000);   -- note the request id
   select status_code, length(content) from net._http_response where id = <id>;
   select public.import_core_vocab_batch(content::jsonb) from net._http_response where id = <id>;
   ```
   Result: `{inserted, already_present, clashes:[{id, with}]}`.
7. **Verify:** counts of concepts/entries; run 3–5 `lookup_shared_expansion` calls in different languages (e.g. `('bro','sv','fa',array['en','de'])`).
8. **Merge** the PR after CI `verify` passes (merging to main = release; ask the user if permission is needed). Update this file's "Skipped" list and the state numbers.

Size: a batch of 250 ≈ 220 KB JSON ≈ 1 MB in the DB. The whole DB is ~30 MB; free-tier limit assumed 500 MB.

## 6. Source file format (pipe-separated)

One block per concept: a header line, then one line per language in this order: fa, en, sv, de, es, it. Blank line between blocks.

Header: `#N|#V|#A|#D <slug> <tag>` — slug is the English headword without spaces (becomes `core.<n|v|a|d>.<slug>`), tag is a topic word (home, food, travel …).

Fields after the language code (the last field is always the example sentence `x`):

| POS | fa | en | sv | de | es | it |
|---|---|---|---|---|---|---|
| Noun | h x | h pl x | h ds ip dp x | h pl gen x | h g pl x | h g pl x |
| Verb | h notes x | h t3 past pp x | h pres pret sup imp part x | h pres pret pp aux imp prefix x | h pres pret pp ger imp refl x | h pres pp aux ger imp rifl x |
| Adjective | h x | h comp sup x | h neut pl comp sup x | h comp sup x | h fem pl comp x | h fem pl comp x |
| Adverb | h x | h x | h x | h x | h x | h x |

Notes
- Noun headwords carry the article: sv `en bro` / `ett hus` (h, ds = definite singular, ip/dp = indefinite/definite plural), de `die Brücke`, es `el puente`, it `il ponte`. For es/it the gender `g` may be blank when the article already shows it; for `l'` headwords give `g`.
- English verb headword has no `to` in the source; the builder adds it.
- Verb fa `notes` e.g. `ماضی: خورد · مضارع: خور`; es `refl` and it `rifl` are `0` or `1`.
- Verbs without imperative/participle (cost, rain, snow) leave those fields empty but keep the pipes.
- Leave comparative/superlative empty (not a dash) where none exists (half, real, fake, own).
- Farsi cards have no morphology (stored as null); the Farsi example sentence is required.
- Example sentences: short, natural, everyday, one per language, correct accents and punctuation.

Quality rules
- Check every language yourself: gender/article, plural, irregular forms (sv strong verbs, de strong verbs and aux haben/sein, es stem changes, it aux avere/essere), reflexive status.
- Prefer the most common meaning; choose the translation a learner needs, avoid rare synonyms.
- Do not reproduce Lexin definitions or copyrighted text in cards. Lexin is only a **word list and frequency guide**; examples and translations are written fresh. (Check the Lexin licence before any public release.)

## 7. Lexin data: what is stored and how to use it

Lexin is already in the database (`dictionary_words`, `dictionary_senses`); it is not pasted into this file because of its size (~19k words). A chat can read it with SQL: for a word, `dictionary_words.lemma/pos/inflection_raw` give the lemma, part of speech and raw inflection, and `dictionary_senses.definition_sv/examples_sv` give meaning and Swedish examples, useful to disambiguate which sense to translate. The SQL function `lexin_context(search_term)` returns that context for a word.

If a standalone file is wanted (offline chats), export a list: `select lemma, pos, inflection_raw from dictionary_words order by lemma` as CSV and attach it separately; mark words already in the bank by joining on `shared_lemma_key`.

## 8. Reviewing and correcting cards

- AI-added concepts: `select * from shared_review_queue;` (service role). Approve or reject with `review_shared_concept(concept_id, true|false)`. Rejected cards stop being returned by lookup.
- Periodic quality pass by Claude: read a slice of cards (core and ai), fix wrong forms/examples with `update shared_entries …`, and set `reviewed_at`. A scheduled task can do this weekly on the queue.
- No admin UI for the queue yet.

## 9. Standing rules

- Merging to main = release; ask the user when permission is needed. Data-only changes need no deploy.
- Secrets (service key etc.) never go through chat; the Vercel env var `SUPABASE_SERVICE_ROLE_KEY` is already set (sb_secret_* keys go in `apikey` only; JWT keys also in `Authorization`).
- Each batch is independent and safe to interrupt; the importer is idempotent.
- Plan/token usage cannot be read by Claude; the user checks Settings → Usage.
- The app label "Shared bank" / "AI" is shown in the preview only and never stored on cards.

## 10. Open items

1. Weekly AI review of the review queue (scheduled task).
2. Admin UI for the queue (optional).
3. Clean up duplicates created before the consensus merge (optional).
4. Lexin licence check before public release.
5. Batches 002, 003 … of 250 words each, following section 5.
