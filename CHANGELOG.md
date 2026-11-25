2026-11-25 · v0.7.26 production: built from main 589c5f53 as dpl_9nK4fuiumkbYX36QwxBxJPibJ5of (READY, lingo3.com and www aliases; live /version.json reports 0.7.26). Rollback target: dpl_A9s2q5XbQB8pFHkeY8VY43jcHVDJ (v0.7.25).

## 2026-11-25 — Academy design v2, part 2 (v0.7.26)

Booking is now a three-step sheet (Course → Time → Confirm) that rises from the bottom on phones: course choice as cards with level and price, free times as tappable chips in the viewer's own time zone with a custom-time field, then lesson type, message and a summary before sending. Same insert and rules as before (status `requested`, double-booking guard unchanged). New course card (`AcademyCourseCard`: language and level, title, short description, price, length, formats, "What you learn", View course / Add to my courses) on the home and courses pages. Teacher/course detail header is a flat card with a round avatar; calendar times use a short format. Signed-in screens (Today card, teacher overview, admin overview) pick up the new card skin; their layouts are unchanged. Full `npm test` and build passed; checked with mock-data phone screenshots (course cards, teacher page, booking steps 1–2), no real accounts and no real booking submitted.

2026-11-25 · v0.7.25 production: built from main 473d49e5 as dpl_A9s2q5XbQB8pFHkeY8VY43jcHVDJ (READY, lingo3.com and www aliases; live /version.json reports 0.7.25). Rollback target: dpl_6UvxJQ1yA9JgANFDiAPoRtXy257N (v0.7.24).

## 2026-11-25 — Academy design v2, part 1 (v0.7.25)

Calm, light, card-based skin driven by the `--ac-*` tokens: solid primary buttons instead of gradients, one card style, opaque header and bottom bar. New teacher card (`AcademyTeacherCard`: avatar or photo, name, courses and lowest price, language and level chips, Request trial / View profile) used on the teachers page and the home preview; language filter chips on the teachers page and under the home hero (tapping one opens the filtered list); skeleton cards while lists load; hero primary button is now "Find a teacher". Course cards, teacher profile page, booking dialog and the signed-in screens still use the older look and are next. Full `npm test` and build passed; checked with a mock-data phone and desktop screenshot, no real accounts.

2026-11-25 · v0.7.24 production: built from main f41eb8e8 and deployed as dpl_6UvxJQ1yA9JgANFDiAPoRtXy257N (READY, lingo3.com and www aliases, no alias error). Previous production for rollback: dpl_EWc8J2MAS4swJW2D9zeAZn5dFTRe (v0.7.19). Pushes to main do not deploy by themselves; this release used a manual production build.

## 2026-11-25 — Refresh shows a loading indicator (v0.7.24)

On refresh the server put the plain crawlable text inside the app container, so phones showed an unstyled page until the bundle loaded (it looked frozen). That text is now hidden from sighted users and replaced by a loading indicator until the app mounts; search engines and visitors without JavaScript still get the text (`api/academy-page.ts`). Handler and SEO checks pass.

## 2026-11-25 — Phone menu and refresh fixes (v0.7.23)

Phone menu: the open menu sheet was drawn above the top of the screen because the sticky header's `backdrop-filter` made it the containing block of the `position: fixed` sheet; the header is now opaque on phones, so the three-level menu (menu → group → items) shows above the bottom bar. Refresh: `/academy` and its sub-pages now fall back to the plain app shell (HTTP 200, no-store) when the database or the shell lookup fails, instead of the plain "temporarily unavailable" error (previously only `/` did); database lookups time out after 4 s instead of 6 s. The gold highlight on "My Academy" is shown only to signed-in users. New regression checks for both. Full `npm test` and build passed. Note: pushes to `main` do not deploy by themselves (`git.deploymentEnabled.main` is false); production stays on the last deployment until one is promoted.

## 2026-11-25 — Easier to find, enrol and manage (Phase 2, v0.7.22)

Public home: duplicate Courses/Teachers row replaced by one slim strip (Lingo3 App + language); hero placeholder replaced by the four real steps (course → teacher → trial lesson → lesson words in the App); empty teacher list no longer shows admin wording to visitors (admins still see the hint); the "payments not available yet" line removed. Guests get a phone bottom bar of Home · Courses · Teachers · Log in. Admin Studio opens on an Overview of live counts (trial requests waiting, teachers awaiting approval, active teachers, published courses, active enrollments, lessons in the next 7 days), each opening its tool. Student Today card shows the status of the next class. Teacher overview (requests, awaiting review, next lesson) already existed and is unchanged. Not done: guided single-flow enrolment (the existing course → teacher → booking dialog is kept), per-role menu rewrite for signed-in users, teacher Today list of every lesson. Full `npm test` and build passed; real-device acceptance pending.

## 2026-11-25 — Class → word bank (Phase 1, v0.7.21)

Teacher after-class form (`AcademyLessonForm`) in the classroom's summary tool: what was covered, weak point, homework and up to 40 words; the student sees nothing until the teacher publishes. New table `academy_lesson_words` and function `academy_publish_lesson` (migration `20261125120000`, applied to the Lingo3 database; undo in `supabase/down/`). The App pulls published words after sign-in and when the tab becomes visible and writes them into a "From my lessons" list (`src/seed/lessonWords.ts`), with duplicate protection and removed words never returning. Student home gets a "Today" card (next class, last lesson, homework, new words, Practise button). In-app notification is created on publish; email through Resend is built (`api/academy-notify.ts`) but stays off until `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel. Not done yet: shared-vocabulary autocomplete in the form, AI draft, 24-hour reminder email. New check `scripts/check-lesson-words.ts`; full `npm test` and build passed. Real teacher→student acceptance pending.

## 2026-11-25 — Academy foundation (Phase 0, v0.7.20)

No visible change. Academy code reformatted onto normal lines (it was ~12,000-character lines); translation tables and form defaults moved to `src/academy/copy.ts` and `constants.ts`; one language type in `types.ts`; Portal, admin users, lifecycle, SEO manager and article studio load only when opened (Academy chunk 266 KB → 119 KB for visitors). Added in-app confirm/prompt dialogs (`AcademyDialogs.tsx`) replacing 5 browser pop-ups, design tokens (`--ac-*`) and Vazirmatn for Persian in `academy.css`, and a time-zone helper (`time.ts`). Source-text checks now ignore whitespace (`scripts/lib/loose-source.mjs`). Older changelog/handoff entries moved to `docs/archive/`. Full `npm test` and build passed; real signed-in role acceptance still pending.

## 2026-11-25 — Academy review and phased plan (documentation revision; app v0.7.19)

Added `docs/ACADEMY_IMPROVEMENT_PLAN.md`: summary of a code/UX review of App and Academy, evaluation of the owner's PDF plan, and a phased improvement list (Phase 0 foundation → Phase 5 later) with acceptance checks per phase. No runtime change; no deployment.

## 2026-11-22 — Academy session closeout (documentation revision; app v0.7.19)

Record production v0.7.19 deployment and HTTP checks for PR #72, released v0.7.17–0.7.19 changes, and outstanding real-device/role acceptance and functionality gaps. No runtime change; no new deployment claimed. See `docs/DEVELOPMENT_HANDOFF.md` for evidence and next steps.

## 2026-11-22 — Legacy Academy redirect (v0.7.19, unreleased)

Redirect /academy.html to /academy at the server instead of depending on HTML meta refresh; retain the old page as a fallback. User screenshot matches the legacy page, but exact URL and device behavior remain unconfirmed. Full npm test and build passed; preview and live redirect checks pending.

## 2026-11-22 — Boot diagnostics (v0.7.19, unreleased)

Detect missing React mount even when server-rendered HTML exists, so the existing error and recovery panel can appear. This is diagnostic hardening; the reported blank-page root cause has not been confirmed. Focused fallback test, docs check and build passed. Browser verification and release pending.

## 2026-11-21 — Student home and navigation (v0.7.18, pending release)

Added signed-in student home overview for enrollments, upcoming individual bookings, assigned homework and teacher-recorded progress; My Courses list and catalogue entry; profile summary and settings shortcuts on the mobile navigation. Existing student, teacher and admin tools remain available. Group sessions continue to be available in Schedule, not this home summary. Profile shows existing account information and does not edit it. Full npm test, focused role/navigation and summary checks, docs checks and production build passed; tests use mocked transport. Real signed-in and mobile browser acceptance pending.

## 2026-11-21 — Academy home shortcuts (v0.7.17, unreleased)

Added home shortcuts to Lingo3 App, course and teacher catalogues, language selection and an admin-only settings shortcut. Full npm test and production build passed; new admin shortcut and mobile UI have not been verified in browser. Full student home and navigation redesign remain incomplete; no production release.

## 2026-11-21 — Academy discovery and accessibility (v0.7.17, unreleased)

Added real published course and teacher previews to the Academy homepage, direct catalogue and teacher links, a skip-to-content link, visible focus indicators, and responsive styling for discovery and workspace navigation. Existing functions and role permissions are retained. Full npm test and TypeScript/Vite build passed; browser acceptance pending. No production deployment claimed.

## 2026-11-21 — Academy mobile navigation (v0.7.17, unreleased)

Added a mobile bottom bar for Home, Courses, My Academy and the full menu, preserving existing routes and role checks. Includes light/dark styling and safe-area spacing. Full npm test, production build and updated 230-assertion mocked navigation check passed. Browser acceptance remains pending; no production deployment claimed.

2026-11-22 · v0.7.16 production verified: PR #69 merged 05676afc05d394593efb4d8510d5c8c8a9df713a, Vercel dpl_4u9gSmHfQ9aCcqRvGKBkiWnKXjN7 READY with lingo3.com aliases. CI #353 passed strict TypeScript, full regressions and production build. HTTP verified admin noindex, public teachers and sitemap. Archived teacher linked to one booking remains retained; no records deleted. Correct error messaging shipped; live signed-in end-to-end unverified.

Older entries (v0.7.16 and earlier): `docs/archive/CHANGELOG_to_v0.7.16.md`.
