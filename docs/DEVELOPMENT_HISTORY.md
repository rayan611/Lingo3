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
