# Lingo3 Academy — UI standards

Written 2026-11-25 (app v0.7.27). **Read this before changing any Academy screen.** It is the single source for
fonts, colours, spacing, menus and components. Enforced in part by `scripts/check-ui-standards.mjs`
(`npm run check:ui`); the rest is review discipline. Why the rules exist: `docs/AUDIT_2026-11-25.md`.

## 1. The rule of three

1. **Use a token, not a value.** Colours, radii, spacing and touch size come from the `--ac-*` variables defined at
   the top of the "Design tokens" block in `src/academy/academy.css` (light and dark). Never add a new hex colour.
2. **Use a component, not new markup.** If a screen needs a card, chip, button, sheet or skeleton, use the shared one
   (section 5). Add a new shared component only when two screens need it.
3. **One definition per thing.** Do not restate a rule further down the file to "fix" an earlier one. Edit the
   original rule. (Six separate `.academy-nav.is-open` blocks fighting each other hid the phone menu in v0.7.19.)

## 2. Fonts

| Use | Stack | Notes |
|---|---|---|
| Latin text (en, sv, de) | `Inter, system-ui, -apple-system, 'Segoe UI', sans-serif` | Inter is **not** bundled; in practice the system font renders. Do not add another Latin family. |
| Persian (fa) | `Vazirmatn, Inter, system-ui, sans-serif` | Loaded from Google Fonts in `index.html`; applied automatically by `.academy[dir='rtl']`. |
| Code / error text | `ui-monospace, monospace` | Only in diagnostics. |

Sizes: body 16 px / line-height 1.62 (Persian 1.8). Headings: h1 `clamp(1.4rem, 5vw, 2rem)` on detail pages and
`2.05rem` on the phone home hero; h2 about 1.5rem; card titles 1.08–1.15rem. No text below 14 px (`0.875rem`) except
legal footnotes. Do not set `font-size` in px on new rules; use `rem`.

## 3. Colours (tokens)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ac-bg` | `#f5f6fb` | `#0c1021` | Page background |
| `--ac-surface` | `#ffffff` | `#151a33` | Cards, header, bottom bar, sheets |
| `--ac-surface-2` | `#eef0f8` | `#1d2340` | Chips, inputs' resting fill, skeletons |
| `--ac-border` | `rgba(20,24,50,.14)` | `rgba(255,255,255,.14)` | All 1 px borders |
| `--ac-text` | `#161a33` | `#f8f7ff` | Body text |
| `--ac-muted` | `#4d5372` | `#b9bdd6` | Secondary text (4.5:1 contrast or better) |
| `--ac-primary` | `#5a48d8` | `#7c6cf0` | The one brand colour: primary buttons, selected states, links of emphasis |
| `--ac-primary-text` | `#ffffff` | `#ffffff` | Text on primary |
| `--ac-accent` | `#f0b429` | same | Numbers and verified badges only. Never a button. |
| `--ac-success` / `--ac-danger` | `#3ecf8e` / `#e5484d` | same | Status only; danger also for destructive buttons |

Rules: **no gradients** on buttons, cards or headers. No gold/teal/blue highlights. Status is never colour-only
(add text or an icon). Derived tints use `color-mix(in srgb, var(--ac-primary) 12%, transparent)`.

## 4. Spacing, shape, motion

- Space unit `--ac-space: 16px`; gaps 8 / 12 / 16 / 24. Card padding 18 px (phones 16 px).
- Radius: cards and sheets `16–18px`, buttons and chips `999px`, inputs `12px`.
- Touch target: **44 px** minimum height for anything tappable (`--ac-touch`). Chips in dense rows may be 40 px.
- Shadow: one soft shadow only (`0 1px 2px rgba(20,24,50,.05), 0 8px 24px rgba(20,24,50,.05)`).
- Motion: only the skeleton shimmer and 0.2 s hover/focus transitions. Honour `prefers-reduced-motion`.
- Focus: the existing 3 px outline (`.academy *:focus-visible`) must stay visible. Never `outline: none`.

### Breakpoints (use only these in new CSS)

| Name | Rule | Meaning |
|---|---|---|
| phone | `@media (max-width: 650px)` | One column, bottom sheets, bottom bar |
| tablet | `@media (max-width: 860px)` | Hamburger menu + bottom bar appear |
| laptop | `@media (max-width: 1100px)` | Tighter desktop header |

The older file still has `520/700/720/800/900`; do not add more. Prefer folding them into the three above when you
touch them (the ratchet in `check-ui-standards.mjs` only allows the count to go down).

## 5. Components (use these)

| Need | Use | File |
|---|---|---|
| Primary / secondary / danger button | `.ac-btn`, `.ac-btn.primary`, `.ac-btn.danger` (legacy `.academy-primary` is skinned to match) | `academy.css` |
| Card | `.ac-card` (legacy `.academy-card` is skinned to match) | `academy.css` |
| Chip (info) / filter chip | `.ac-chip`, `.ac-chip-soft` / `.ac-chip-btn(.on)` | `academy.css` |
| Teacher in a list | `AcademyTeacherCard` | `AcademyTeacherCard.tsx` |
| Course in a list | `AcademyCourseCard` | `AcademyCourseCard.tsx` |
| Loading list | `AcademySkeletonCards` | `AcademyTeacherCard.tsx` |
| Confirm / ask for text | `askConfirm()` / `askText()` — **never** `window.confirm/prompt` | `AcademyDialogs.tsx` |
| Multi-step form | the booking sheet pattern: steps with `hidden` panels, `ac-wizard-steps`, one submit on the last step | `AcademyBookingDialog.tsx` |
| Times and dates | `time.ts` (`formatLessonTime`, `userTimeZone`) — viewer's own zone, short weekday format | `time.ts` |
| Language list / locale type | `types.ts` (`Locale`), `copy.ts` (UI strings), `constants.ts` | `src/academy/` |

New shared components: put props in a typed object, take `locale`, keep all user-facing text in a per-locale map for
**en, sv, fa, de**, and add the CSS under a `.academy .ac-…` selector.

## 6. Menus and navigation

- **Guest:** header = brand + Log in + (tablet/phone) hamburger. Bottom bar (phones): **Home · Courses · Teachers · Log in**.
- **Signed in:** bottom bar **Home · My courses · My Academy · Profile · Settings**. Admin Studio opens on its **Overview**.
- **Depth: at most three levels** — menu → group → item. A fourth level is a new page, not a deeper menu.
- The phone menu is a **sheet above the bottom bar** (`.academy-nav.is-open`, fixed). Because it is `position: fixed`,
  **no ancestor may have `backdrop-filter`, `transform`, `filter` or `will-change`**: it would trap the sheet (this is
  exactly what hid the menu before v0.7.23). The header is opaque on tablet/phone for this reason.
- Back always goes to the logical parent (`docs/NAVIGATION` rules in `docs/SITEMAP.md`). Overlays (login, booking,
  settings) are history entries: Back/Escape closes them.
- A new page needs: a route in `Academy.tsx`, a line in `docs/SITEMAP.md` and `docs/ROUTE_INDEX.md`, and a check in
  `scripts/check-academy-navigation.mjs`.

## 7. Page states (every list/screen must have all four)

1. **Loading:** skeleton cards, not a blank page or bare "Loading…".
2. **Empty:** one friendly sentence for visitors; admin-only hints only when `isAdmin`.
3. **Error:** a short message near the action; never show raw database text to students (`teacherDeletion.ts` pattern).
4. **Content.**

Public copy never mentions internal tools ("Admin Studio"), missing integrations ("not available yet") or the database.

## 8. Languages and RTL

- Every user-facing string exists in **en, sv, fa, de**. Persian is right-to-left: use logical properties
  (`margin-inline-start`, `inset-inline`, `text-align: start`), never `left/right` for layout.
- Numbers: Western digits in code and data; Persian digit display is a presentation choice made per locale in text.
- Test every new screen at **320, 390, 768, 1366 px** in **en and fa**, light and dark.

## 9. Forbidden patterns

- `window.confirm`, `window.prompt`, `alert`.
- New hex colours, gradients, `!important` (existing ones are a frozen debt; the ratchet only allows them to shrink).
- A second definition of an existing selector; selectors not starting with `.academy` (leaks into the App).
- `position: fixed` inside an element with `backdrop-filter`/`transform`.
- Admin or developer wording on a public page.
- Importing the App's database from Academy code (`../db/db`, `../db/types`, …) — the Academy never opens Dexie. The one allowed import is the pure language list `../db/langs`.
- Touch targets under 44 px; colour-only status; removing the focus outline.

## 10. Checklist before you push UI work

1. `npm test` (includes `npm run check:ui`).
2. Run the real screens at 320 / 390 / 768 / 1366, en + fa, light + dark (see `docs/AUDIT_2026-11-25.md` §Method for the
   headless audit that measures overflow, console errors and tap-target size).
3. Update `CHANGELOG.md`, `docs/DEVELOPMENT_HANDOFF.md`, and (new pages) `docs/SITEMAP.md` + `docs/ROUTE_INDEX.md`.
4. Record any new standing decision in `docs/DECISIONS.md`.
