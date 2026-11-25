# Decision log (for humans and AI agents)

Newest first. One entry per standing decision: what, why, and what it means for the next change. Do not reverse an
entry without the owner's say-so; add a new entry that supersedes it instead. Current-state detail lives in
`docs/DEVELOPMENT_HANDOFF.md`, chronology in `docs/DEVELOPMENT_HISTORY.md`, remaining work in `docs/ACADEMY_ROADMAP.md`
and `docs/ACADEMY_IMPROVEMENT_PLAN.md`, UI rules in `docs/UI_STANDARDS.md`.

## D-08 · 2026-11-25 · UI changes are ratcheted, not rewritten
The Academy stylesheet carries historical debt. `scripts/check-ui-standards.mjs` freezes the counts (hex colours,
`!important`, odd breakpoints, repeated `.academy-nav.is-open`) as ceilings that may only fall. New work uses `--ac-*`
tokens and the shared components. **Consequence:** lower a ceiling in the same change that removes debt; never raise one.

## D-07 · 2026-11-25 · One design direction: calm, light, card-based
Option A of the redesign proposal, chosen by the owner: one primary colour (`--ac-primary`), soft neutrals, solid
buttons, one card style, bottom bar on phones, three-level menus at most. No gradients, no gold highlight.
**Consequence:** see `docs/UI_STANDARDS.md`; new screens follow it, old screens migrate screen by screen.

## D-06 · 2026-11-25 · The phone menu is a fixed sheet; its ancestors must not filter
The open menu is `position: fixed` above the bottom bar. An ancestor with `backdrop-filter`, `transform` or `filter`
becomes its containing block and pushes it off-screen (this broke the menu until v0.7.23). **Consequence:** the header is
opaque at ≤ 860 px; a test and the UI check guard it.

## D-05 · 2026-11-25 · Refreshing an Academy page must never end on an error page
`api/academy-page.ts` renders crawlable HTML for search engines. On any failure it now returns the plain app shell
(HTTP 200, `no-store`); sighted users see a loading indicator instead of the unstyled crawl text. **Consequence:**
anything added to that handler must be inside the same `try`, and database calls keep a short timeout (4 s).

## D-04 · 2026-11-25 · Lesson words reach the student through the App's own vocabulary, not a second system
A teacher publishes through `academy_publish_lesson` (the only write path; nothing is visible before publishing). The
App pulls published rows after sign-in and on tab focus and writes them with `installLessonWords` into the list
"From my lessons" using `seedId = lesson:<row id>`. Duplicates are prevented by `seedId` (including removed words) and by
headword. **Why:** the App already owns scheduling (one FSRS card per word per language); a parallel
`student_word_cards` table would split review history. **Consequence:** changes to delivery edit `src/seed/lessonWords.ts`
and `scripts/check-lesson-words.ts`; the Academy still never opens Dexie.

## D-03 · 2026-11-25 · Academy code is split by loading cost, translations live in data files
Portal, admin users, lifecycle, SEO manager and article studio are lazy chunks (`lazyScreen`); UI strings in `copy.ts`,
defaults in `constants.ts`, the locale type in `types.ts`; in-app dialogs replace browser pop-ups (`AcademyDialogs.tsx`);
time zones go through `time.ts`. Source-text checks ignore whitespace (`scripts/lib/loose-source.mjs`). **Open:** the
two giant components (`Academy.tsx`, `AcademyPortal.tsx`) are still single files; split them by role when touching them.

## D-02 · 2026-11-25 · Migrations are additive, applied to the Lingo3 project, with an undo file
New SQL goes in `supabase/migrations/<timestamp>_<name>.sql`, an undo in `supabase/down/<same name>.sql`, applied through
the Supabase connection, then advisors are checked. Writes to new tables go through `security definer` functions with
`set search_path=''`. **Consequence:** never edit an applied migration; add a new one.

## D-01 · 2026-11-25 · `main` does not deploy by itself; production is created by hand
`vercel.json` sets `git.deploymentEnabled.main: false`, so a push to `main` only makes a preview (behind Vercel
Authentication). Production is made by creating a production deployment from the `main` commit (Vercel MCP
`create_deployment` with `target: production`, `gitSource` = the commit) and then checking `/version.json` on lingo3.com.
Previews use the **production** database. **Consequence:** record the deployment id and the rollback target in
`CHANGELOG.md` for every release; verify the live version, never assume it.
