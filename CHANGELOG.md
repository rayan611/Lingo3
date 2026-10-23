# Lingo3 — change notes

Newest first. Each block says what changed, where it lives, and what is still open, so the next
session does not have to rediscover it.

## 2026-10-24 — Lists: default list, clearer cards, list filter, tidy Add row

Released to production (lingo3.com) together with the 10-23 word lists, the calm AI-down text and the
backup AI — all of it had been beta-only or undeployed until then.

- **Checkboxes were 42px slabs.** The global `input` rule (width 100%, padding, 42px min-height) hit
  every checkbox and radio. Reset at the foot of `src/styles.css`; also fixes Settings and the importer.
- List cards (`src/ui/WordLists.tsx`): each switch now has a title and a line saying what on and off
  mean ("Study these words", "Include in Export CSV"). New radio **Default for new words** per list.
- `Settings.defaultCollectionId` (synced as `user_settings.default_collection_id`, migration
  `20261024120000_lingo3_default_list.sql`). `defaultListId()` resolves a removed or pack id to the
  built-in list; `defaultTargetCollection()` tries the chosen list first. Removing a list moves its
  words to the chosen default (or the built-in one if it was the default).
- `inExport` was stored but never read. Settings → Export CSV now leaves out lists switched off, and
  the file gains a `list` column.
- My words (`src/ui/Browse.tsx`): the per-row list menu is gone (it pushed redo/pause/delete out of
  line); a row of toggle chips above the words picks which lists are shown, several at once, with
  counts. Moving a word to another list is on the word's card (`WordCard.tsx`). Topic and kind menus
  share a line on a phone.
- Add (`src/ui/AddWord.tsx`): List and Categories are two small pills on one row; the list pill names
  the list (default preselected each visit). Categories opens full width below the row instead of
  inside it, where it ran over the list menu. **Add later** is a small bookmark inside the word box.
- **Add a new list** is its own dashed box at the top of Your lists, above the cards; a duplicate
  name or the plan limit is reported inside that box.
- Smaller: no empty band above a panel's first heading ("Recently added"); topic pills no longer
  double height on a phone (the × inherited the 44px button height).

The migration was applied to vfximbxcxczntqywdryd on 2026-10-24, so the default list follows the
account.

## 2026-10-23 — Word lists (collections), starter packs, per-list export

Beta only, on `beta.lingo3.com`. Every word is now filed in exactly one **list**; topics stay
multi-valued and separate.

- `src/db/types.ts`: `Collection` (name, kind, active, inExport), `Concept.collectionId` and
  `Concept.seedId`, `PLANS` (free = 3 lists of your own x 300 words) and `Settings.plan`.
- `src/db/collections.ts`: create / rename / set aside / remove, the room check, `activeCollectionIds`.
  Removing a list of your own moves its words to the default list; it never deletes them.
- Dexie v7 (`src/db/db.ts`): `collections` store, `collectionId` and `seedId` indexed, every existing
  word backfilled into a fixed-id default list. `updatedAt` deliberately not restamped.
- `supabase/migrations/20261023120000_lingo3_collections.sql`: `collections` table + RLS +
  `synced_at` trigger, `concepts.collection_id` / `seed_id`, `user_settings.plan`. Additive only —
  production shares this database and never reads the new columns.
- `src/sync/sync.ts`: collections push first and pull first; `isMissingSchema()` lets a client that
  knows about the new table reach a server that does not yet, without taking the whole sync down.
- **Set aside** is a flag on the list, not a bulk suspend: no FSRS state is touched, so turning a list
  back on in March resumes its intervals. `buildQueue` and `queueCounts` both honour it — the count
  has to drop too, or the tile badge sends you to an empty review screen.
- Starter packs (`src/seed/`): A1, A2 and Everyday words, 100 concepts each, written out in all eight
  languages. No model call, no network — enabling one is a local transaction.
  **Each concept is in exactly one pack**, so all three is 300 distinct words; `seedId` is checked on
  install as the safety net, and against words you added yourself, article-stripped.
  Morphology tables and example sentences are not shipped — "redo" fills them in.
- Per-list export (`src/lib/exportDeck.ts`): Anki tab-separated with `#separator` / `#deck` /
  `#tags column` directives and one column per language; and a two-column CSV where target languages
  2 and 3 stack on the answer side, for apps that only have two fields. Primary = your first active
  target language, the same order the review card stacks.
- `src/ui/WordLists.tsx`, shown at the top of **My words** rather than as an eighth tile.
  List picker on Add; list filter and a move menu in Browse. Moving a word touches no card.
- Importing a whole list is visible and disabled, as agreed — the duplicate question is unsettled.
  The CSV importer under Settings is unchanged and still works.
- `scripts/check-collections.ts` (in `npm run check`): pack integrity, including "no word appears
  twice in any language across all packs". It caught two real homographs on the first run —
  German *sie* (she/they) inside A1, Persian نه (no/nine) across packs — both now disambiguated.

Still open: no paid plan exists, so "Lift the limits" under Your lists is simply a switch. Pack words
have no examples until you ask for them. Import is off.

## 2026-10-23 — Backup AI: Claude answers when Gemini cannot

- `src/server/aiFallback.ts`: `firstAnswer()` tries the configured providers in order — Gemini, then
  Claude (Anthropic) — within the endpoint's time budget. The first gets 60% of it when a backup
  exists, so a hung Gemini still leaves Claude time to answer. Falls through on 429, 5xx, timeout,
  network failure or an unusable answer. Both down: the last status reaches the app (429 = busy,
  else 502/504 → the calm "not available" note).
- Used by all three endpoints (`api/expand.ts`, `api/story.ts`, `api/translate.ts`); each call
  function now takes its model. `LINGUA_MODEL` / `LINGUA_STORY_MODEL` apply to the first provider
  only; the backup uses `claude-haiku-5-5`. Logs say `answered by backup anthropic` when it is used.
- Off until `ANTHROPIC_API_KEY` is set in Vercel (production). With only `GEMINI_API_KEY`
  nothing changes.
- Checks: 9 new cases in `scripts/check-api.mts` (503, 429, timeout, unusable answer, both down,
  key order, model override).

## 2026-10-23 — AI-down text everywhere, functions next to the database

- `aiErrorText(err, what)` in `src/ai/unavailable.ts`: the calm "… isn't available right now" line for
  places with no room for the full `AiDown` note. Used by Bulk add (summary line), Related words (the
  row's status) and Browse re-expand (the alert), which still showed raw errors.
- `vercel.json`: `"regions": ["dub1"]`, so `/api/*` runs in Dublin next to the Supabase project
  (eu-west-1) instead of US East: the session check and rate-limit call no longer cross the Atlantic.
- Checked, no change needed: AI routes require a signed-in user; hourly limits (expand 80, translate
  60, story 20) are atomic in `consume_ai_rate_limit` and cannot be reset from the app; `is_admin`
  is guarded by a trigger; `npm audit` 0.
- Still open: confirm CAPTCHA is on in Supabase (Auth → Attack Protection, Turnstile secret);
  `GEMINI_API_KEY` is production-only, so AI does not work on beta.lingo3.com.

## 2026-10-22 — AI unavailable: calm note + Try again

When offline or when the model side answers 5xx, the screen shows
"… isn't available right now. Try again in a little while." with a **Try again** button instead of a
raw error:

- `src/ai/unavailable.ts`: `AiUnavailableError` and `aiDownStatus(status)` (>= 500).
- `src/ui/AiDown.tsx`: the note + button (`.status.ai-down` in `src/styles.css`).
- Quick translate (`src/ai/translate.ts`, `src/ui/Translate.tsx`), Add a word preview/quick add
  (`ExpansionError.unavailable` in `src/ai/expand.ts`, `src/ui/AddWord.tsx`), Read a story
  (`src/ai/story.ts`, `src/ui/StoryMode.tsx`).
- Bad requests (4xx) and rate limits (429) keep their own messages.
- Checked by mocking a 502 from `/api/translate` in Chromium: note and retry work.
- Not covered yet: BulkAdd, RelatedWords and Browse re-expand still show their old error text.

## 2026-10-22 — Install banner

- `src/ui/installState.ts`: one shared store for install state (`useInstallMode()`:
  installed / prompt / ios / mac-safari / none, and `promptInstall()`), so the banner and the header
  `InstallButton` never both replay the same one-shot browser prompt. `public/boot.js` captures an
  early `beforeinstallprompt` as `window.__installPrompt`.
- `src/ui/InstallBanner.tsx`, mounted above `<App />` in `src/main.tsx` (so it also shows over the
  landing page). Styles `.install-banner*` in `src/styles.css`.
- Shows on every visit until installed; × hides it for this visit only (`sessionStorage` key
  `lingua.installBannerClosed`). Never shown when running installed or after `appinstalled`.
- Known limit: Safari cannot tell the page the app is installed, so the Safari tab keeps offering it
  (closable). Firefox desktop shows nothing (cannot install web apps).

## Notes for working here

- Before pushing: `npm run typecheck && npm test && npm run build` (same as CI).
- Same two features exist in Glowis and Concordia; keep behaviour in step across the three apps.
