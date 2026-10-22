# Lingo3 — change notes

Newest first. Each block says what changed, where it lives, and what is still open, so the next
session does not have to rediscover it.

## 2026-10-22 — Remove from review / Delete on test and review cards

- `src/ui/CardActions.tsx`: small **Remove from review** and red **Delete** buttons at the far edge of
  the Recall test prompt card (`src/ui/Review.tsx`) and the Review word card (`src/ui/Training.tsx`,
  via a new `actions` slot on `WordCard`). Styles `.card-actions`, `.card-action` in `src/styles.css`.
- `src/lib/wordActions.ts`: `removeFromReview` (suspends every card; resume in My words) and
  `deleteWord` (soft delete, now also used by My words).
- Recall test drops the word from the queue and shows the next one. Review now hides words whose cards
  are all suspended, so paused words no longer show there.
- Not done yet: the same buttons in Glowis and Concordia.

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
