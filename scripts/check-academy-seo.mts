import './lib/loose-source.mjs'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {renderPage,escapeHtml,authoredLocales} from '../api/academy-page.ts'
const html=renderPage('<html lang="en"><head><title>Old</title><meta name="description" content="Old"><meta property="og:title" content="Old"></head><body><div id="root"></div></body></html>',{title:'درس <script>',description:'"Quoted" & text',locale:'fa',url:'https://lingo3.com/academy/posts/a?lang=fa',content:'<article>Readable body</article>',alternates:[{locale:'fa',url:'https://lingo3.com/academy/posts/a?lang=fa'}],schema:{'@type':'Article',headline:'</script><script>alert(1)</script>'}})
assert.equal((html.match(/<title>/g)||[]).length,1)
assert.equal((html.match(/name="description"/g)||[]).length,1)
assert(html.includes('dir="rtl"'));assert(html.includes('Readable body'));assert(html.includes('hreflang="fa"'));assert(html.includes('rel="canonical"'))
assert(!html.includes('<script>alert'));assert(html.includes('\\u003c/script>'));assert.equal(escapeHtml('<a>"&'), '&lt;a&gt;&quot;&amp;')
console.log('PASS SEO: server-readable body, single metadata, canonical/hreflang, RTL and HTML/JSON-LD injection escaping.')

const handlerSource=readFileSync(new URL('../api/academy-page.ts',import.meta.url),'utf8')
assert(handlerSource.includes("'@type':'Course'"),'Published course details must expose Course structured data')
assert(handlerSource.includes("'@type':'Person'"),'Published teacher details must expose Person structured data')
console.log('PASS SEO: published course/teacher JSON-LD schema contracts.')

const baseShell='<html lang="en"><head><title>Default</title></head><body><div id="root"></div></body></html>'
const publicHtml=renderPage(baseShell,{title:'Swedish course',description:'Practical online lessons',locale:'en',url:'https://lingo3.com/academy/courses/example?lang=en',content:'<p>Course</p>',alternates:[],schema:{'@type':'Course',name:'Swedish course'}})
assert(publicHtml.includes('"@type":"Organization"'),'Organization structured data should exist')
assert(publicHtml.includes('"@type":"BreadcrumbList"'),'Public pages should have breadcrumbs')
assert(publicHtml.includes('"@type":"Course"'),'Course structured data should be emitted')
assert(publicHtml.includes('property="og:type" content="website"'),'Courses must not be mislabeled as articles')
assert(publicHtml.includes('name="twitter:description"'),'Social preview description should be emitted')
const hidden=renderPage(baseShell,{title:'Admin',description:'Private',locale:'en',url:'https://lingo3.com/academy/admin',content:'',alternates:[],noindex:true})
assert(hidden.includes('noindex, nofollow'),'Private routes must never be indexed')
assert(!hidden.includes('application/ld+json'),'Private routes must not expose structured data')
const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'))
assert(vercel.rewrites.some((r:{source:string;destination:string})=>r.source==='/'&&r.destination.includes('root=1')),'Homepage must be crawled through public metadata renderer')
assert(handlerSource.includes("rows('academy_seo_settings'"),'Published metadata overrides must be loaded server-side')
const migration=readFileSync(new URL('../supabase/migrations/20261121004000_academy_seo_settings.sql',import.meta.url),'utf8')
assert(migration.includes('enable row level security'),'SEO overrides must be protected by RLS')
assert(migration.includes('seo admin update')&&migration.includes('seo published public read'),'Require admin writes and published-only public visibility')
console.log('PASS SEO: home rewrite, multilingual overrides, public structured data, social previews, noindex and RLS contract.')

assert(vercel.routes?.some((r:{src:string;dest:string;override:boolean})=>r.src==='^/$'&&r.dest.includes('root=1')&&r.override===true),'Homepage must override static index filesystem precedence')
console.log('PASS SEO: root rewrite overrides filesystem with server-rendered metadata.')

assert.deepEqual(authoredLocales('courses',{title_i18n:{en:'Swedish A1',fa:'سوئدی A1'},description_i18n:{en:'Start learning',fa:'آموزش'}}),['en','fa'])
assert.deepEqual(authoredLocales('teachers',{intro_i18n:{en:'Teaching Swedish',fa:'آموزش',de:''}}),['en','fa'])
const editor=readFileSync(new URL('../src/academy/Academy.tsx',import.meta.url),'utf8')
assert(editor.includes('permanentlyDeleteTeacher')&&editor.includes("teacherForm.status==='archived'"),'Permanent deletion must remain archived-only')
assert(editor.includes('askText(')&&editor.includes(".delete().eq('id',item.id)"),'Exact-name confirmation and explicit ID filter required')
const deletionAudit=readFileSync(new URL('../supabase/migrations/20261121030000_academy_teacher_deletion_audit.sql',import.meta.url),'utf8')
assert(deletionAudit.includes('enable row level security')&&deletionAudit.includes('academy_teacher_delete_audit'),'Teacher deletion audit must be protected and automatic')
console.log('PASS SEO: authored-only locale indexing and safe teacher deletion audit contract.')
