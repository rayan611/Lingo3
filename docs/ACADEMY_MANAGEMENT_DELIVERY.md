2026-11-18 release verification: production source f9c8408bb3fa3032f6d4e77413b56df430d2fffb, deployment dpl_B6U7WtmEWWveDn1ugR2yUkQfa3zf. Vercel build completed in 41s; live lingo3.com serves index-CIUEiV-3.js / Academy-67xfYk_A.js containing new admin roster, group scheduling and calendar RPCs. Admin/my/teachers routes returned HTTP 200. PR #56 is draft; source not merged to main. New signed-in/viewport browser E2E remains unverified: local Chromium failed with socket Operation not permitted. SQL fixture cleanup verified zero test users. This delivers roster/scheduling foundation, not all remaining Academy scope.

## Academy management delivery — 2026-11-18

Branch: `feat/academy-class-management-20261118`, based on `6b00c4b7beb6b0ad621327b48aae8443cbfca04d`.

Implemented:
- Admin account directory with pagination, name/email/phone/username/UUID search, last sign-in (not live presence), teacher profile shortcut, user enrollment shortcut, audited admin grant/revoke and last-admin guard.
- Collapsible admin editors and lists; teacher courses/students visible, assign teacher, pause/restore/complete and soft-remove enrollment preserving history.
- Classes/members/sessions/attendance separated from legacy individual learning spaces. Private/group classes, capacity holds for pending requests, teacher-added students, student membership requests, daily/weekly recurring sessions with local timezone DST validation and teacher/student overlap guards across legacy bookings and new sessions.
- In-app notifications, primary/backup Zoom/Teams links, cancellation requests with teacher response, attendance and session summaries. Individual cancellation in groups leaves the group intact.
- Public sanitized calendar combines availability, legacy bookings and group sessions. Busy options cannot be chosen in booking dialog. No participant identity/meeting URLs in public responses.
- Fixed pre-existing INSERT RETURNING RLS conflict preventing enrollment/learning-space restoration; paused/removed enrollment blocks classroom writes while retaining history.

Database: seven migrations 20261118172726 through 20261118220631 applied to production. Transactional fixtures rolled back. SQL scripts cover permission denial, admin audit idempotency, phone/username search, capacity, DST, overlap, enrollment request/acceptance, cancellation, public calendar privacy, pause/remove/restore and learning-space workflows. No real user records edited for testing. Security advisor identifies expected callable authorization-checked RPCs, public calendar/catalog projections, plus existing unrelated dictionary/Auth warnings. Not a claim of zero security warnings.

Validation: Full npm test and TypeScript/Vite/PWA build passed including calendar integration. Dedicated React roster tests passed for shortcuts, explicit role confirmation, paging, stale search suppression and offline errors. SQL calendar and phone/username search tests passed with rollback. Actual signed-in browser E2E and new responsive screenshots pending; Chromium launch failed with socket Operation not permitted. Existing navigation suite uses mocked transport.

Release: previous production 6b00c4 / dpl_vjtx6D16GAFcwHZoYK7tVMRLh6gm. Production source f9c8408 deployed as dpl_B6U7WtmEWWveDn1ugR2yUkQfa3zf; live assets verified. Do not label the entire approved Academy program complete.

Remaining approved work:
- Bulk/day/future-session cancellation and makeup proposals with each student response, expiry and unanimous group acceptance; single-member accepted cancellation should release session; stale cancellation resolution needs tightening.
- Unified class/legacy learning-space membership lifecycle and scheduling administration, member names in attendance, removal/transfer and historical memberships.
- Multi-weekday/end-date recurrence and timezone UI for availability; time-off rules; full teacher/student calendar UX; reservation concurrency and expiry worker tests.
- Domain email delivery/outbox/retry/reminders/admin monitoring. No email-provider env configuration discovered; actual delivery requires verified sender/provider.
- Shared group notes/resources/homework/private grading, reusable templates, quiz engine, selective vocabulary/grammar sharing for groups (existing individual classroom sharing remains).
- Teacher profile video/verification/reviews, catalogue filters, complete SV/DE localization for new group components, full mobile/tablet/desktop role E2E, deployed functional checks.
- Full impact preview for teacher deactivation/transfer, enrollment-change audit; current paused enrollment does not cancel existing future bookings.

SITEMAP and ROUTE_INDEX reviewed/updated with actual entries and Back behavior. PRODUCT_CHARTER absent; not invented. Moodle integration, embedded video and automatic provider meeting creation excluded by owner; manual meeting links retained.
