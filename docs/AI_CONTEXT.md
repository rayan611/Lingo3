2026-11-17 latest release status: PR #53 dashboards merged as ed7e95e; PR #54 supplemental presentation/form QA merged as a5a2c9c8338dcb9f2ea1ab90f9e110a49f338d32. Local regression/typecheck/build pass. Dashboard DB schema already applied and RLS confirmed. New UI is NOT production-live: Vercel rejects deployment with 402 api-deployments-free-per-day (retryAfter 86400). Last verified production runtime remains a4381c9 / dpl_BTCtnsEB8vrDTxhw8ZvSSdYREJP6. Full viewport and signed-in role E2E pending; do not describe source/CSS checks as physical-device testing.

# Lingo3 AI Development Context

2026-11-17 auth/navigation invariant: Lingo3 App and Academy share exactly one browser Supabase SessionState owned by root App(). Do not mount separate useSession() hooks per product. Product switching inside lingo3.com must use src/lib/productNavigation.ts (same-document history navigation) rather than full-page href/location reload; OAuth itself remains an external redirect. The same Supabase auth user/account backs both products, while App Dexie remains App-only.


Reviewed: 2026-11-17  
Repository: `rayan611/Lingo3`  
Production: `https://lingo3.com`

This file is the fast-start memory for future AI development sessions.

## Read order at the start of every development session

1. `AGENTS.md`
2. `docs/AI_CONTEXT.md` (this file)
3. `docs/ACADEMY_ROADMAP.md` when the task touches Academy
4. `docs/DEVELOPMENT_HANDOFF.md` for the latest verified work
5. `docs/DEVELOPMENT_HISTORY.md` before editing code, to avoid repeating or reversing prior decisions
6. `docs/SITEMAP.md` and `docs/ROUTE_INDEX.md` when routes/UI structure may change
7. Relevant code, migrations, open PRs and deployment state

Do not reconstruct project history from memory when these files are available.

## Current production baseline\nLatest Academy routed pages/theme release:\n- PR #52\n- Runtime/main commit deployed: `a4381c9841d13f71f1cf2af5b677874c94780d78`\n- Vercel production deployment: `dpl_BTCtnsEB8vrDTxhw8ZvSSdYREJP6` — READY\n- Academy routes: `/academy`, `/academy/path`, `/academy/courses`, `/academy/teachers`, `/academy/levels`, `/academy/my`, `/academy/admin`, `/academy/about`, `/academy/pricing`, `/academy/resources`, `/academy/contact`\n- Academy theme: Light default with persisted Light/Dark toggle\n

Production code release:
- Auth/session navigation fix: PR #49
- Runtime/main commit deployed: `28d702e1097bad03e1c5c9f12b32f5a5701403d0` (contains PR #49 code commit `6f55443bc7da5a62957175d1b1e27ebaf6fbdc50` plus verification docs)
- Vercel production deployment: `dpl_5qws2Cf66E8nLFPxbF3RFHHrRWLM`
- Status at verification: READY
- Primary domains: `lingo3.com`, `www.lingo3.com`

Latest documentation-only main commit after production verification:
- `e31a8cc2fb1b64503b7d9c3bd98654f906008645`

## Pending role-dashboard branch (not production)

Branch: `feat/academy-role-dashboards-20261117`. It introduces role-aware Student/Teacher dashboards, App↔Academy primary navigation, session summaries, test history, managed Academy languages and Control Center connector RPCs. The associated migration `20261117211500_academy_role_dashboards.sql` is repository-only and has NOT been applied. Do not claim these features live or merge/deploy the branch before an explicit database release decision.

## Product boundary

### Lingo3 App
Self-study product: vocabulary, grammar, review, reading, translation, settings and sync.

The App owns Dexie/local data. Academy must not mount the App/Dexie lifecycle.

### Lingo3 Academy
Human-led learning product using the same Supabase Auth identity.

Primary code:
- `src/academy/Academy.tsx`
- `src/academy/AcademyBookingDialog.tsx`
- `src/academy/AcademyPortal.tsx`
- `src/academy/academy.css`
- `supabase/migrations/*academy*`

Primary route:
- `/academy`

Compatibility:
- `/academy.html` redirects to `/academy`

## Academy capabilities active now

Public:
- Learning Path
- course catalogue
- course topics/formats
- verified Teacher Directory
- EN/SV/FA UI with Persian RTL
- teacher contact links/fields
- trial request entry

Authenticated Student:
- course interest/enrollment view
- trial/session booking request
- choose published teacher slot or suggest another time
- student message
- booking/session status
- manual meeting URL when provided
- Learning Space
- learning goal
- progress display
- notes
- materials/homework
- homework text response/status
- teacher feedback
- private Student ↔ Teacher messaging

Authenticated linked Teacher:
- internal availability/calendar slots
- online/offline slot type
- booking request review
- confirm/cancel/complete/no-show
- confirmed time/duration
- manual meeting URL
- student list
- progress and next-session plan
- goals
- materials/homework authoring
- homework feedback/completion
- private Student ↔ Teacher messaging

Admin:
- multilingual course CRUD
- teacher CRUD
- teacher/course assignment
- teacher account link
- activate/publish teacher
- interested enrollment queue
- atomic enrollment activation + Learning Space creation

## Academy security/integrity invariants

Do not weaken these without explicit review:
- public catalogue does not expose internal `created_by` or teacher `user_id`
- teacher cannot self-publish
- student cannot change teacher/course/progress fields
- teacher cannot reassign student/course
- enrollment activation uses `academy_activate_enrollment(...)`
- overlapping teacher availability is rejected
- overlapping confirmed teacher sessions are rejected
- student cancellation releases the booked slot
- private messages are visible only to participants/admin
- notes cannot be moved to another author/Learning Space
- RLS remains enabled on private Academy tables

## Current Academy production data

At last verified production check:
- 6 starter courses
- 0 teachers
- 0 teacher-course links
- 0 enrollments
- 0 bookings
- 0 Learning Spaces
- 0 notes
- 0 availability slots
- 0 resources/homework
- 0 messages

No fake teachers or test rows were left behind.

## External/incomplete capabilities

See `docs/ACADEMY_ROADMAP.md` for the canonical backlog.

Important: do not claim these are active until implemented and verified:
- automatic Teams meeting creation
- Google/Microsoft calendar synchronization
- payment processing
- embedded/hosted video classroom
- binary file upload/storage
- placement/test engine
- realtime collaborative notebook
- production Teacher/Student E2E with real accounts

## Required checks for Academy work

Run:
- `npm run check:academy`
- `npm run check:docs`
- `npm run typecheck`
- `npm test`
- `npm run build`

For RLS/schema changes:
- rehearse migrations transactionally when possible
- test Student/Teacher/Admin separately
- verify cross-user isolation
- inspect Supabase security/performance/health advisors

For route/UI changes:
- update `docs/SITEMAP.md`
- update `docs/ROUTE_INDEX.md`
- record result in `docs/DEVELOPMENT_HANDOFF.md`

## Session close rule

Before ending a development session:
1. update `docs/DEVELOPMENT_HANDOFF.md`
2. update `docs/ACADEMY_ROADMAP.md` if Academy status changed
3. append a concise durable milestone to `docs/DEVELOPMENT_HISTORY.md` for meaningful user-visible, architectural, auth, database or navigation work
4. update sitemap/route index when navigation changed
5. run `npm run check:docs`
6. commit documentation with the code change whenever possible

The handoff is current-state detail. The history is durable chronology. The roadmap is remaining work. Do not merge all three responsibilities into one file.
