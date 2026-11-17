# Lingo3 Development History

Purpose: durable high-level chronology for future developers/AI agents.

This is not the live handoff and not the backlog.
- Current state: `docs/AI_CONTEXT.md`
- Latest session detail: `docs/DEVELOPMENT_HANDOFF.md`
- Remaining work: `docs/ACADEMY_ROADMAP.md`

Only append meaningful completed milestones. Do not copy every small commit.

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
