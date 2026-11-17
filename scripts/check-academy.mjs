import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const academy = read('src/academy/Academy.tsx')
const css = read('src/academy/academy.css')
const showcase = read('public/showcase.html')
const legacy = read('public/academy.html')
const guide = read('docs/LINGO3_APP_ACADEMY_GUIDE.md')
const landing = read('src/ui/Landing.tsx')

const checks = [
  ['Academy route is split before LingoApp', app.includes('return <AcademyEntry />') && app.indexOf('return <AcademyEntry />') < app.indexOf('function LingoApp()')],
  ['LingoApp owns Dexie init', app.includes('function LingoApp()') && app.includes('await openForUser(userId)')],
  ['Academy source does not import App Dexie', !/from ['"]\.\.\/db\//.test(academy) && !academy.includes('dexie')],
  ['Academy grouped menus close on mouse leave', (academy.match(/onMouseLeave={closeMenuOnLeave}/g) || []).length === 3],
  ['Academy grouped menus coordinate open state', (academy.match(/onToggle={onMenuToggle}/g) || []).length === 3],
  ['Academy section navigation closes menus', academy.includes("const go=(id:string)=>{closeMenus();jump(id)}")],
  ['Academy has required public sections', ['academy-home','learning-path','courses','teachers','levels','how','pricing','personal-space','resources','contact'].every(id => academy.includes('id="' + id + '"'))],
  ['Admin Studio remains role-conditional', academy.includes("isAdmin&&<section") && academy.includes('id="admin-studio"')],
  ['Academy locale set includes EN/SV/FA', academy.includes("type Locale = 'en' | 'sv' | 'fa'")],
  ['Persian RTL remains enabled', academy.includes("locale==='fa'?'rtl':'ltr'") && css.includes('.academy[dir=rtl]')],
  ['Hero typography is bounded', css.includes('clamp(2.2rem,4.7vw,4rem)')],
  ['Showcase points to interactive Academy route', showcase.includes('href="/academy"')],
  ['Legacy Academy redirects to interactive route', legacy.includes('url=/academy')],
  ['Showcase iframe has no resize feedback observer', !showcase.includes('ResizeObserver')],
  ['Welcome gateway contains no unreachable legacy second page', (landing.match(/return \(/g) || []).length === 1],
  ['Developer guide documents Dexie boundary', guide.includes('Do not move Academy routing back inside')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log('Academy regression checks passed: ' + checks.length + '/' + checks.length)
