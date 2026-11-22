# Academy implementation instruction — assessment, 2026-11-22

Source: owner-provided six-page Academy instruction. This is a requirements inventory, not a claim that the proposed functionality is complete. Existing production is v0.7.19; current feature branch is unreleased v0.7.20. Existing data and access controls must remain intact. UI locales currently include English, Persian, Swedish and German; teaching-language support and assessment-content coverage must be verified independently.

| Requirement | Current evidence / disposition |
| --- | --- |
| Product purpose: connect classes and personal vocabulary; real learning and trust | Target direction; automatic class-to-personal-bank bridge is not implemented by the existing explicit App-to-Academy sharing flow. |
| Public home, teachers, teacher profile, courses, course profile, about and blog | Existing routes; preserve. Existing learning-path choice is not a validated placement test. |
| Student dashboard, classes, summaries, homework, teacher-recorded progress, settings | Existing components provide parts of these; real account acceptance remains pending. Personal vocabulary and spaced-repetition data live in the app. |
| Teacher dashboard, availability, students, summary and homework | Existing portal provides parts; publishing model and class word workflow need implementation. |
| Admin teacher/course/language management, quality reports, central vocabulary | Admin sections and bank exist; validate exact capabilities and role boundaries before extending. Income, dispute and quality reporting are not confirmed. |
| Parent portal for minors | Phase 3; not implemented; consent and privacy design required. |
| Proposed users, teacher profile, availability, course, booking and lesson tables | Map requirements to existing schemas. Do not create duplicate tables by name; migration plan, RLS, rollback and owner approval required before production schema changes. |
| Lesson words, personal cards, placement, exercise, progress, review, guarantee, payment records | Not established as complete. Design versioned schema/API with idempotency, account isolation, audit and rollback before implementation. |
| Auto-import published lesson words, bank-first lookup, no duplicates, mastery and deletion | Not implemented. Requires robust shared-bank identity, consent, ownership, offline sync and deduplication strategy; do not silently write to personal cards or central bank. |
| Teacher draft, edit and publish summary with homework and words | Existing teacher-written summaries and resources are partial; publication state, word links, notification and atomic import are not verified. |
| AI-generated draft only after teacher approval | Not implemented; model, cost and consent require decisions. Never publish generated content without explicit teacher approval. |
| Teacher profile: photo/video, verified credentials, teaching methods, target age, calendar and reviews | Photo, introduction, languages, levels, specialties and public calendar exist; other fields require data model/verification. Never infer verified status. |
| Teacher filters: language, level, specialty, age, price, time, native language; ranked matching | Language and level added in current branch; specialty filter added using existing fields. Remaining fields and ranking require verified data sources and privacy-safe design. |
| Mobile collapsible filters and student-local calendar | Filter layout is responsive, but collapsible panel and real-device acceptance remain open. Calendar uses browser-local formatting; timezone labeling and cross-zone tests remain open. |
| Placement assessment 10–15 questions per language, anonymous completion, save A1–C2, recommendations and optional 20 starter words | Not implemented; six-language validated item bank, scoring calibration and account linking required. Never market a self-assessment as a validated CEFR assessment. |
| Student progress: levels, words, streak, attendance, scores, weekly chart | Existing teacher-recorded summary and test results are partial. Do not display invented or derived values without verified semantics. |
| Daily exercises and 24-hour reminder | Existing independent practice is separate. Lesson-based exercises, scheduling and opt-in reminders not implemented. |
| Trial lesson, free replacement, verified reviews, private satisfaction survey | Not implemented end-to-end. Trial requests exist; no free-replacement guarantee or functioning public review is claimed. Financial terms and abuse protections require approval. |
| Cancellation, no-shows, makeup/refund | Booking statuses exist; owner must decide 12 vs 24 hours, teacher no-show resolution and payment provider terms before automatic financial action. |
| Integrated video, whiteboard, chat, files and recording | Phase 3. Existing meeting links are teacher-provided; automatic Zoom/Meet links and recording are not established. Recording requires explicit consent and minor safeguards. |
| Scenario practice, teacher exercise generator, packages/subscriptions | Future scope; provider, AI cost, privacy and payment approval required. |
| Mobile-first visual system, RTL/LTR, base 16px, contrast, keyboard, 44px controls | Existing light/dark and responsive styles provide partial foundation; Persian numbering and all viewport/accessibility acceptance unverified. Preserve locale-appropriate LTR and digit formatting for non-Persian users. |
| Home blocks: real counts, languages, 4 steps, teachers, class-to-bank, real reviews, guarantee, teacher invitation | Existing home has actions, active course/teacher previews and feature summary. Do not invent counts, reviews, bank integration or guarantee. Remaining blocks need real supporting functionality. |
| Private credentials, export/delete, consent, no stored card numbers | Must verify actual implementation and permissions end-to-end. No new payments, recording or credential storage in this increment. |
| Delivery checklist and six-language assessment | Not satisfied. Automated suite, production build, actual browser/device, authenticated role, isolation, migration and rollback checks must be recorded before release. |

## Next implementation work
1. Design lesson-to-bank data contract against current Supabase and Dexie schema, including atomic publishing, consent, idempotency and deduplication; stage reversible migration and tests before requesting production schema approval.
2. Complete teacher discovery using verified schema fields, localized mobile filter panel and timezone-aware availability; add real role and viewport acceptance.
3. Specify approved six-language placement content and scoring before enabling result storage or recommendations.
4. Decide trial/replacement, cancellation/refund and payment terms before advertising or automating them.
5. Complete remaining progress, reminders and Phase 3 modules only after foundational data and permissions are verified.
