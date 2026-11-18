# Academy workflow release — 2026-11-18

Status: implementation complete in feature source; release BLOCKED pending permanent migration approval and signed-in browser acceptance. Production is not claimed updated.

## Changes

- Qualified classroom/student/teacher ownership checks; immutable content identity; session references validated; archived teachers and teachers of cancelled enrollments lose classroom access. Existing history is retained.
- Atomic admin teacher/profile/course RPC; admin enrollment inventory includes student identity, statuses, assignment, cancellation/completion and classroom entry.
- Teacher and student share the notes, homework responses/feedback and messaging workspace. Global visible notices; explicit refresh, recent-first paged history, draft clearing on classroom switch, chosen-session summary editing, full calendar dates and cancelled-slot handling.
- Independent account-owned Academy locale/theme preferences, first-visit country default (IR/DE/SE, otherwise English), manual-choice race protection; compact Settings panel with Back/Escape, greeting beside brand and multilingual teacher-name fields. Existing names are preserved; verified Latin spellings must be entered by an admin rather than guessed.
- Short shared homepage replaces the long embedded showcase; Academy home explains actual teaching capabilities. Legacy showcase and Academy compatibility URLs remain.
- Explicit App-to-classroom vocabulary/grammar sharing with item selection, preview and consent; personal grammar import of a teacher resource with source tag/deduplication. Language context travels with Academy shortcuts without changing native/target settings.
- HTTPS resource/contact links and image CSP compatibility; note/resource edit/delete controls; inline feedback eliminates the prompt-cancel completion defect.
- App history initialization preserves Academy query context; product navigation clears stale tab/overlay history state. Date/score validation added.

## Verification performed

- TypeScript and production/PWA build pass (final summary in handoff).
- Existing 48 Academy and 13 auth/navigation source regressions updated for the new structure.
- `npm run check:academy-behavior`: actual React effects/components with an isolated mocked database transport; teacher/student/admin class panels, submitted answer/feedback, newest messages beyond 200, summary field preservation, cancelled-slot display and classroom draft/data isolation.
- `npm run check:academy-preferences`: actual preference hook with isolated transport; account vs guest/geo precedence, fresh-device restore, cross-account separation, IR/DE/SE/unknown fallback, manual override and delayed-read guard.
- `scripts/check-academy-workflow.sql`: real PostgreSQL role tests after the migration in one BEGIN/ROLLBACK rehearsal. Passed valid and forged ownership, unrelated read denial, private/shared notes, homework answer/feedback roundtrip, message recipient/integrity, >200 messages, preference isolation, atomic failed admin save, archived teacher denial, cancellation and student history retention. Fixture cleanup count is zero.
- Full `npm test` passed, including the existing regression suite; a pre-existing random-UUID fixture selection in collection move tests was isolated so it cannot remove the export fixture from its pack.

## Release blockers and limits

Permanent migration attempts returned `status: expired` / confirmation expired. A read after the attempts confirmed `academy_space_access(uuid)` remains absent. The successful SQL rehearsal ended with ROLLBACK: it is not a deployed migration.

Cloud Browser inspected the rendered shared homepage at CSS widths 390 (Persian), 820 and 1366 (English): no horizontal overflow. The tablet entry buttons measured 46px high. Persian Academy at a 390px frame had no overflowing controls; the mobile menu and language/theme Settings opened correctly. The Academy also visibly reported the missing display_name_i18n column, confirming the old live schema is incompatible with this source. Screenshot capture timed out, so these are DOM/accessibility and geometry checks, not a complete visual acceptance. Initial preview connectivity failures were resolved with a persistent preview session; separate Chromium execution remained blocked by runtime socket restrictions. No physical-device or signed-in live-account acceptance is claimed. The source-only QA viewport harness is scripts/qa/viewport.html, excluded from production build output.

Do not deploy this source against the old schema. Apply and verify `20261118050000_academy_workflow_integrity.sql`, run `check-academy-workflow.sql` again, finish browser acceptance, then merge/release. Refresh Vercel deployment status rather than assuming the earlier daily quota still applies. Verify READY, aliases and the actual deployed commit before reporting production success.

## Coverage boundaries

Automatic Teams meetings, external calendar synchronization, payments, hosted video, binary file storage, an automated testing engine and a realtime collaborative notebook remain separate integrations. Teacher-recorded progress and App review progress are deliberately distinct. Sharing is explicit snapshots, not blanket access to a learner's App data.
