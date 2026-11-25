# Lingo3 Academy — review summary and phased improvement plan

Written 2026-11-25 against app v0.7.19 (`main` at `fc0a7cb`). This is a plan, not a record of
shipped work. Each phase is built, deployed behind a switch, tested and only then turned on.

---

## Part A — Summary of the review

### What was checked
- Code of the App and the Academy, database migrations and row-level security.
- `npm test` (all checks pass) and `npm run build` (passes).
- Screenshots of a local build at phone (390 px) and desktop (1366 px) width.
- Limits: lingo3.com and Supabase were not reachable from the review environment, so pages had
  no real courses or teachers, and no signed-in student, teacher or admin flow was exercised.

### What is good
- **The vocabulary App** is well built: one review card per word per language, AI runs only
  when a word is added, offline first, clear code.
- **Academy database security** is solid: every table has access rules, a student can only
  create a booking as `requested`, double bookings are blocked on the server, and every
  privileged function sets a fixed `search_path`.
- **The main home page (`/`)** is clean and clear and is the right style model for the Academy.

### Main problems found
1. **Academy code is not maintainable.** `src/academy/Academy.tsx` is 93 KB on 329 lines (one
   line is 12,000+ characters); `AcademyPosts`, `AcademyScheduling`, `AcademyWeek`,
   `statusLabels` and `academy.css` (one 14,800-character line) are the same. Two files
   (`Academy.tsx`, `AcademyPortal.tsx` with 55 pieces of state) hold public, student, teacher
   and admin screens together.
2. **Everyone downloads everything.** The Academy bundle is 266 KB, the largest in the app, and
   includes admin, SEO and teacher tools for every visitor.
3. **No design system.** 128 different colours, 14 `!important`, competing purple / teal / gold /
   blue gradients.
4. **Languages.** The Academy supports en/sv/fa/de only (the App more); each file has its own
   list; Persian right-to-left is handled in about 3 places.
5. **Public page clutter.** 9 header items, then a second row (App / Courses / Teachers /
   Language), then the same buttons again: "Teachers" appears 4 times. The gold "My Academy"
   button dominates even for logged-out visitors. The hero image is a placeholder
   ("A1 A2 B1 / Student ↔ Teacher"). Empty states show admin text to the public ("Admin can
   add and publish teachers in Admin Studio"). The page ends with "payments … not available yet".
6. **Phone bottom bar** for a guest has three personal tabs (My courses, My Academy, Profile)
   that all lead to "Log in", and no Courses tab. The back-to-top button overlaps content.
7. **Students:** finding a course, a teacher and a time is spread over three screens. After a
   booking request nothing happens: no confirmation, no email, no payment.
8. **Teachers:** no "Today" view; everything is collapsible sections inside `/academy/my`.
9. **Admins:** one long page of collapsible tools; no overview with numbers; risky actions use
   the browser's plain `confirm()` / `prompt()` (5 places).
10. **The App ↔ Academy bridge goes the wrong way.** A student can share App words into the
    classroom as text (`src/ui/AcademyBridge.tsx`), but the teacher's lesson words never reach
    the student's App review. This is the product's main selling point and it is missing.
11. **Missing:** payments, notifications (email or push), automatic meeting links, reviews (built
    but off), editable profile, time zones (converted in only 3 places), placement test.
12. **Documentation noise.** About 4,100 lines of logs; the same "release finalized" commit
    repeated 4–6 times; every session must read 6+ documents before changing anything.

### The owner's PDF ("دستورالعمل اجرایی لینگو۳ اکادمی") — verdict
Inspired by tikkaa.ir and Preply. Its guiding principle is accepted as the product rule:
**the Academy is a bridge from the teacher's class to the student's own word bank.** Every
feature must (1) build trust, (2) continue learning after class, or (3) make progress visible.

| PDF item | Decision |
|---|---|
| 5.1 Lesson words → student's word bank | **Accept, first priority.** Do not add a separate `student_word_cards` table: the App already keeps a review card per word per language. Add one server table of lesson words that the App imports on sync. |
| 5.2 After-class summary (learned · words · weak point · homework) | **Accept.** One short form replacing the scattered summary/homework/resource screens. AI draft allowed; nothing reaches the student without the teacher's approval. |
| 5.3 Teacher profile and filters | **Accept the profile.** Filters start with language, level and free time; add price, age group, native language once there are about 10 teachers. |
| 5.4 Placement test | **Accept, smaller.** 1–2 languages first; result shown as an estimate the teacher confirms in the trial lesson; usable without sign-up. |
| 5.5 Progress report | **Accept.** Calculated from existing data, kind wording. |
| 5.6 Daily exercise | **Change.** No second exercise system: "today's practice" opens the App review filtered to lesson words. |
| 5.7 Trial, teacher-swap guarantee, reviews | **Accept reviews** (after a completed lesson only). Guarantee/refunds wait for payments; publish as written policy first. |
| 5.8 Cancellation and no-show policy | **Accept.** Add student/teacher no-show statuses and an admin report. |
| Payments and 4/8/12 packages | **Owner decision needed** (market and gateway). Until then: manual "paid" marking. |
| Phase 3 (parents, in-app video, AI scenarios) | **Accept as later.** Meet/Zoom links meanwhile. |
| Design (RTL, mobile first, Vazirmatn, 44 px targets, tokens, 4.5:1 contrast) | **Accept**, but Persian digits and Vazirmatn only in the Persian locale. |
| 10-block home page | **Cut to about 6** until real numbers and reviews exist. |
| 8-week schedule | **Needs a Phase 0** (restructure) first. |
| "Tech-agnostic (WordPress, Next.js…)" | Not applicable; stack stays Vite + React + Supabase. |
| (Not in the PDF) Notifications | **Added.** Reminders and "summary published" need email (Resend) in Phase 1. |

### Target structure (simple for every role)
- **Visitor:** Home · Teachers · Courses · Level check.
- **Enrolment flow:** Course → teachers of that course → free time (in the student's time
  zone) → sign in (only here) → request → teacher confirms → meeting link + reminder.
- **Student (4 tabs):** Today (next class, homework, new lesson words) · My classes
  (summaries, materials, messages) · My words (opens the App) · Progress.
- **Teacher (4 tabs):** Today (requests, today's lessons, homework to check) · Calendar
  (free times, time off) · Students (one page per student: lessons, after-class form,
  materials, homework) · Profile (with a reusable materials library).
- **Admin (5 tabs):** Overview (numbers + items waiting) · Teachers (approval, credentials) ·
  Courses & languages · Students & enrolments · Reports & settings (no-shows, complaints, SEO).
- Group classes, makeup votes and articles stay, but inside these places, not as menus.

---

## Part B — Phased improvement plan

Priority labels: **Must** = the Academy is not really usable or trustworthy without it.
**Should** = clear value, do after the musts. **Later** = only when there is demand.

### How every phase is shipped and tested
1. Work on a feature branch; full `npm test` and `npm run build` before every push.
2. New behaviour sits behind a switch in `academy_features` set to **off**.
3. Deploy the branch to the protected preview (or `beta.lingo3.com`) and run the phase's
   acceptance list there. Previews use the **production** database: test with the demo
   student and a test teacher, never real students' data.
4. Merge to `main` (= production), turn the switch on, repeat the acceptance list live.
5. Record the result in `CHANGELOG.md` and tick the phase below. Next phase only after that.

### Phase 0 — Foundation (Must · invisible to users)
Goal: make the Academy safe and cheap to change. No behaviour change.

- [x] 0.1 Reformat all Academy files to normal line lengths (code and CSS).
- [~] 0.2 Split by role (done: copy/constants/types split out; Portal and admin tools lazy-loaded. Open: splitting the two giant components themselves): `src/academy/public/`, `student/`, `teacher/`, `admin/`, `shared/`.
- [x] 0.3 Load teacher and admin code only for those roles (smaller download for visitors).
- [x] 0.4 One shared language list for the Academy, ready for all six languages.
- [x] 0.5 Design tokens: about 10 named colours, one button style per purpose, spacing and
      type scale; Vazirmatn and RTL rules for Persian.
- [x] 0.6 Shared time-zone helper (store each user's time zone; show times in it).
- [x] 0.7 Replace `confirm()` / `prompt()` with in-app confirmation dialogs.
- [x] 0.8 Trim the docs: one short changelog block per release, archive old logs.
- [ ] 0.9 Owner checks the current live version on his own phone (Academy opens, login works).

Acceptance: `npm test` passes; every current screen looks and behaves as before at 390 px and
1366 px; visitor download of the Academy is clearly smaller than 266 KB.

### Phase 1 — The core value: class → word bank (Must)
Goal: what the teacher teaches becomes the student's daily review.

- [x] 1.1 After-class form for the teacher: what we learned · new words · weak point ·
      homework · draft / publish. Words autocomplete from the shared word bank.
- [x] 1.2 Lesson words table on the server (with access rules and an undo migration); the
      App imports published lesson words into the student's review on sync, without duplicates.
- [x] 1.3 Student can remove a lesson word or mark it "I know this".
- [~] 1.4 Email notifications (in-app done; email code ready, needs Vercel env RESEND_API_KEY + SUPABASE_SERVICE_ROLE_KEY; 24 h reminder not built) (Resend): booking confirmed / cancelled, summary published,
      review reminder 24 h after class.
- [x] 1.5 Student "Today" card: next class, homework, new lesson words → "Practise now"
      opens the App review filtered to lesson words.

Acceptance: a test teacher fills the form in under 2 minutes; the words appear in the test
student's App review after sync; publishing twice creates no duplicates; the student gets the
email; nothing reaches the student while the summary is a draft.

### Phase 2 — Easy to find, enrol and manage (Must)
Goal: each role sees a few clear places; enrolment is one guided flow.

- [~] 2.1 New navigation (guest bar done) per role (the tabs in "Target structure" above); phone bottom bar
      for guests: Home · Courses · Teachers · Log in.
- [~] 2.2 Guided enrolment (status on Today card; single-flow not built): course → teacher → time → sign in → request → status page
      ("Requested → Confirmed → Lesson link").
- [~] 2.3 Teacher "Today": requests to answer, today's lessons, homework to check.
- [~] 2.4 Teacher student page (after-class form added there): lessons, after-class form, materials, homework in one place;
      reusable materials library.
- [~] 2.5 Admin overview with numbers and tabs; teacher approval step.
- [~] 2.6 Public home rebuilt (about 6 blocks): tagline + "Find a teacher" / "Check your
      level", steps, featured teachers, class → word → review picture, guarantee, join as
      teacher. Single header, language picker in the header, friendly empty states, no admin
      text for visitors, no "not available yet" line.

Acceptance: a new visitor on a phone books a trial request in under 2 minutes without help;
a teacher answers a request and publishes a summary from "Today"; the admin finds pending
items from the overview; all of it works in Persian right-to-left.

### Phase 3 — Trust and progress (Should)
- [ ] 3.1 Full teacher profile: photo and short video, price, trial button, verified
      credentials (files private, only a badge public), age groups, teaching method,
      free-time calendar, reviews.
- [ ] 3.2 Teacher filters: language, level, free time (more when there are ~10 teachers);
      slide-in filter panel on phones; default order = fits the student's level and goal.
- [ ] 3.3 Student progress page: level now / target, words learned, streak, attendance,
      test results, weekly bar chart; kind wording.
- [ ] 3.4 Turn on reviews (only after a completed lesson; teacher can reply) plus a private
      10-second "did this class help your goal?" question.
- [ ] 3.5 Cancellation and no-show policy: free cancellation until 12/24 h, student and
      teacher no-show statuses, makeup lesson on teacher no-show, admin report.

Acceptance: a teacher profile shows every block and reads well on a phone; the progress page
shows real numbers for the test student; a cancelled and a no-show booking appear correctly
in the admin report.

### Phase 4 — Growth (Should · needs owner decisions)
- [ ] 4.1 Placement test for 1–2 languages (10–15 questions), without sign-up; result saved on
      sign-up; suggests teachers and courses; optional 20 starter words into the App.
- [ ] 4.2 "Draft with AI" button on the after-class form (teacher always approves).
- [ ] 4.3 Packages (4 / 8 / 12 lessons) with manual "paid" marking by the admin.
- [ ] 4.4 Online payment, once the market and gateway are chosen (card numbers never stored).
- [ ] 4.5 Teacher-swap guarantee (one free swap after an unsatisfying trial), once payments exist.

Acceptance: test result is saved and changes the suggested teachers; a package's remaining
lessons count down correctly; an AI draft can never be published without the teacher.

### Phase 5 — Later (when there is demand)
- [ ] Parent view for students under 18 (schedule, attendance, report, payments).
- [ ] Automatic Meet/Zoom/Teams links and Google/Microsoft calendar sync.
- [ ] Exercise builder for teachers; AI scenario practice (doctor, office, job interview).
- [ ] Placement tests for the remaining languages.
- [ ] Built-in video classroom with recording (only with explicit consent, and a parent's for under-18s).

### Decisions the owner must make
1. **Payments:** which market first — Iran (Iranian gateway, toman), Sweden/Europe
   (Stripe/Swish), or manual payment for now? (Blocks 4.3–4.5.)
2. **Placement test languages** to start with (suggested: Swedish and English).
3. **Cancellation window:** 12 h or 24 h.
4. **Trial lesson:** free or reduced price.


---

## Status update 2026-11-25 (v0.7.27)

Done: Phase 0 (except splitting the two giant components), Phase 1 (e-mail inactive until Vercel variables are set), Phase 2 (partial: guest bar, admin overview, home), and design v2 parts 1–2 (calm skin, teacher/course cards, three-step booking sheet, phone menu fix). Standards: `docs/UI_STANDARDS.md`, `docs/DECISIONS.md`, audit `docs/AUDIT_2026-11-25.md`. Next: design v2 part 3 (Today screens, admin tabs), CSS debt behind the ratchet, then Phase 3.


## Status update 2026-11-25 (v0.7.28)

Phase 3: level filter added (language filter existed), progress card, no-show and cancellation counts, reviews built (off by default). Phase 4: level check built (Swedish, English). **Not built:** AI draft, packages, payments, teacher-swap guarantee (owner's payment decision pending), richer teacher profile fields, 24-hour reminder e-mail, Phase 5. Decisions: `docs/DECISIONS.md` D-09, D-10.
