# Lingo3 Academy — release 0.7.7 — 2026-11-19

Runtime: `e0a646654c5c214ba1fcd3da8970be1fda9c86ad` ([PR #57](https://github.com/rayan611/Lingo3/pull/57), [PR #58](https://github.com/rayan611/Lingo3/pull/58)). Production `dpl_74ibKKE4JTxaiAanKAiRstiodHNC` READY; https://lingo3.com. Live version 0.7.7 / 0.7.7-mwnr9x6e.

| Area | Delivered behavior | Verification boundary |
|---|---|---|
| Teacher workspace | Named student selection, selected classroom, private teacher notes/materials/weekly plan, pending work and session overview | Component/database tests; actual signed-in browser acceptance outstanding |
| Shared learning | Class feed, materials, homework and private per-student response/feedback; existing individual sharing retained | SQL privacy checks and React regressions |
| Demo | Existing Rayan teacher linked to clearly marked demo student, restricted student-view RPC, reset scoped to demo, no real slot conflicts, excluded teacher overview totals | Database guards tested; browser role switch not exercised |
| Educational posts | Teachers/admin create text or YouTube/Instagram link articles, title, four categories, body, keywords, description; private draft, student snapshot sharing or public translation | Article UI and SQL permission/language tests |
| Languages | FA/EN/SV/DE independently authored translations; only matching published locale appears; explicit language kept in navigation/share | Strict locale regression; Persian guest browser verified. No automatic translation or claim of complete manual review of every system/provider message |
| SEO | Server-readable public Academy content, title/description, OG image, canonical, published hreflang, Article JSON-LD, dynamic sitemap, private noindex | HTML escaping tests and live HTTP metadata/XML checks. No ranking/indexing guarantee |
| Public pages | Stable course/teacher detail URLs, course/teacher booking context, device sharing/copy; old levels path redirects | Guest profile/copy/Back browser and route tests. External apps not sent messages |
| Schedule | Time-off, cancellation and makeup votes, demo exclusion from real public calendar | Transactional SQL tests; real group acceptance workflow in browser not yet exercised |
| Administration | Impact preview and guarded transfer/course closure; retained history and original authorship | SQL transfer/history/course-closure tests; no real courses transferred/closed for QA |
| Reviews | Data/permission/moderation foundations remain disabled | No fabricated stars or ratings published |

## Checks performed

- Full `npm test` successful after final code changes; 189 route/navigation assertions across four mocked roles, 13 auth-navigation checks, preference/sharing/roster/article regressions and SEO escaping checks.
- TypeScript + Vite + PWA production build successful (final local Vite 17.01s), and Vercel production READY for exact runtime SHA.
- Transactional SQL checks for student/teacher boundaries, private draft sharing, malicious video URLs, makeup voting/time-off and lifecycle history preservation. QA fixtures rolled back; no public example posts published.
- Live browser: public Persian articles page, teacher directory/detail, language continuity and Back, sharing link language and successful copy; desktop light-theme category label visually checked.
- Live HTTP: version, article and teacher server HTML metadata, canonical/hreflang, 73 sitemap URLs (zero private routes), private `noindex`, robots and levels redirect.

## Still outstanding

- Domain-email provider/sender configuration and verified reminder/retry delivery. Existing in-app notifications do not imply email delivery.
- Full signed-in real teacher → student → booking → completed session → homework → feedback browser acceptance, plus phone/tablet/desktop review of the new role screens. Browser used here was signed out; SQL/component checks are not a substitute for this acceptance.
- Editorial population: the public articles page is empty until a teacher/admin publishes content. Translations are manual and independent; drafts never fall back into a public language.
- Teacher transfer deliberately cancels future private bookings and ends old group membership; replacement schedule must be arranged explicitly. Prior assessments keep their original authorship.

## Rayan's quick check

1. My Academy → Personal space → Teacher Space. In shared student workspaces, choose the named demo student.
2. Switch to Demo student view; check homework, shared notes and messages, then return to Teacher view.
3. In the article studio choose language first, add title/category/body or video link, keywords and description; save as draft.
4. Share a saved copy to the selected student's space. It should appear there while staying absent from the public articles page.
5. Publish the desired language. Check `/academy/posts?lang=fa`; other language listings should only show separately published translations.
6. If the app offers Update now, apply it before testing. Deployment version is 0.7.7.
