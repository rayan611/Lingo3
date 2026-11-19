2026-11-19 · 0.7.7 production verification: PR #57 and #58 merged; runtime source e0a646654c5c214ba1fcd3da8970be1fda9c86ad, deployment dpl_74ibKKE4JTxaiAanKAiRstiodHNC READY with lingo3.com aliases and no alias error. Live /version.json reports 0.7.7 / 0.7.7-mwnr9x6e. Full npm test passed after the navigation correction; TypeScript/Vite/PWA build passed. Browser guest QA passed: Persian articles, teacher directory/detail, locale retained across SPA navigation and Back, correct lang in share links, copy success, corrected light label contrast. HTTP QA passed for public metadata/canonical/hreflang, server-readable teacher content, 73-URL XML sitemap with zero private routes, private noindex and old levels redirect. Database role/privacy/lifecycle tests were transactional and rolled back; no public QA articles created. Signed-in real teacher/student browser E2E and full mobile/tablet acceptance remain unverified; email sender/provider is unconfigured. No email delivery claim. Final report: docs/ACADEMY_RELEASE_2026-11-19.md. Documentation-only evidence revision; runtime unchanged.

2026-11-19 · v0.7.5 · branch feat/academy-student-workspaces-20261119 · based on bc38fb9 + this release patch.

Academy release: named teacher roster, private teaching desk, isolated demo student view, shared class feed with per-student homework, makeup votes/time-off, course/teacher detail URLs and device-aware sharing. Added multilingual educational posts (grammar/vocabulary/conversation/exam), per-language drafts/publication, YouTube/Instagram URL validation, teacher/admin editor and explicit snapshot sharing into assigned student workspaces. Public article listing strictly matches the selected locale; translations are manually authored, never invented.

SEO: server-readable Academy public pages, per-page title/description/Open Graph, canonical and published-translation hreflang, Article JSON-LD, dynamic /sitemap.xml and robots.txt. Private Academy routes are noindex. No ranking or Google indexing guarantee. API uses anonymous database permissions only. Sitemap updates within 60 seconds of publication. Archived/draft translations are excluded.

Security/lifecycle: demo class membership and real slots are isolated; demo booking conflicts excluded from real availability. Admin course closure and teacher transfer require an impact preview checked again at execution. Transfer cancels upcoming private bookings, ends old group membership and retains the same classroom, resources and original authorship; new schedule is arranged explicitly. Course closure cancels future sessions, keeps history and closes groups. Reviews remain disabled; moderation audit prepared.

Verification: full existing npm test passed; article UI transport test and SEO HTML escaping tests passed; PostgreSQL transaction tests passed for article roles/locale/drafts/unsafe URLs, private student boundaries, makeup/time-off and transfer/history/course closure. Zero QA fixture accounts remain. Production build passed before final translation/editor changes; final build and deployment verification recorded separately below. Signed-in browser E2E not yet verified.

Remaining: domain email/reminders/retry provider not configured (no sending API key in Vercel); no delivery claim. Automatic video/calendar/payment integrations remain outside this release. Historic teacher-authored assessment records retain their authorship; new teacher can read shared classroom history and write new assessments. No production data deleted. Source release and deployment pending until recorded below.

SITEMAP/ROUTE_INDEX reviewed and updated with actual active/planned and role boundaries. Central governance URL was unavailable; owner-provided Lean v3 protocol used.

2026-11-18 release verification: production source f9c8408bb3fa3032f6d4e77413b56df430d2fffb, deployment dpl_B6U7WtmEWWveDn1ugR2yUkQfa3zf. Vercel build completed in 41s; live lingo3.com serves index-CIUEiV-3.js / Academy-67xfYk_A.js containing new admin roster, group scheduling and calendar RPCs. Admin/my/teachers routes returned HTTP 200. PR #56 is draft; source not merged to main. New signed-in/viewport browser E2E remains unverified: local Chromium failed with socket Operation not permitted. SQL fixture cleanup verified zero test users. This delivers roster/scheduling foundation, not all remaining Academy scope.

2026-11-18 · v0.7.5 · branch feat/academy-class-management-20261118, source base 6b00c4 + current patch. This entry supersedes older release-status entries below. Seven new migrations (20261118172726–20261118220631) applied successfully. Frontend source f9c8408 deployed; see release verification above.

Latest delivery details and remaining approved scope: [ACADEMY_MANAGEMENT_DELIVERY.md](ACADEMY_MANAGEMENT_DELIVERY.md). Admin roster, reversible enrollments and group scheduling implemented; complete Academy program still in progress.

2026-11-18 pending release: feature branch fix/academy-complete-workflows-20261118 contains the workflow integrity migration and completed source batch. SQL role tests pass in BEGIN/ROLLBACK; permanent migration confirmation expired and schema remains old. Do not deploy feature source until the migration succeeds. Settings/preferences use academy_preferences, independent of App native/learning language settings. See ACADEMY_RELEASE_2026-11-18.md and latest handoff for test limits.

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
