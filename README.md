# Lingo3

A personal vocabulary trainer for learning several languages at once. Offline-capable PWA — installs on a phone or PC, reviews work with no connection.

**The loop:** add a word → a model expands it into every language you study (forms, gender, an example) → review it with FSRS scheduling. Reading, audio and cloud sync are all in as of v3.2; the build log in the project docs is the current account of what exists and why.

## The two design decisions worth knowing

**One FSRS card per (word × language), not one per word.**
A single card carrying three answers means one scheduling decision for three different memories with three different difficulties. FSRS needs one card to mean one memory trace or the intervals stop meaning anything.

What you see is still one card with every active language stacked in priority order, and you rate each language separately. The word reappears based on the soonest due date among active languages — which in practice is the language you rated worst. The gain over a single blended score is that pausing German freezes its state exactly where it was and resumes at the right interval months later, instead of starting over, and it can never contaminate Swedish's schedule.

**AI runs at write time, never at review time.**
Expansion happens once, when you add the word, and the result is stored locally forever. Reviewing never touches the network. Words added offline go into a pending queue and fill in when you are back online.

## Stack

| Concern | Choice |
|---|---|
| App | Vite + React + TypeScript, `vite-plugin-pwa` |
| Local store | Dexie (IndexedDB) |
| Scheduling | `ts-fsrs` (FSRS v6) |
| Expansion | Gemini, with Groq and then Claude as backups (`src/server/aiFallback.ts`), via Vercel serverless functions |
| Validation | `zod` — bad model output is rejected, not written |

## Running it

```bash
npm install
npm run dev
```

The expansion endpoint needs a key. Locally, put it in `.env`:

```
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
LINGUA_MODEL=claude-haiku-5-5    # optional; this is the default
```

`npm run dev` serves the front end only. To exercise `/api/expand` locally, run `vercel dev` instead (`npm i -g vercel`). Without a key the app still works — words save locally and sit in the pending queue.

```bash
npm run build     # production build
npm run typecheck
npm run check     # scheduling behaviour checks
```

## Deploying

Automatic Vercel deployment of `main` is disabled in `vercel.json`. A push alone is not a release; use the reviewed manual Vercel release procedure and confirm the deployed commit. Configure `GEMINI_API_KEY`, `GROQ_API_KEY` and/or `ANTHROPIC_API_KEY` as environment variables in the project settings (Gemini answers first, then Groq, then Claude; any one alone also works). The key stays server-side and never reaches the browser.

## Data model

```
Collection     one list; a Concept belongs to exactly one
Concept        one idea, language-independent
  └── Entry    one per language: headword, meaning, morphology, example
  └── Card     one per target language: FSRS state
ReviewLog      append-only, never conflicts on sync
Pending        words added offline, awaiting expansion
```

A **list** is where a word is filed; **topics** are what it is about, and a word has several of
those. Keeping them apart is what makes counting, exporting and setting a list aside cheap — one
owner per word, so each is a filter rather than a membership table to reconcile across devices.

Setting a list aside is a flag on the list, never a bulk suspend of its cards: no FSRS state is
touched, so a list switched off in October resumes its intervals when it comes back in March.

Mutable rows carry update timestamps for the existing cloud-sync implementation. The review log is append-only by design — it is the bulk of write volume and it can never conflict.

Morphology is stored **per language**, not in a shared schema. German needs an auxiliary verb (`haben`/`sein`) and a separable-prefix flag that Swedish has no use for; the two gender systems are unrelated. A shared schema silently drops exactly the fields a learner most often gets wrong.

## Known gaps

- **Speech availability.** Device voices are preferred. The Google speech fallback needs a connection and can be unavailable; text is sent to Google when it is used.
- **Backup remains important.** Cloud sync is available, but export a full backup before clearing site data or making bulk changes.
- **Four-language ceiling.** The schema is general, but the UI assumes a handful.
- **No list import.** Bringing a whole list in from another app is switched off: deciding what counts
  as a duplicate of a word you already have is unsettled. The CSV importer under Settings works.
- **Starter packs ship without morphology.** The three packs carry the headword (with its article)
  and a gloss in all eight languages; verb tables and example sentences arrive when you press redo.
