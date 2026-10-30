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
| Expansion | Gemini, with Groq, Mistral, DeepSeek and then Claude as backups (`src/server/aiFallback.ts`), via Vercel serverless functions |
| Validation | `zod` — bad model output is rejected, not written |

## Running it

```bash
npm install
npm run dev
```

The expansion endpoint needs a key. Locally, put it in `.env`:

```
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...
DEEPSEEK_API_KEY=sk-...
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

**A merge to `main` does not deploy by itself** (`git.deploymentEnabled.main: false` in
`vercel.json`; checked with PR #9, which stayed undeployed). A release is a separate step: a
production deployment of the merged `main` commit, from the Vercel dashboard or the Vercel API
(the Claude sessions use the latter, which is why those deployments show Rayan's account as the
creator). Confirm the deployed commit under Vercel → Deployments.

Preview builds (every branch, and `beta.lingo3.com` for the `beta` branch) use the **production**
Supabase project, so a branch's sync code runs against real accounts. Since v0.7.0 they sit behind
Vercel Authentication (Settings → Deployment Protection → Vercel Authentication, "Preview"): only
people signed in to the Vercel team can open them. Production (lingo3.com) is not affected.

Configure `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY` and/or `ANTHROPIC_API_KEY` as environment variables in the project settings (Gemini answers first, then Groq, then Mistral, then DeepSeek, then Claude; any one alone also works). The key stays server-side and never reaches the browser.

If you switch a provider on or off, update the list in `src/ui/Privacy.tsx` in the same change:
the privacy page names the providers in use, and says which may train on what they receive.

## Backups

Supabase's free plan keeps **no** backups. `.github/workflows/backup.yml` makes one every night at
02:17 UTC: a `pg_dump` of the `public` and `auth` schemas, encrypted, sent to Google Drive (folder
**App backups / lingo3**), keeping 30 days. A failed run is emailed by GitHub. Setup, once — all of
it works from a phone browser:

1. **Drive receiver.** script.google.com → New project → paste `scripts/backup-drive.gs`. Change
   `SECRET` to a long random text (letters and digits). Deploy → New deployment → type *Web app*,
   execute as *Me*, access *Anyone* → allow the Drive permission → copy the Web app URL.
2. **Database address.** Supabase → Lingo3 → Connect → *Session pooler* → copy the URI and put the
   database password in it (Database → Settings → reset it if you do not have it). The direct
   connection does not work from GitHub (IPv6 only).
3. **GitHub secrets.** github.com/rayan611/Lingo3 → Settings → Secrets and variables → Actions →
   New repository secret, four times:
   `SUPABASE_DB_URL` (step 2), `BACKUP_UPLOAD_URL` (the Web app URL), `BACKUP_UPLOAD_SECRET` (the
   `SECRET` text), `BACKUP_PASSPHRASE` (a different long text — **write it down somewhere safe**:
   without it the backups cannot be opened, and nobody can recover it).
4. **Test.** Actions → backup → Run workflow. A green run and a file in Drive mean it works.

Until all four secrets exist the job only notes that it is not configured, so it never fails
noisily. The repository is public; the secrets never appear in the log and the file is encrypted
before it leaves GitHub.

**Restoring** (needs a computer with PostgreSQL 17 tools and gpg):

```bash
gpg --decrypt lingo3-2026-10-31.dump.gpg > lingo3.dump
```

```bash
pg_restore --list lingo3.dump
```

```bash
pg_restore --dbname "$TARGET_DB_URL" --data-only --schema=public lingo3.dump
```

Restore into a fresh Supabase project, or into the same one after the damage is understood.
`--data-only` with the schema already in place (`supabase/schema.sql` plus `supabase/migrations/`)
is the safe order; the `auth` schema is in the dump so accounts can be matched up by id.

## Database advisor notices that are expected

Supabase's advisor lists these; they were checked in the 2026-10-30 audit and are intentional:

- `hub_access` has RLS with no policy: nothing may read it except the functions below.
- `hub_call`, `hub_feedback_status`, `hub_user_manage` callable by `anon`: the control center calls
  them with its token, checked against a hash inside each. Since v0.7.0 every user action is
  recorded in `hub_audit`, and deletes (3/hour) and suspends (20/hour) are capped.
- `is_admin`, `admin_stats`, `delete_my_account` callable by signed-in users: each checks the
  caller itself.
- Leaked-password protection: a Pro-plan feature; Lingo3's organisation is on the free plan.

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
