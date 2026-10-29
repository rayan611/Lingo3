# Lingo3 — change notes

Newest first. Each block says what changed, where it lives, and what is still open, so the next
session does not have to rediscover it.

## 2026-10-29 — Fix: Next in Review did nothing (live since the linked-words deploy)

- `src/ui/Training.tsx`: the "stay on the word you are reading when the list changes" fix remembered
  the word on screen and, seeing a different word at the new position after **Next**, put you straight
  back. Next, Previous, the arrow keys and swipes now go through `goTo()`, which moves the remembered
  word with them; only a change to the list itself is held back. Checked: Next, Next, Previous, →, ←,
  then a word added under you (stays on "on", 2/100 → 3/101), then Next again.

## 2026-10-29 — "A new version is ready" with an Update button; speaker audio allowed by the CSP

- **Why the desktop app never updated.** Nothing told a running page about a new deploy. The service
  worker installed it in the background, but the old code kept running until the app was reopened —
  which phones do constantly and a desktop app almost never; and a browser only looks for a new worker
  when a page loads. There was no update notice on any platform.
- `src/lib/updates.ts`: registers the service worker itself (`injectRegister: false` in
  `vite.config.ts`; the injected `registerSW.js` is gone) and watches two signals — the worker taking
  over (`controllerchange`) and `/version.json`, written at build time with `__BUILD_ID__`. Checks 20 s
  after start, every 30 min, when the app comes back to the screen or gets focus (at most every 5 min)
  and when it comes back online.
- `src/ui/UpdateBanner.tsx`: "✨ A new version of Lingo3 is ready. **Update now** · Later", floating at
  the top of every screen (the bottom is Review's Next bar). Never reloads by itself; **Later** hides
  it for an hour. Settings → under the version line: **Check for updates** / **Update now** with the
  result ("You have the latest version", "Could not check").
- Tested with two builds served in turn: no banner on the current build, banner after the new one went
  up, Update reloaded into the new build, no banner after. Clients still on the old code get this the
  next time they open the app once.
- **CSP fix (`vercel.json`): `media-src 'self' blob: data:`.** Without it `media-src` fell back to
  `default-src 'self'`, which blocks the `blob:` audio of the speaker fallback (`/api/tts`) and the
  `data:` silence that unlocks iOS — so on lingo3.com that fallback could not play.
- Version **0.5.0** (linked words, update notice).

## 2026-10-29 — Linked words: opposites, synonyms and look-alikes in Review

- **What it is.** Each word now keeps, per language, its opposite (↔ svart/vit, öka/minska), its one to
  three most common synonyms (≈ jobba/arbeta, with a register tag) and a look-alike that is easily
  confused with it (≠ lön/lån). Opposites and look-alikes come with one sentence using both words, and
  its translation.
- **Where it shows.** A line of small chips beside the word: on the Review card (in the room left on
  the word's line; Simple shows only the opposite) and on the recall test's answer. Tapping one opens a
  popup — meaning, speaker, the shared sentence, **+ Add to my words** (first review after
  `RELATED_STAGGER_DAYS`) or "already in your words". ✕, Close, a tap outside, Escape or the phone's
  Back close it and leave you where you were; Space and 1–4 do not reach the test behind it.
- **Two words at once.** "lön och lån", "svart / vit", "öka ↔ minska", "rich and poor" (and/och/und/y/
  et/e/и/و/&/vs, `/`, `|`, `↔`, en dash): **Check and add** expands each with the other as `partner`
  (every example uses both), saves both, and links them both ways (`linkConcepts`). **Check** shows the
  first with the second offered under Linked words. Not split: a plain space ("god morgon") or a comma
  ("ja, tack"). Replaces the adjective-only "A and B" of 10-26, which also stored its hint as notes.
- Data: `Entry.links` (`WordLink[]`), `LINK_KINDS`/`linkKindOf` in `src/db/types.ts`; `linksFrom()`
  keeps ≤1 opposite, ≤3 synonyms, ≤2 look-alikes per language, never the word itself. One bad related
  word from the model now drops that word, not the whole expansion (capped at 10).
- AI: `api/expand.ts` asks for `kind` and the shared `example`/`exampleGloss`; `partner` input in
  `src/server/aiInput.ts`. Synced as `entries.links` (jsonb); migration
  `20261029120000_lingo3_entry_links.sql`, **applied to vfximbxcxczntqywdryd on 2026-10-29**. Without
  the column the client syncs entries without links (`isMissingSchema`).
- Review (`Training.tsx`) now stays on the word you are reading when the list changes under it (a word
  added from the popup used to push a different word under you).
- Words saved before this have no links until they are expanded again. Not deployed yet.

## 2026-10-29 — Recall test: no 1–4 under the grades, new grade colours, Home

- `src/ui/Review.tsx`: the `<kbd>1</kbd>`…`<kbd>4</kbd>` under Again / Hard / Good / Easy are gone, with
  their CSS. The keys 1–4 still grade on a keyboard.
- Grade colours: **Knew it** is now a light blue and **Easy** green (`--grade-knew`, `--grade-best` at
  the foot of `src/styles.css`), so the row reads red → amber → blue → green. Dark-blue, which swaps
  its good/easy colours, is mapped the other way so the buttons look the same in every theme.
- The test's top-left **← Menu** is now **Home**, a short text pill (`.review-home`); inside a word's
  detail it is still **← Test**.
- Not deployed yet; goes out with the next change.

## 2026-10-26 — v0.4.1: automatic, no-scroll waiting practice

- The waiting popup fits the visual viewport on desktop and mobile, including small landscape
  windows and the mobile keyboard. Compact spacing and adaptive scaling replace internal scrolling.
- Removed Next: words rotate automatically every 3–6 seconds according to the displayed text length.
  Rotation pauses in a hidden tab and stops immediately when closed or the lookup finishes.
- Random selection uses reviewed cards in learning languages 1 and 2. Suspended, unreviewed and
  stable easy cards are excluded; unseen words are preferred, then less recently shown words.
  Exposure history lasts for the current app session. A single eligible word stays visible.
- Native-language translations, app theme and manual Close/Escape are retained. Passive exposure
  writes no review logs, never increments counters, and never changes FSRS schedules.
- Existing Check result block order and adjective/opposite functionality are unchanged.

## 2026-10-26 — Adjective forms and opposites; compact Check results

- Adjectives now keep and display the agreement and comparison forms that exist in each language,
  including Swedish `en`/`ett`, definite and plural forms, instead of falling back to a form-less
  entry. The expansion prompt and validation use the same shape.
- An adjective lookup asks for a natural opposite in **Worth knowing beside it**, ready to save as
  its own word. **Check and add** recognises two opposite adjectives entered with “and”, saves them as
  two concepts, and asks both expansions for a natural shared example containing both words.
- Check results use a denser layout and a two-column desktop arrangement so the decision fits with
  much less scrolling. Checking remains preview-only: it writes no review log and changes no review
  counter.
- App version: **0.4.0**.

## 2026-10-24 — A + to start the next word, and no repeated example translations in Advanced

- `src/ui/AddWord.tsx`: a small round **+** at the end of the word box clears the box, the preview,
  the saved card and its suggestions — the next word without a trip up to the Add tile, which was
  the only way to that state before. It is off when there is nothing to clear, and puts the focus
  back only on a pointer-fine device, so a phone does not raise the keyboard over the cleared card.
- The Categories pill's own **+** is a caret (▾/▴) now: two + signs a few millimetres apart meant
  two different things.
- `src/ui/WordStack.tsx`: a `hideGloss` flag on `LangRow`, set for the flashcard layout (Training →
  Advanced). The expansion is asked for the SAME situation in every language, so the native row at
  the top already carries that sentence; repeating it under each target language was three
  near-identical lines of Persian. The full word page in Browse keeps the glosses — there, reading
  one is the point.
- Still open: voice input into the word box was considered and dropped for now — the Web Speech API
  is online-only (against the app's offline goal), absent in Firefox, and poor on single words.

## 2026-10-24 — Voice guide: Windows

- `src/ui/VoiceHint.tsx`: a fourth tab, **Windows** (Settings → Time & language → Speech → Add
  voices; or add the language with Text-to-speech ticked), opened first on Windows. Notes that
  Edge has voices of its own if Chrome still shows none after a restart.

## 2026-10-24 — Hint to install a voice, with steps for Android, iPhone and Mac

- `src/ui/VoiceHint.tsx`: under Settings → Languages → Learning, a note when this device has no voice
  for a language you study ("This device has no Swedish voice installed…"). Those speakers still work
  online through `/api/tts`; a local voice also works offline and starts at once.
- **How to install a voice** opens the steps, with tabs for Android, iPhone / iPad and Mac; the tab
  for the device in hand opens first (iPadOS is told apart from a Mac by its touch points).
- `src/lib/speak.ts`: `missingVoices()` (empty until the voice list has arrived, so nothing is flagged
  on first paint) and `onVoicesChanged()`, so the note updates when the list arrives late.

## 2026-10-24 — Speakers for languages the device has no voice for

- The speaker was hidden whenever the device had no voice for a language — Swedish on many Android
  phones, most languages on desktop Chrome on Linux. Now `src/lib/speak.ts` uses the device voice
  when there is one (unchanged) and otherwise fetches the audio from the new **`api/tts.ts`**.
  `canSpeak()` replaces the old check in `SpeakButton`: the speaker shows if there is a local voice
  or the device is online.
- `api/tts.ts`: signed-in callers only, text up to 200 characters, any app language; returns MP3
  from Google Translate's voice (no key). A non-audio answer upstream is a 502, not passed on.
  Cached by the browser for a week and in memory for the session (80 clips).
- iOS: the first tap plays a few ms of generated silence so the audio element may play after the
  fetch. Not tried on a real iPhone yet.
- Settings → Audio text says that a language without a local voice goes over the internet.
- Eight new checks in `scripts/check-api.mts`.
- Open: Google's voice for Persian is unverified from here; if it has none, the request is a 502 and
  the tap stays silent.

## 2026-10-24 — Review: Simple / Advanced, Next at the foot, Home button

- **Simple / Advanced** (`src/ui/Training.tsx`): a small switch under the pickers. Simple shows each
  language's word and meaning; Advanced adds the example sentences, forms (conjugations) and notes.
  Hidden by a `flash-simple` class in CSS, nothing in `WordStack` changes. The choice is kept per
  device in `localStorage` (`lingo3.reviewMode`), default Simple; it does not sync.
- **Next at the foot of the screen**: `.flash-nav` is now `position: fixed` at the bottom (inside the
  720px column, above the safe area) instead of sticky under the card, so it no longer sits
  mid-screen on a short word. `.flash` keeps 72px at its end so the meta panel is not covered.
- **Home instead of ←** in Review's bar: new `IconHome` in `src/ui/icons.tsx`; it still goes to Add.
- **Smaller language pills** in the header (`.brand-lang`: 0.74rem, 2px 8px).

## 2026-10-23 — Settings → Invite others

- `src/ui/InviteOthers.tsx`: a panel under **You** with a short, editable message and the person's own
  link, `lingo3.com/invite/<their name>`. Share sheet, WhatsApp, Telegram, SMS, email, Facebook,
  copy message, copy link. The edit is a device-local draft (`lingua.inviteDraft`); "Use the original
  text" clears it. An edit that drops the link gets it appended when sent.
- `src/lib/invite.ts`: the English message, the link, and the share addresses; checked by
  `scripts/check-invite.ts` (part of `npm run check`).
- The front page greets an invited visitor: `/invite/<name>` always opens the landing, shows
  "💌 <name> invited you to Lingo3" and sets the tab title. The name comes only from the link and is
  shown as plain text; nothing is looked up or stored. The existing SPA rewrite already serves the path.
- Open: link previews in WhatsApp/Facebook still show the general Lingo3 card (crawlers do not run
  JavaScript). A personal preview would need a small server function.

## 2026-10-24 — Admin: AI status check

- `api/ai-status.ts` (admins only, via the database's `is_admin()`): every provider with a key does one
  real translation ("Good morning" → Swedish) through `probeProvider()` in `api/translate.ts` — the
  same call and reader the app uses, no fallback, all in parallel, 20 s each. Returns per provider:
  configured or not, place in the order, model, ok, time, the answer or the provider's own error.
- `src/ui/AiStatus.tsx`: a "Check the AIs" button in the Admin panel under Settings. Nothing runs
  until it is pressed; not counted against the hourly AI limits.
- `isAdminRequest()` in `src/server/aiSecurity.ts`. Five new checks in `scripts/check-api.mts`.

## 2026-10-24 — Review as a full-screen flashcard; shorter tiles; "Not reviewed first"

- **Review (`src/ui/Training.tsx`) is full screen**, like the recall test: `.app.focus` now also
  applies to the `training` tab, so the header and tiles are hidden. A thin bar holds **←** (back to
  Add; the phone's Back also works) and three small pickers — **List**, **Type** (topics and parts
  of speech, in two groups) and **Order** — each with its name above its value and the native select
  invisible over the pill, so a tap opens the list.
- **One flashcard**: `WordCard`/`WordStack` take `flash` and `between`. The native word heads the
  card, every language follows, then the sticky **← / n of N / Next →** bar, then the meta panel
  (type, list, topics) below the fold. Tapping the native word scrolls to that panel. Swipe left or
  right also moves between words. Checked at 390×844 and 375×667: a verb in three languages, with
  examples, glosses and all forms, fits above the Next bar with no scroll.
- In the flashcard each language's chip, word, speaker and meaning share one line; forms flow on one
  line; speakers are 28px (`.flash-card .speak` also resets the phone-wide 44px button floor).
- **Sort "Not reviewed first"**: words never shown in Review on this device first, then the ones seen
  longest ago. Kept in localStorage (`lingo3.reviewSeen`): it does not sync and never touches FSRS.
  The seen map is read once per filter/order choice so the list does not reshuffle under Next.
- **Every word card** (`WordStack` `LangRow`): the example now comes right after the meaning, then
  the forms. Language rows, examples, glosses and forms have about half the padding they had.
- **Tiles** on every screen are shorter: 60px (54px on phones), smaller icon, tighter gap.

## 2026-10-24 — Add screen as the main window; language pills; equal tiles

- Add panel (`.add-panel`): soft accent wash, accent edge and deeper shadow; tighter padding (14px)
  and no gap above the word box. Check / Check and add are 50px high with 1rem labels.
- One row under the word box: the list (its name only, with a ▾; the real select lies invisible over
  the pill, since a native select clipped the name early), Categories, and a pale-blue
  **Save for later** with a bookmark icon. It replaces the small "Later" inside the field.
  "(default)" is no longer appended to the option text.
- Header: each language you learn is a bold accent pill instead of a faint 0.75rem line.
- Tiles: `grid-auto-rows: 1fr`, so the second row is always as tall as the first.

## 2026-10-24 — Groq as the first backup AI

- `src/server/aiFallback.ts`: provider order is now **Gemini → Groq → Claude**; only providers with a
  key are tried. `callGroq()` / `readGroq()` send each endpoint's existing Claude tool to Groq's
  OpenAI-style chat API as a forced function call, so the answer has exactly the shape
  `readAnthropic` returns. Default model `openai/gpt-oss-120b` with `reasoning_effort: 'low'`;
  `GROQ_MODEL` replaces it (`LINGUA_MODEL` still only applies to the first provider).
- Used by `api/expand.ts`, `api/story.ts` and `api/translate.ts`. Ten new checks in
  `scripts/check-api.mts`.
- `GROQ_API_KEY` is set in Vercel for Production only (like `GEMINI_API_KEY`), so beta has no AI.

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

## 2026-10-23 — "Opening your words…" no longer waits forever

- Reproduced: after the v7 (lists) database upgrade, an older copy of the app still open — another
  tab, or a PWA parked in the phone's app switcher — holds the IndexedDB connection, the upgrade
  waits, and the boot screen sat on "Opening your words…" indefinitely. A failed open was also
  swallowed (the boot promise had no catch).
- `src/App.tsx`: after 8 s, or on an error, `DbStuck` explains it (close other Lingo3 tabs/windows,
  then reload) with Reload and Clear cache buttons, and shows the error text if there is one.
  Nothing deletes IndexedDB. Checked in Chromium with a held connection: the note appears at 8 s;
  closing the other tab and reloading opens the app.

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
