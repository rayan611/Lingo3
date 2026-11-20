## 2026-11-20 — Academy management completion (app 0.7.13)

Added administrator-created enrollment with eligible teacher/course selection and audit, suggested lesson count/start/schedule, teacher public Instagram and published articles, audited administrator student overview, private-note and teacher-desk access, and confirmed permanent deletion guarded against all linked records. The additive migration uses RLS and checked non-exposed privileged functions; isolated PostgreSQL and mocked UI tests cover key roles and workflows. Existing classroom administration remains available; exact account impersonation is not implemented. Real signed-in and mobile browser acceptance remain unverified. Sitemap and route index reviewed: URLs unchanged. Deployment pending.

## 2026-11-20 — Academy group session count (app 0.7.12)

Teacher and administrator student planning counts completed group sessions during the student's current active membership, explicitly stating this is not an attendance record. Pagination covers history under existing row-level permissions. No schema or permission changes. Admin enrollment creation, suggested schedules, full role views, public Instagram/articles and audited permanent teacher deletion remain outstanding. Real signed-in role and mobile acceptance remain unverified. Route maps reviewed; URLs unchanged. Deployment pending.

## 2026-11-20 — Academy selected-student sessions (app 0.7.11)

Fixed the administrator classroom selector using the existing admin-authorized learning-space query instead of passing null to the teacher roster. Teacher/admin student planning shows the completed-private-lesson count and up to 200 recent private bookings for the selected student, course and teacher, and allows confirmed lessons to be marked completed. Fixed the removed-enrollment status filter. Existing RLS and schema unchanged. Group lessons and suggested session counts are not included. Administrator enrollment creation, full role views, public teacher Instagram/articles and permanent teacher deletion remain outstanding. Mocked React tests cover admin selection and session completion; signed-in live and full mobile acceptance remain unverified. Route map reviewed; URLs unchanged. Deployment pending.

## 2026-11-20 — Academy teacher editor (app 0.7.10)

Teacher selection, search and creation precede the editor; sectioned name, introduction, languages/courses, contact and account panels retain form state. Red confirmation deactivates without deleting teacher records. Enrollment status filtering, compact admin spacing and highlighted My Academy menu added. Existing schema and access controls unchanged. Administrator enrollment creation, suggested session tracking, comprehensive student/teacher impersonation and permanent teacher deletion remain unimplemented. Live signed-in role and complete mobile browser checks remain outstanding. Route URLs unchanged. Production verification pending.

## 2026-11-20 — Academy usability refinements (app 0.7.9)

Focused panels identify the selected course and display the next confirmed private lesson link; panel guidance is localized. Reduced routine help icons, added hover/focus and outlined green styling, moved learning articles under Learn, compacted enrollment rows, refreshed teacher profiles and added contact links. Common success feedback appears near the triggering action and clears after 1.3 seconds. A teacher can be deactivated through the existing editor; permanent deletion is not implemented. Public teacher article attribution and a dedicated Instagram field require a privacy-reviewed data contract. No database migration. Real-role and full mobile browser acceptance remain unverified. Group class sharing and session links use existing functionality. Sitemap and route index reviewed; URLs unchanged. Production verification pending.

2026-11-19 · 0.7.7 production verification: PR #57 and #58 merged; runtime source e0a646654c5c214ba1fcd3da8970be1fda9c86ad, deployment dpl_74ibKKE4JTxaiAanKAiRstiodHNC READY with lingo3.com aliases and no alias error. Live /version.json reports 0.7.7 / 0.7.7-mwnr9x6e. Full npm test passed after the navigation correction; TypeScript/Vite/PWA build passed. Browser guest QA passed: Persian articles, teacher directory/detail, locale retained across SPA navigation and Back, correct lang in share links, copy success, corrected light label contrast. HTTP QA passed for public metadata/canonical/hreflang, server-readable teacher content, 73-URL XML sitemap with zero private routes, private noindex and old levels redirect. Database role/privacy/lifecycle tests were transactional and rolled back; no public QA articles created. Signed-in real teacher/student browser E2E and full mobile/tablet acceptance remain unverified; email sender/provider is unconfigured. No email delivery claim. Final report: docs/ACADEMY_RELEASE_2026-11-19.md. Documentation-only evidence revision; runtime unchanged.

2026-11-19 · 0.7.6 released via PR #57 / 46e4ffe, production dpl_HC7sz4x4UDwr2WQmo943tmcre99d READY. Named classrooms, posts/SEO, demo views, shared class content and guarded lifecycle changes below are deployed. Public guest browser and HTTP metadata/sitemap checks passed. 0.7.7 follow-up fixes locale retention, sharing language, article label contrast and demo summary counts. Outstanding acceptance: actual signed-in teacher/student browser workflow and multi-viewport review; email delivery/reminder provider configuration. Historic status tables below describe earlier milestones and are superseded by this dated entry.

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

2026-11-18 source implementation update: workflow integrity, shared teacher/student panels, account UI preferences, compact shared homepage/header, admin enrollment operations and explicit App classroom snapshots/grammar resource copies are implemented on fix/academy-complete-workflows-20261118, not yet released. SQL/React test evidence and remaining migration/browser/deployment gates: docs/ACADEMY_RELEASE_2026-11-18.md. Earlier “completed” labels below refer to previous production baseline, not full acceptance of this batch.

# Lingo3 Academy Roadmap

Reviewed: 2026-11-17  
Canonical status source for remaining Academy work.

Status legend:
- ✅ Active and verified
- 🟡 Foundation exists / partial
- 🔴 Not implemented
- ⏸ Deferred intentionally

## Current implementation pending release

| Capability | Status | Current branch reality |
|---|---|---|
| Role-aware Student / Teacher dashboard | 🟡 prepared | Student language cards, progress, sessions, notes, homework, tests and App shortcuts; Teacher-only workspace for linked teachers; Admin can manage both |
| Structured teacher session summaries | 🟡 schema applied, UI pending release | Covered topics, grammar focus, strengths, improvement and next focus; live schema confirmed during 2026-11-17 QA; UI release pending |
| Test result history | 🟡 schema applied, UI pending release | Student history + teacher entry; live schema confirmed during 2026-11-17 QA; UI release pending |
| Managed language catalogue | 🟡 schema applied, UI pending release | EN/SV/DE/FA seeded, Control Center-ready; live schema confirmed during 2026-11-17 QA; UI release pending |
| Rayan Control Center Academy connector | 🟡 contract prepared | Hub read/manage RPCs prepared; Control Center implementation is separate and production remains unchanged |

## Current completed baseline

| Capability | Status | Current reality |
|---|---|---|
| Public Academy route | ✅ | `/academy` Home + routed Academy sub-pages, shared Lingo3 auth |
| Multilingual Academy UI | ✅ | EN/SV/DE/FA; Persian RTL, others LTR |
| Course catalogue | ✅ | DB-backed, multilingual topics/formats |
| Teacher Directory | ✅ infrastructure | Only real active teachers are shown; currently no real teacher seeded |
| Student course interest | ✅ | Student may register interest |
| Trial request | ✅ MVP | Course + published slot/custom time + message |
| Internal teacher availability | ✅ | Teacher-managed calendar slots |
| Booking/session workflow | ✅ MVP | requested/confirmed/completed/no-show/cancelled |
| Double-book protection | ✅ | DB guards for slots and confirmed sessions |
| Learning Space | ✅ MVP | goal, progress, next-session topics, notes |
| Homework/materials | ✅ MVP | links/text metadata, student response, teacher feedback |
| Internal messaging | ✅ MVP | private Student ↔ Teacher messages |
| Teacher personal area | ✅ MVP | availability, sessions, students, plans, homework/messages |
| Admin Studio | ✅ MVP | courses, teachers, assignments, enrollment activation |
| RLS / role guards | ✅ | Student/Teacher/Admin boundaries tested |
| Atomic enrollment activation | ✅ | RPC creates active enrollment + Learning Space |

## Priority 0 — real-user acceptance before major provider integrations

These should be completed before adding significant external complexity.

### P0.1 Real Teacher onboarding and E2E
Status: 🔴

Use one real Lingo3 user as a teacher and verify:
1. Admin creates/link teacher
2. Teacher publishes availability
3. Student requests trial
4. Teacher confirms
5. Student sees session
6. Admin activates enrollment
7. Learning Space appears
8. Teacher assigns homework
9. Student submits
10. Teacher gives feedback
11. Student/Teacher exchange messages
12. Session completes

Acceptance:
- desktop and mobile
- EN/SV/DE/FA
- Persian RTL
- Student cannot see another student's data
- Teacher only sees assigned students
- no unexpected console/runtime error

### P0.2 Teacher account lookup UX
Status: 🟡 implemented in branch; pending database migration/release

Current limitation:
- Admin links a teacher using raw Lingo3 user UUID.

Improve:
- secure user lookup by email/display name
- do not expose unrestricted `auth.users`
- implement server/RPC with admin authorization
- show matching user clearly before linking

### P0.3 Operational notifications
Status: 🔴

Needed:
- in-app notification for new booking request
- booking confirmed/cancelled
- new homework/material
- homework submitted/feedback
- new message
- optional email later

## Priority 1 — provider integrations

### P1.1 Automatic Microsoft Teams meeting creation
Status: 🔴

Goal:
- when teacher confirms an online booking, optionally create Teams meeting automatically
- store meeting URL and provider event ID
- handle reschedule/cancel
- preserve manual meeting URL fallback

Requires:
- Microsoft Graph app/OAuth
- permission model and token storage
- timezone handling
- provider failure/retry behavior
- privacy/security review

Do not mark active until a real provider-created meeting is verified.

### P1.2 Google / Microsoft Calendar synchronization
Status: 🔴

Goal:
- teacher connects Google Calendar and/or Outlook Calendar
- busy times block Academy availability
- confirmed/cancelled sessions synchronize both directions where feasible
- timezone/DST safe

Recommended first implementation:
1. one-way busy-time import
2. Academy → provider event creation
3. later bidirectional edits

Must preserve internal Academy calendar as canonical fallback.

### P1.3 Payments
Status: 🔴

Goal:
- course/session/package pricing
- checkout
- payment status
- refunds/cancellations
- receipts
- admin visibility

Decision required:
- Stripe, Swish-compatible provider, or both
- marketplace/teacher payout model vs Academy receives all payments

Do not implement payout complexity until business model is approved.

### P1.4 Embedded / hosted video classroom
Status: 🔴

Options to evaluate:
- Teams/Meet deep link only
- embedded third-party video
- own WebRTC architecture

Recommendation:
- avoid custom WebRTC initially
- use provider meeting creation first

## Priority 2 — richer Learning Space

### P2.1 Binary file upload/storage
Status: 🔴

Current:
- homework/materials support URLs and text.

Needed:
- teacher upload PDF/image/audio/doc
- student upload homework attachment
- file size/type validation
- private storage paths
- signed URLs
- retention/delete policy
- malware/file safety considerations

Likely implementation:
- Supabase Storage with strict RLS and per-Learning-Space paths.

### P2.2 Placement / test engine
Status: 🔴

Needed:
- placement test
- teacher-created quizzes
- question bank
- attempts/results
- scoring
- manual/automatic grading
- recommendations by CEFR level

Start with simple multiple-choice + short answer before AI grading.

### P2.3 Realtime collaborative notebook
Status: 🔴

Current:
- private/shared notes exist but are not collaborative live editing.

Needed:
- shared document/note
- realtime updates
- conflict handling
- authorship/history
- optional teacher annotations

Avoid complex Google-Docs-style CRDT until real demand is proven.

### P2.4 Session history and attendance
Status: 🟡 partial

Current:
- bookings can complete/no-show.

Improve:
- dedicated timeline
- attendance notes
- session summary
- duration actually delivered
- teacher/student view filters

### P2.5 Learning progress analytics
Status: 🟡 partial

Current:
- one progress percentage + levels/topics.

Improve:
- CEFR skill dimensions
- lesson milestones
- homework completion trends
- attendance
- teacher assessment
- student-visible progress history

## Priority 3 — commercial/scale features

Status: ⏸ until real users validate core flow.

Possible later work:
- packages/subscriptions
- teacher payouts
- group classes
- parent role
- certificates
- reviews/ratings
- teacher approval workflow
- support tickets
- Academy CMS/content pages
- reporting/admin analytics
- AI lesson assistant
- AI homework feedback suggestions
- AI placement assistance
- automated reminders
- waitlist
- cancellation policy engine
- discount/coupon system

## Technical debt / hardening backlog

- split `AcademyPortal.tsx` further when complexity grows
- add browser E2E (Playwright or equivalent) for Academy flows
- add seeded local/test environment for Student/Teacher/Admin acceptance
- add integration tests around Supabase RPCs/RLS in CI
- add secure Teacher user lookup
- add audit trail for admin/teacher operational actions
- consider unread-message counters/notifications
- consider pagination for bookings/messages/resources once real data grows
- monitor Academy indexes after actual traffic before removing "unused" indexes
- enable Supabase leaked-password protection if account/security policy permits
- separately review legacy non-Academy Supabase advisor warnings; do not mix into Academy feature work without scope approval

## External boundary

Do not describe any roadmap item above as implemented merely because a DB field or placeholder exists.

Before moving an item from 🔴/🟡 to ✅:
1. implementation exists
2. relevant security/data rules exist
3. tests/build pass
4. production deploy completed when requested
5. functionality verified to the extent accessible
6. this roadmap and handoff are updated
