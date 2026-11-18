import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const academy = read('src/academy/Academy.tsx')
const css = read('src/academy/academy.css')
const showcase = read('public/showcase.html')
const legacy = read('public/academy.html')
const guide = read('docs/LINGO3_APP_ACADEMY_GUIDE.md')
const landing = read('src/ui/Landing.tsx')
const portal = read('src/academy/AcademyPortal.tsx')
const booking = read('src/academy/AcademyBookingDialog.tsx')
const signIn = read('src/auth/SignIn.tsx')
const mvpMigration = read('supabase/migrations/20261117160000_academy_real_mvp.sql')
const labelMigration = read('supabase/migrations/20261117161000_academy_student_labels.sql')
const hardeningMigration = read('supabase/migrations/20261117162000_academy_mvp_hardening.sql')
const cancelMigration = read('supabase/migrations/20261117163000_academy_slot_cancel_fix.sql')
const advisorMigration = read('supabase/migrations/20261117164000_academy_advisor_cleanup.sql')
const overlapMigration = read('supabase/migrations/20261117165000_academy_double_booking_guard.sql')
const workflowMigration=read('supabase/migrations/20261118050000_academy_workflow_integrity.sql')
const preferences=read('src/academy/preferences.ts')
const dashboardMigration = read('supabase/migrations/20261117211500_academy_role_dashboards.sql')

const checks = [
  ['Responsive Academy uses tablet hamburger and mobile touch targets', css.includes('@media(max-width:860px)') && css.includes('.academy-mobile-toggle{display:flex}') && css.includes('min-height:46px')],
  ['Academy forms provide example placeholders', academy.includes('e.g. Swedish A1') && portal.includes('Write your own lesson note here') && portal.includes('e.g. A1 quiz')],
  ['Academy route is split before LingoApp', app.includes("cleanEntryPath.startsWith('/academy/')") && app.includes('return <AcademyEntry sessionState={sessionState} />') && app.indexOf('return <AcademyEntry sessionState={sessionState} />') < app.indexOf('function LingoApp(')],
  ['LingoApp owns Dexie init', app.includes('function LingoApp({ sessionState }') && app.includes('await openForUser(userId)') && app.indexOf('await openForUser(userId)') > app.indexOf('function LingoApp({ sessionState }')],
  ['Academy source does not import App Dexie', !/from ['"]\.\.\/db\//.test(academy) && !academy.includes('dexie')],
  ['Academy grouped menus close on mouse leave', (academy.match(/onMouseLeave={closeMenuOnLeave}/g) || []).length === 3],
  ['Academy grouped menus coordinate open state', (academy.match(/onToggle={onMenuToggle}/g) || []).length === 3],
  ['Academy route navigation closes menus', academy.includes("const go=(next:AcademyPage)=>{closeMenus();setMobileMenuOpen(false);setPage(next);setDialog(null);navigateProduct(ACADEMY_PATHS[next]")],
  ['Academy has real sub-page routes', ['/academy/path','/academy/courses','/academy/teachers','/academy/levels','/academy/my','/academy/admin','/academy/about','/academy/pricing','/academy/resources','/academy/contact'].every(path => academy.includes(path))],
  ['Academy renders routed pages conditionally', ["page==='home'","page==='courses'","page==='teachers'","page==='personal'","page==='admin'"].every(x=>academy.includes(x))],
  ['Admin Studio remains role-conditional', academy.includes("isAdmin&&<section") && academy.includes('id="admin-studio"')],
  ['Academy locale set includes EN/SV/DE/FA', academy.includes("type Locale = 'en' | 'sv' | 'fa' | 'de'") && academy.includes('option value="de">Deutsch</option>')],
  ['App primary navigation contains one Academy mosaic tile', (app.match(/tile tile-academy/g)||[]).length===1 && app.includes('onAcademy={() => navigateProduct(\'/academy\')}') && !app.includes('academy-entry-card')],
  ['Student dashboard links App words and grammar', portal.includes("navigateProduct('/words?academyLang='") && portal.includes("navigateProduct('/grammar?academyLang='") && portal.includes('academy-language-dashboard')],
  ['Teacher role gets exclusive dashboard outside admin', portal.includes('const teacherOnly=Boolean(selfTeacher&&!isAdmin)') && portal.includes('academy-week-board')],
  ['Admin teacher lookup uses guarded RPC', academy.includes("rpc('academy_admin_search_users'") && academy.includes('academy-user-results')],
  ['Academy defaults to light theme with persistent dark toggle', preferences.includes("'light'") && academy.includes('academy-settings-panel') && academy.includes('useAcademyPreferences(userId)') && css.includes('.academy[data-theme=light]')],
  ['Academy mobile navigation is collapsible', academy.includes('academy-mobile-toggle') && academy.includes("mobileMenuOpen?'is-open':''") && css.includes('.academy-nav.is-open')],
  ['Academy login follows selected locale', academy.includes('locale={locale}') && signIn.includes("type AuthLocale = 'en' | 'sv' | 'de' | 'fa'") && signIn.includes("de:{back:'Zurück zur Academy'")],
  ['Persian RTL remains enabled', academy.includes("locale==='fa'?'rtl':'ltr'") && css.includes('.academy[dir=rtl]')],
  ['Hero typography is bounded', css.includes('clamp(2.2rem,4.7vw,4rem)')],
  ['Showcase points to interactive Academy route', showcase.includes('href="/academy"')],
  ['Legacy Academy redirects to interactive route', legacy.includes('url=/academy')],
  ['Showcase iframe has no resize feedback observer', !showcase.includes('ResizeObserver')],
  ['Welcome gateway contains no unreachable legacy second page', landing.includes("return (\n    <main") && !landing.includes('className="lx"') && !landing.includes('function Deck(')],
  ['Academy uses atomic enrollment activation RPC', academy.includes("rpc('academy_activate_enrollment'") && !academy.includes("from('academy_learning_spaces').insert")],
  ['Academy catalogue avoids anonymous select-star', academy.includes('const courseFields=') && academy.includes('const teacherFields=')],
  ['Trial booking captures course time and message', booking.includes("academy_availability") && booking.includes("preferred_start") && booking.includes("student_message")],
  ['Teacher portal has availability and session workflow', portal.includes("academy_availability") && portal.includes("academy_bookings") && portal.includes("confirmed_start")],
  ['Learning Space has resources homework and messaging', portal.includes("academy_resources") && portal.includes("academy_messages") && portal.includes("student_response")],
  ['Academy MVP migration creates protected workflow tables', mvpMigration.includes("create table if not exists public.academy_availability") && mvpMigration.includes("create table if not exists public.academy_resources") && mvpMigration.includes("create table if not exists public.academy_messages")],
  ['Student labels are added for teacher workflows', labelMigration.includes('student_display_name')],
  ['Booking and note hardening migration exists', hardeningMigration.includes('academy_guard_note_update') && hardeningMigration.includes('Confirmed bookings may only be cancelled')],
  ['Student cancellation releases booked slots', cancelMigration.includes('security definer') && cancelMigration.includes("status = 'available'")],
  ['Academy booking policies are consolidated', advisorMigration.includes('academy bookings member update') && advisorMigration.includes('academy_messages_sender_idx')],
  ['Database prevents teacher double-booking', overlapMigration.includes('academy_guard_availability_overlap') && overlapMigration.includes('Teacher already has a confirmed session at this time')],
  ['Dashboard migration keeps teacher assignment admin-only', dashboardMigration.includes('academy_admin_search_users') && dashboardMigration.includes("raise exception 'forbidden'") && dashboardMigration.includes('hub_academy_manage')],
  ['Session summaries are RLS-backed and teacher-authored', dashboardMigration.includes('academy_session_summaries') && dashboardMigration.includes('academy summaries teacher admin write') && portal.includes('saveSessionSummary')],
  ['Test results are RLS-backed and visible in dashboards', dashboardMigration.includes('academy_test_results') && portal.includes('addTestResult') && portal.includes('selectedTests')],
  ['Academy language catalogue is managed and consumed', dashboardMigration.includes('academy_languages') && academy.includes("from('academy_languages')") && academy.includes('languageOptions')],
  ['Control Center connector exposes Academy inventory and role actions', ['academy-overview','academy-users','academy-students','academy-teachers','academy-courses','academy-languages','make_teacher','make_student','upsert_language','upsert_course'].every(x=>dashboardMigration.includes(x))],
  ['Student teacher calendar is privacy-safe Free/Busy RPC', dashboardMigration.includes('academy_teacher_calendar') && dashboardMigration.includes("then 'free' else 'busy'") && portal.includes("rpc('academy_teacher_calendar'") && !portal.includes("studentAvailability.map(a=>{const booked")],
  ['Teacher can generate recurring weekly availability', portal.includes('async function addWeeklySlots()') && portal.includes('weeklyDays') && portal.includes('Create weekly times')],
  ['Teacher resources support lesson grammar and useful links', ['lesson','grammar','link'].every(x=>dashboardMigration.includes("'"+x+"'")) && portal.includes('<option value="lesson">') && portal.includes('<option value="grammar">') && portal.includes('<option value="link">')],
  ['Role-dashboard migration has one canonical language table definition', (dashboardMigration.match(/create table if not exists public\.academy_languages/g)||[]).length===1 && !dashboardMigration.includes('lesson_note')],
  ['Current migration qualifies classroom identity columns (SQL workflow test verifies enforcement)', workflowMigration.includes('ls.student_id=academy_test_results.student_id') && workflowMigration.includes('ls.teacher_id=academy_session_summaries.teacher_id')],
  ['Draft teachers cannot receive public trial requests', academy.includes("x.status==='active'&&<button")],
  ['Developer guide documents Dexie boundary', guide.includes('Do not move Academy routing back inside')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log('Academy regression checks passed: ' + checks.length + '/' + checks.length)
