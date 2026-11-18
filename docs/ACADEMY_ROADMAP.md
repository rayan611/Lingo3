2026-11-18 · v0.7.5 · branch feat/academy-class-management-20261118, source base 6b00c4 + current patch. This entry supersedes older release-status entries below. Seven new migrations (20261118172726–20261118220631) applied successfully. Frontend release pending at this checkpoint.

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
