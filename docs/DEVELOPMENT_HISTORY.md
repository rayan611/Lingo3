## 2026-11-21 — Academy mobile navigation (v0.7.17, unreleased)

Introduced a mobile bottom shortcut bar and retained the complete existing Academy menu and role boundaries. Existing routes and data contracts are unchanged. Full reference comparison and signed-in responsive acceptance remain open; see handoff.

2026-11-21 v0.7.16: Teacher permanent deletion UI now checks booking references and reports structured FK/permissions errors rather than [object Object]. Existing archived teacher has one historic booking and remains retained; no data changes. See handoff for CI/deploy evidence.

2026-11-21 · v0.7.15 production verification: PR #68 merged 466896c0, Vercel READY dpl_GFvjj4kEvB8Lp1VTU6JEtHXM2BVL, CI #344 success and published SSR/canonical/noindex/sitemap HTTP smoke passed. SEO public audit and guarded archived teacher deletion with audit released. Real historic teacher booking preserved. See handoff.

2026-11-21 · v0.7.15: Academy SEO hardening: authored-locale-only sitemap/hreflang, noindex untranslated detail variants, public SEO audit under admin, server/UI regression tests. Archived-only permanent teacher deletion guarded by existing historical FKs and new admin-only audit log; no live teacher records removed. See handoff for test/release evidence.

## 2026-11-20 — Academy group session count (app 0.7.12)

Teacher and administrator student planning counts completed group sessions during the student's current active membership, explicitly stating this is not an attendance record. Pagination covers history under existing row-level permissions. No schema or permission changes. Admin enrollment creation, suggested schedules, full role views, public Instagram/articles and audited permanent teacher deletion remain outstanding. Real signed-in role and mobile acceptance remain unverified. Route maps reviewed; URLs unchanged. Deployment pending.

## 2026-11-20 — Academy selected-student sessions (app 0.7.11)

Fixed the administrator classroom selector using the existing admin-authorized learning-space query instead of passing null to the teacher roster. Teacher/admin student planning shows the completed-private-lesson count and up to 200 recent private bookings for the selected student, course and teacher, and allows confirmed lessons to be marked completed. Fixed the removed-enrollment status filter. Existing RLS and schema unchanged. Group lessons and suggested session counts are not included. Administrator enrollment creation, full role views, public teacher Instagram/articles and permanent teacher deletion remain outstanding. Mocked React tests cover admin selection and session completion; signed-in live and full mobile acceptance remain unverified. Route map reviewed; URLs unchanged. Deployment pending.

## 2026-11-20 — Academy teacher editor (app 0.7.10)

Teacher selection, search and creation precede the editor; sectioned name, introduction, languages/courses, contact and account panels retain form state. Red confirmation deactivates without deleting teacher records. Enrollment status filtering, compact admin spacing and highlighted My Academy menu added. Existing schema and access controls unchanged. Administrator enrollment creation, suggested session tracking, comprehensive student/teacher impersonation and permanent teacher deletion remain unimplemented. Live signed-in role and complete mobile browser checks remain outstanding. Route URLs unchanged. Production verification pending.

## 2026-11-20 — Academy usability refinements (app 0.7.9)

Focused panels identify the selected course and display the next confirmed private lesson link; panel guidance is localized. Reduced routine help icons, added hover/focus and outlined green styling, moved learning articles under Learn, compacted enrollment rows, refreshed teacher profiles and added contact links. Common success feedback appears near the triggering action and clears after 1.3 seconds. A teacher can be deactivated through the existing editor; permanent deletion is not implemented. Public teacher article attribution and a dedicated Instagram field require a privacy-reviewed data contract. No database migration. Real-role and full mobile browser acceptance remain unverified. Group class sharing and session links use existing functionality. Sitemap and route index reviewed; URLs unchanged. Production verification pending.

2026-11-18 release verification: production source f9c8408bb3fa3032f6d4e77413b56df430d2fffb, deployment dpl_B6U7WtmEWWveDn1ugR2yUkQfa3zf. Vercel build completed in 41s; live lingo3.com serves index-CIUEiV-3.js / Academy-67xfYk_A.js containing new admin roster, group scheduling and calendar RPCs. Admin/my/teachers routes returned HTTP 200. PR #56 is draft; source not merged to main. New signed-in/viewport browser E2E remains unverified: local Chromium failed with socket Operation not permitted. SQL fixture cleanup verified zero test users. This delivers roster/scheduling foundation, not all remaining Academy scope.

2026-11-18 · v0.7.5 · branch feat/academy-class-management-20261118, source base 6b00c4 + current patch. This entry supersedes older release-status entries below. Seven new migrations (20261118172726–20261118220631) applied successfully. Frontend source f9c8408 deployed; see release verification above.

Latest delivery details and remaining approved scope: [ACADEMY_MANAGEMENT_DELIVERY.md](ACADEMY_MANAGEMENT_DELIVERY.md). Admin roster, reversible enrollments and group scheduling implemented; complete Academy program still in progress.

2026-11-18 · v0.7.5 · based on 41e49ac. Training Center now links to /academy alongside its activities. Online navigation requests fresh HTML; offline navigation can use the precached app shell. No route removed.

2026-11-18 · v0.7.5 · Teams/Zoom manual meeting links, based on 5b4d1fc. /academy/my Teacher Space has private reusable links and per-booking primary/backup selection; Student Space displays participant links for confirmed/in-progress bookings. Paths and Back behavior unchanged. Apply 20261118050000 then 20261118131500 before production deployment. Supabase rehearsal confirmation expired. Automatic provider creation and embedded video remain pending.

2026-11-18 navigation/UI acceptance review · branch fix/academy-complete-workflows-20261118; reviewed cd4d705 plus this patch. Added 201 real-React navigation assertions across guest/student/teacher/admin, all Academy routes and direct entries, Back/Forward, login modes/OAuth error, guest/valid booking, settings and signout. External href syntax checked; third-party delivery is not verified. Fixed leaking Academy CSS selectors; login/booking overlays now close with Back/Escape and product changes discard overlay state. Standardized bounded typography and 42px desktop/44px mobile touch controls, 16px form text. Unified seven post-write classroom refresh paths so history always returns to the latest paginated results. Message-from-older-page regression passes. Full test/build results are recorded in release report. Browser checked Persian 390px menu/settings and actual form sizes; old live schema still blocks real-role acceptance. Permanent migration, signed-in live E2E and production deployment remain pending.

2026-11-18 follow-up integration review · branch fix/academy-complete-workflows-20261118; reviewed source 5fcd5da plus this patch. Shared auth/product routing, query context, role/RPC payloads, migration ownership guards and App sharing rechecked. Fixed mounted-account preference isolation, sequential rapid preference writes, blocked-browser-storage fallback, and stale sharing previews during language reload. Added real React transport tests for these cases. Full npm test, TypeScript and production/PWA build pass. No new database change or deployment; permanent migration and signed-in browser acceptance remain release gates. No route/page/Back change; SITEMAP and ROUTE_INDEX reviewed. PR #55 remains draft.

# Lingo3 Development History

Purpose: durable high-level chronology for future developers/AI agents.

This is not the live handoff and not the backlog.
- Current state: `docs/AI_CONTEXT.md`
- Latest session detail: `docs/DEVELOPMENT_HANDOFF.md`
- Remaining work: `docs/ACADEMY_ROADMAP.md`

Only append meaningful completed milestones. Do not copy every small commit. Review this file before every development session so new work respects earlier decisions.

## 2026-11-17 — Role-Aware Academy Dashboards (development branch)

Built compact Student and Teacher dashboard flows on top of the existing Academy tables instead of creating a parallel system. Student view is language/course-first with progress, sessions, teacher summary, homework, notes and App vocabulary/grammar shortcuts. Linked teachers get a teacher-only operational view with weekly availability/occupancy, students, learning plans and teaching resources. Admin teacher assignment now uses a secure lookup design rather than raw UUID entry. Prepared, but did not apply, the database migration for test-result history and Control Center Academy operations. App Home Academy access moved into the primary mosaic navigation. Production remained unchanged during this implementation.

## 2026-11-17 — Academy Role Dashboards Prepared

Prepared the next Academy operating model on a feature branch: students get a language/course dashboard with progress, sessions, teacher summaries, homework, notes, tests and App shortcuts; linked teachers get a teacher-only workspace with courses, students, weekly availability and instructional inputs; admins retain both management surfaces. Teacher role remains an admin-controlled link through `academy_teachers.user_id`, not user-editable metadata. A migration for structured summaries/tests, managed languages and Control Center RPCs is prepared but intentionally not applied to production yet.

## 2026-11-17 — Academy Routed Pages and Theme System

Refactored Academy from a single long anchor-based page into route-backed SPA pages while preserving the one shared Supabase session and App/Academy boundary. Added dedicated routes for learning path, courses, teachers, levels, My Academy, Admin, About, Pricing, Resources and Contact. Added a persisted Academy Light/Dark theme with Light as the default. Updated route/sitemap checks and development-history operating rules.

## 2026-11-17 — Shared App/Academy Auth Lifecycle Hardening

Investigated repeated hangs around Academy login and App↔Academy re-entry. Supabase production logs showed a real stale refresh-token failure, while OAuth itself succeeded. Refactored the SPA so root App owns one shared Supabase session lifecycle for both product surfaces; removed parallel getSession initialization; converted internal product switches to same-document history navigation; added App Home → Academy and retained Academy → App; embedded showcase switches now bridge to the parent SPA; added auth-navigation regression checks. No user/database schema change.


## 2026-11-17 — Academy Real Teacher/Student MVP

Released via PR #47. Runtime production commit:
`79b8cff3df3b2b0718cc85674af1459048e25b98`

Production deployment:
`dpl_6QfHz8xcgNniSxqTNBcZzwgfMZV5` — READY at verification.

Delivered:
- secure public Academy catalogue
- Teacher Directory foundation without fake teachers
- real trial request flow with course/time/message
- teacher internal availability/calendar
- booking confirmation/cancellation/completion/no-show
- slot release on cancellation
- overlap/double-book protection
- Student personal Academy area
- Teacher operational workspace
- Learning Space goals/progress/next-session plan/notes
- materials/homework with student response and teacher feedback
- private Student ↔ Teacher messaging
- atomic enrollment activation
- stricter Student/Teacher/Admin update guards
- note identity protection
- public internal-ID/privacy hardening
- Academy code split into dedicated components
- legacy `api/grammar-examples.ts` TypeScript union-narrowing diagnostics fixed

Verification:
- GitHub CI run `44099114169` passed typecheck, regression suite and production build
- Supabase migrations applied after rollback rehearsal
- transactional role/RLS/workflow fixtures rolled back cleanly
- production routes and served Academy asset verified
- production data left clean: 6 starter courses, no fake/test Academy users/data

Known boundary after release:
- automatic Teams creation, external calendar sync, payments, hosted video, binary file upload, placement/tests and realtime collaborative notebook remain unimplemented.

## 2026-11-17 — Academy Stability and Routing Hardening

Released via PR #46.

Delivered:
- Academy routed before Lingo App mount
- prevented App Dexie lifecycle from running on `/academy`
- removed Welcome iframe resize feedback loop
- cleaned dead legacy Welcome implementation
- grouped Academy menus auto-close correctly
- normalized Academy typography
- scoped personal Learning Spaces correctly
- limited admin interested-enrollment queue
- added Academy developer guide and regression coverage

## 2026-11-17 — Academy Database-Backed Foundation

Released via PR #45.

Delivered:
- interactive React Academy at `/academy`
- shared Lingo3 authentication
- DB-backed multilingual courses
- Teacher Directory data model
- Student interest/enrollment model
- Learning Space foundation
- notes
- bookings foundation
- Admin Studio
- teacher/course assignment
- initial RLS and indexes
- six starter courses
- no fake teacher profiles

## 2026-11-17 — Shared Welcome / Academy Routing

Earlier Academy work established:
- shared Welcome gateway
- direct App and Academy entries
- `/academy.html` compatibility redirect
- PWA/Vercel routing isolation
- showcase Academy link

## 2026-11-08 to 2026-11-09 — Vocabulary and Training Improvements

Major milestones:
- Training Center grouping
- Word Practice vs Recall clarification
- word-card detail/remove/restore flows
- stored-form shared-bank lookup optimization
- 200 common verbs across supported languages
- adjective/opposite and time/place vocabulary batches
- dictionary-first lookup improvements
- routing/sitemap documentation introduced

See older entries in `docs/DEVELOPMENT_HANDOFF.md` for detailed historical evidence.

## 2026-11-17 — Academy release QA

Corrected two TypeScript build errors and one broken regression assertion in the pending dashboard release. Fixed desktop header language-selector sizing, Light-theme hero contrast and checkbox sizing; completed Grammar/Settings form guidance. Reviewed current route map and live RLS-backed dashboard schema. Release status and verification limits are in DEVELOPMENT_HANDOFF.

## 2026-11-18 — Academy workflow integrity and compact shared homepage (feature source)

Completed the role-workflow source batch and added real SQL/React behavioral verification alongside existing source checks. Added account-scoped UI preferences, compact homepage/header, explicit classroom sharing and grammar resource copying. Source is release-gated on the unapplied permanent database migration and browser acceptance; see ACADEMY_RELEASE_2026-11-18.md.

## 2026-11-19 — Academy workspaces, multilingual publishing and SEO

2026-11-19 · v0.7.5 · branch feat/academy-student-workspaces-20261119 · based on bc38fb9 + this release patch.

Academy release: named teacher roster, private teaching desk, isolated demo student view, shared class feed with per-student homework, makeup votes/time-off, course/teacher detail URLs and device-aware sharing. Added multilingual educational posts (grammar/vocabulary/conversation/exam), per-language drafts/publication, YouTube/Instagram URL validation, teacher/admin editor and explicit snapshot sharing into assigned student workspaces. Public article listing strictly matches the selected locale; translations are manually authored, never invented.

SEO: server-readable Academy public pages, per-page title/description/Open Graph, canonical and published-translation hreflang, Article JSON-LD, dynamic /sitemap.xml and robots.txt. Private Academy routes are noindex. No ranking or Google indexing guarantee. API uses anonymous database permissions only. Sitemap updates within 60 seconds of publication. Archived/draft translations are excluded.

Security/lifecycle: demo class membership and real slots are isolated; demo booking conflicts excluded from real availability. Admin course closure and teacher transfer require an impact preview checked again at execution. Transfer cancels upcoming private bookings, ends old group membership and retains the same classroom, resources and original authorship; new schedule is arranged explicitly. Course closure cancels future sessions, keeps history and closes groups. Reviews remain disabled; moderation audit prepared.

Verification: full existing npm test passed; article UI transport test and SEO HTML escaping tests passed; PostgreSQL transaction tests passed for article roles/locale/drafts/unsafe URLs, private student boundaries, makeup/time-off and transfer/history/course closure. Zero QA fixture accounts remain. Production build passed before final translation/editor changes; final build and deployment verification recorded separately below. Signed-in browser E2E not yet verified.

Remaining: domain email/reminders/retry provider not configured (no sending API key in Vercel); no delivery claim. Automatic video/calendar/payment integrations remain outside this release. Historic teacher-authored assessment records retain their authorship; new teacher can read shared classroom history and write new assessments. No production data deleted. Source release and deployment pending until recorded below.

SITEMAP/ROUTE_INDEX reviewed and updated with actual active/planned and role boundaries. Central governance URL was unavailable; owner-provided Lean v3 protocol used.
