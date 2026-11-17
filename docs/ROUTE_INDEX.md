2026-11-17 · Academy stability/navigation hardening (fix/academy-stability-navigation-20261117). Reviewed App/Academy/Welcome routing and repeated-entry risk. Key fix: /academy is now routed by top-level App() before LingoApp mounts, so Academy no longer opens the App Dexie database or starts App-only local DB lifecycle. Welcome iframe resize feedback loop removed (no child ResizeObserver/window-resize height echo); parent ignores <=2px height churn. Unreachable legacy Welcome implementation removed from Landing.tsx to reduce bundle/work on repeated entry. Academy top grouped menus now close when another opens, after section selection, and on mouse leave. Academy typography normalized (hero/section/card sizes reduced from oversized ranges). Academy personal Learning Spaces are now scoped to the logged-in student's rows even for admin users; admin pending enrollment query is filtered to interested and capped at 200. Added docs/LINGO3_APP_ACADEMY_GUIDE.md and npm run check:academy regression checks. No route removals; /academy.html remains compatibility redirect. External provider integrations unchanged.

2026-11-17 production verification: Academy expansion from PR #45 is live from code commit 804626e37287cfaea8b69fb2b1cd8c00b160162e. Vercel production dpl_GQ6z1sMazzybrF8fXyYc84tcCtPp is READY and mapped to lingo3.com. Live HTTP checks: /academy -> SPA shell 200 with current production asset; /academy.html -> compatibility redirect page to /academy; / -> shared Lingo3 shell 200. Supabase live verification: 6 active starter courses, 0 active teachers (intentionally no invented teacher profiles), 0 enrollments/learning spaces/bookings before real user activity. Sitemap/route behavior reviewed against production.

2026-11-17 · Lingo3 v0.7.5 · Academy platform expansion (feat/academy-platform-phase1-3-foundation-20261117). Verified implementation reference: src/academy/Academy.tsx, src/academy/academy.css, src/App.tsx, src/auth/SignIn.tsx, public/showcase.html, public/academy.html, Supabase migrations 20261117133000/134000/140500. /academy is now the interactive Academy route using the shared Lingo3 Supabase session; legacy /academy.html redirects to /academy. Public Academy: compact sticky grouped navigation, Find Learning Path hero, EN/SV/FA full UI switching with Persian RTL, DB-backed course catalogue and topic lists, formats (1-to-1 online, online group up to 3, offline introduction), teacher directory, teacher contact fields (email/phone/Teams chat/Teams call/Telegram), assigned teacher courses, level guide, About/How/Pricing/Resources/Contact, trial request. Personal space: student enrolments, teacher assigned courses, private Learning Space progress and notes. Admin-only Studio (user_settings.is_admin): create/edit multilingual courses, delivery modes, pricing, Telegram; create/edit teachers, picture/intros/languages/levels/specialties/contact, link teacher account, assign courses; review interested enrolments, assign teacher, activate enrolment and create Learning Space. Active capabilities are DB/RLS-backed. No fake teachers are seeded. Automatic Teams meeting creation, provider calendar availability, payments, video hosting, file upload/homework/test engines and realtime shared notebook are NOT claimed active; links/data fields and secure platform foundations exist for later provider integrations. Browser Back works normally; fixed ↑ button returns to top; sticky header compacts while scrolling.

2026-11-17 Academy routing correction (fix/separate-academy-route-and-root-welcome-20261117): root / is now the shared Welcome gateway for both Lingo3 App and Lingo3 Academy, including returning/signed-in browser users. Enter App continues into the existing app/session flow; Enter Academy navigates to the standalone static /academy.html. vercel.json SPA rewrite now excludes academy.html, showcase.html and PWA/static metadata; Workbox navigateFallbackDenylist also excludes Academy/showcase so the App service worker cannot replace them with index.html. Existing internal app routes remain unchanged. This fixes Academy links opening the App and ensures both destinations are visible from the same Welcome.

2026-11-17 Welcome dual-entry visibility fix (fix/welcome-dual-entry-visible-20261117): the real first-visit Welcome React screen (src/ui/Landing.tsx at /) now renders two always-visible top-level entry cards before the showcase iframe: Lingo3 App calls the existing open/session flow; Lingo3 Academy navigates directly to /academy.html. This removes reliance on controls inside the embedded /showcase.html iframe. Existing showcase links remain as secondary entries. No workspace route changes. Back from Academy returns normally through browser history or Welcome link.

2026-11-17 Academy specification integration (feat/academy-two-entrances-20261117): /academy.html now mirrors the uploaded Online Teaching Platform structure at public-site level: How it works; courses/formats; CEFR levels/placement placeholder; verified-teacher directory placeholder; pricing/package model; real email-based trial/meeting enquiry; local-only My Notes; Learning Space architecture (overview/progress, session history, homework/materials, tests/results, shared notebook, vocabulary/flashcards, messages, calendar); Student/Teacher/Admin portal architecture; sample Practice; resources; references; contact/legal readiness. Live vs planned capabilities are explicitly labelled. No production Academy auth roles, DB Learning Space, calendar slot engine, payments, video, teacher records, or RLS are claimed as implemented. Welcome remains dual gateway App → / and Academy → /academy.html. Back behavior is browser history plus Welcome link. Code review reference: public/showcase.html + public/academy.html, commit 3623fe8.

2026-11-17, feat/academy-two-entrances-20261117: Welcome /showcase.html now has two equally visible entry cards: Lingo3 App → / (existing auth/workspace), Academy → /academy.html (top-level navigation from iframe). Academy adds #booking email-based enquiry (not confirmed booking) and #notes local-only save/export; #teachers no verified trainers, #courses formats planned, #practice sample questions. No shared Academy account data, teacher calendar, live meeting, or payment implemented. Back uses normal browser history; return Welcome link available. Reviewed public/showcase.html and public/academy.html. Deployment/browser functional checks pending.

2026-11-17 Academy follow-up (branch feat/academy-website-navigation-20261117): Welcome iframe Academy links now use target=_top to navigate the whole browser. /academy.html opens directly with no required language selection; UI language selector remains optional; #teachers lists only verified instructors (currently none), #courses shows planned formats, #practice provides browser-local interactive sample questions, #resources is planned material, / routes to existing Lingo3 sign-in. No teacher booking, payments, authenticated Academy classroom, or database persistence. Existing app routes unchanged. Browser Back returns to prior page; Academy Welcome links /showcase.html. Review code: public/showcase.html, public/academy.html.

## 2026-11-17 — Academy public route
Reviewed 0.7.5, branch feat/academy-foundation-20261117. /showcase.html now links to /academy.html and existing / app. /academy.html is a static, responsive public page; internal anchors #match, #courses, #resources, #contact; Welcome links back to /showcase.html; Lingo3 Login links to existing / app auth gate. Language selectors are local-only; they do not save profile data or assign a trainer. Course cards and resources are explicitly planned, not active. Existing workspace routes and Back behavior unchanged.

# Lingo3 — route index

Reviewed: 2026-11-09. App version: 0.7.5.
Code reference: base main `dfa536ed7197aa7de6aa3698859f79cb5adcbb56`; branch `feat/review-card-removal`; `src/ui/Training.tsx`, `Review.tsx`, `WordCard.tsx`, `src/App.tsx`.
Review scope: highlighted information button opens full native/active-learning-language details from Word Practice and Recall. Bottom Remove offers tests-only suspension (manual practice retained) or personal-list soft removal; shared bank retained. Restore to tests available for suspended words. Detail Back returns to the current activity; recall removal skips the word without grading/counting it. Paths/primary menus unchanged.


## Workspace routes

| Path | Internal tab / screen | Entry | Back / return |
|---|---|---|---|
| / | add / AddWord | Logo, Add a word primary tile, Home/exit actions | Browser tab history |
| /training-center | training-center / TrainingCenter | Primary tile, child return link | Home → / |
| /words | browse / Browse | Training Center + sibling navigation | Training Center link; browser history |
| /grammar | grammar / GrammarManager | Training Center + siblings | Training Center link; browser history |
| /read | read / StoryMode | Training Center + siblings | Training Center link; browser history |
| /review | training / Training | Training Center + siblings | Home/exit → /; browser history |
| /recall | review / ReviewTab | Recall test primary tile | Exit resets review session and returns to / |
| /translate | translate / Translate | Primary tile | Other primary tiles; browser history |
| /settings | settings / SettingsPanel | Primary tile | Other primary tiles; browser history |

Workspace sign-in is enforced by App when authConfigured and no session. State changes push a history entry with lingo3Tab and TAB_PATHS; popstate restores valid tabs. Trailing slashes are normalized for route selection. Unknown/non-screen entry paths initialize the Add screen while preserving the initial URL until a navigation occurs. Do not invent dedicated login, profile or admin URLs: those are conditional/nested components.

## Public and conditional routes

| URL / condition | Behavior | Navigation |
|---|---|---|
| /showcase.html | Static public showcase | Header/footer anchors and App Login/Open app |
| /privacy | Privacy before session gate | Explicit Back pushes / |
| /invite/<name> | Parsed inviter-aware landing | Open clears invite URL to /; current entry/session logic retained |
| First visit, signed out | Landing | Open app → session gate |
| Auth configured, signed out | SignIn | Existing authentication flow |
| Recovery session | ResetPassword before Workspace | Done ends recovery and resumes Workspace |

Public aliases/first-visit behavior remain subject to existing service-worker/server configuration; no deployment routing change is part of this batch.

## API inventory (not pages)

Existing handlers, verified by repository paths: /api/expand, /api/translate, /api/story, /api/tts, /api/grammar-examples, /api/ai-status. Authentication, rate limiting and provider behavior are governed by their existing handlers; this review does not certify all endpoint behavior.

Shared-bank RPC `lookup_shared_expansion` is called before AI by src/ai/expand.ts when no hint/partner is supplied. The new 200-concept batch covers all eight supported languages. Stored form keys removed repeated morphology parsing: anonymous database samples measured 13–68 ms; eight real HTTPS inflection lookups parsed correctly. Network timing is separate (one initial cold HTTPS request took 7.228 seconds; the seven warm requests took 155–415 ms). The client still waits 1.8 seconds before its server fallback; hints/paired words intentionally request custom context. No new navigation entry is required.

## Status

All listed workspace/public entries are implemented in reviewed source. No new planned feature is represented as an active route. The bank admin UI has no new route in this change; query performance was improved within the existing RPCs. Existing compatibility paths are retained intentionally; no links or pages were removed. Signed-in visual/browser Back testing was not performed in this data-only task.
