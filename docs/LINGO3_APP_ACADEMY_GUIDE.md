# Lingo3 App vs Lingo3 Academy — Developer Guide

Reviewed: 2026-11-17  
Primary router: `src/App.tsx`

## Product boundary

Lingo3 contains two related products that share the same Supabase identity but have different runtime responsibilities.

### 1. Lingo3 App

Purpose: self-study vocabulary, grammar, review, reading and translation.

Main code:
- `src/App.tsx` → `LingoApp` and `Workspace`
- `src/ui/AddWord.tsx`
- `src/ui/Training.tsx`
- `src/ui/Review.tsx`
- `src/ui/Browse.tsx`
- `src/ui/GrammarManager.tsx`
- `src/ui/StoryMode.tsx`
- `src/ui/Translate.tsx`
- `src/ui/SettingsPanel.tsx`
- `src/db/` → Dexie/local vocabulary data
- `src/sync/` → App sync

The App owns Dexie. Do not initialize/open the App Dexie store from Academy.

### 2. Lingo3 Academy

Purpose: human-led learning with courses, teachers, trial requests and private Learning Spaces.

Main code:
- `src/academy/Academy.tsx` → Academy public UI, personal space and admin studio
- `src/academy/academy.css` → Academy-only styling
- `supabase/migrations/*academy*` → Academy database/RLS
- `public/academy.html` → compatibility redirect only; interactive Academy is `/academy`

Academy uses the shared Supabase Auth session, but it must remain independent of App Dexie/sync initialization.

## Route ownership

Public/shared:
- `/` → Welcome gateway, then App
- `/showcase.html` → public showcase
- `/academy` → interactive Academy
- `/academy.html` → compatibility redirect to `/academy`
- `/privacy` → privacy page

App workspace:
- `/` Add a word after Welcome/App entry
- `/training-center`
- `/words`
- `/grammar`
- `/read`
- `/review`
- `/recall`
- `/translate`
- `/settings`

## Important routing rule

`App()` in `src/App.tsx` decides whether the request is Academy or App **before mounting `LingoApp`**.

Do not move Academy routing back inside `LingoApp`. If `LingoApp` mounts on `/academy`, its Dexie initialization can run even though Academy does not use Dexie. Repeated App ↔ Academy navigation can then wait on IndexedDB locks/upgrades.

## Academy section map

Inside `src/academy/Academy.tsx`:
- `#academy-home` → hero
- `#learning-path` → Find your learning path
- `#courses` → DB-backed course catalogue + topics/formats
- `#teachers` → verified teacher directory + contact links
- `#levels` → level guide
- `#how` → how Academy works
- `#pricing` → pricing summary
- `#personal-space` → student courses / teacher courses / Learning Space
- `#admin-studio` → admin-only course/teacher/enrolment management
- `#resources` → learning resources explanation
- `#contact` → Academy contact

Top navigation groups:
- Learn → Learning Path / Courses / Teachers / Levels
- My Academy → Personal Space / Admin Studio / Lingo3 App / Logout
- About → How it works / Pricing / Resources / Contact

Menus are native `<details>` controls with Academy-managed closing behavior:
- opening one closes the others
- choosing an item closes the menu
- moving the mouse outside closes it

## Authentication and roles

Shared auth: `src/auth/useSession.ts`, `src/auth/SignIn.tsx`.

Academy admin permission currently comes from:
`public.user_settings.is_admin`

Teacher identity is linked through:
`academy_teachers.user_id -> auth.users.id`

Do not invent teacher records. Only publish verified real teachers.

## Academy data ownership

Public/readable catalogue:
- `academy_courses`
- `academy_teachers`
- `academy_teacher_courses`

Private/member data:
- `academy_enrollments`
- `academy_bookings`
- `academy_learning_spaces`
- `academy_notes`

RLS is mandatory for every Academy private table. Student A must never be able to read Student B's private Learning Space.

## Current external-integration boundary

Fields/links exist for Teams and Telegram, but these are not automatic provider integrations.

Not currently claimed active:
- automatic Microsoft Teams meeting creation
- Google/Microsoft calendar synchronization
- Stripe/Swish payment processing
- hosted live video classroom
- file/homework upload engine
- test/placement engine
- realtime collaborative notebook

## Development checklist for Academy changes

1. Keep Academy route isolated from App Dexie.
2. Verify `/`, `/showcase.html`, `/academy`, `/academy.html`.
3. Test repeated Welcome → Academy → App/Welcome → Academy navigation.
4. Test all three top menu groups and mouse-leave closing.
5. Test EN/SV/FA and Persian RTL.
6. Verify public course/teacher reads.
7. For authenticated changes, test Student/Teacher/Admin visibility separately.
8. For DB/RLS changes, verify cross-user isolation.
9. Run `npm run check:academy`, `npm run typecheck`, and production build.
10. Update `docs/SITEMAP.md`, `docs/ROUTE_INDEX.md`, and `docs/DEVELOPMENT_HANDOFF.md`.
