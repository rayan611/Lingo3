import './lib/loose-source.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
const courseId='11111111-1111-4111-8111-111111111111',teacherId='22222222-2222-4222-8222-222222222222',postId='33333333-3333-4333-8333-333333333333'
const course={id:courseId,status:'active',title_i18n:{en:'Swedish A1',fa:'سوئدی A1',sv:'Svenska A1',de:''},description_i18n:{en:'Learn Swedish',fa:'آموزش سوئدی',sv:'Lär dig svenska',de:''},topics_i18n:{en:['Greetings'],fa:['سلام'],sv:['Hälsningar']}}
const teacher={id:teacherId,status:'active',display_name:'Teacher X',display_name_i18n:{en:'Teacher X'},intro_i18n:{en:'Teaching Swedish',fa:'آموزش سوئدی',sv:'',de:''},photo_url:null}
const translation={post_id:postId,locale:'fa',title:'مقاله فارسی',description:'توضیح مقاله',body:'متن مقاله',keywords:['آموزش'],status:'published',published_at:'2026-11-20T00:00:00Z',updated_at:'2026-11-20T00:00:00Z'}
const metadata=[{entity_type:'page',entity_id:'home',locale:'fa',title:'آکادمی سوئدی آنلاین',description:'دوره‌های خصوصی و گروهی برای یادگیری زبان',image_url:null,target_keywords:['سوئدی']},{entity_type:'course',entity_id:courseId,locale:'en',title:'Online Swedish A1 | Lingo3 Academy',description:'Qualified Swedish teachers and practical online A1 lessons.',image_url:null,target_keywords:['Swedish']}]
process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_ANON_KEY='public-test-key'
globalThis.fetch=async raw=>{
 const u=new URL(raw)
 if(u.pathname.endsWith('/academy_seo_settings')){
  return {ok:true,json:async()=>metadata.filter(x=>!u.searchParams.has('entity_type')||('eq.'+x.entity_type)===u.searchParams.get('entity_type')).filter(x=>!u.searchParams.has('entity_id')||('eq.'+x.entity_id)===u.searchParams.get('entity_id')).filter(x=>!u.searchParams.has('locale')||('eq.'+x.locale)===u.searchParams.get('locale'))}
 }
 if(u.pathname.endsWith('/academy_courses'))return {ok:true,json:async()=>u.searchParams.has('id')&&u.searchParams.get('id')!=='eq.'+courseId?[]:[course]}
 if(u.pathname.endsWith('/academy_teachers'))return {ok:true,json:async()=>u.searchParams.has('id')&&u.searchParams.get('id')!=='eq.'+teacherId?[]:[teacher]}
 if(u.pathname.endsWith('/academy_post_translations'))return {ok:true,json:async()=>u.searchParams.has('locale')&&u.searchParams.get('locale')!=='eq.fa'?[]:[translation]}
 throw Error('Unexpected fetch '+raw)
}
const shell='<html lang="en"><head><title>Old</title></head><body><div id="root"></div></body></html>'
const output=path.resolve('node_modules/.cache/seo-api-handler-test.mjs');fs.mkdirSync(path.dirname(output),{recursive:true})
await build({entryPoints:['api/academy-page.ts'],outfile:output,bundle:true,platform:'node',format:'esm',plugins:[{name:'shell',setup(build){
 build.onResolve({filter:/^node:fs\/promises$/},()=>({path:'mockfs',namespace:'mock'}))
 build.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const readFile=async()=>'+JSON.stringify(shell)}))
}}]})
const {default:handler}=await import('file://'+output)
async function request(query){const result={status:0,headers:{},body:''};await handler({method:'GET',query},{setHeader(k,v){result.headers[k]=v},status(code){result.status=code;return {send(body){result.body=body}}}});return result}
try{
 const landing=await request({route:'',lang:'fa'})
 assert.equal(landing.status,200)
 assert(landing.body.includes('<title>آکادمی سوئدی آنلاین</title>'))
 assert(landing.body.includes('name="description" content="دوره‌های خصوصی و گروهی'))
 assert(landing.body.includes('rel="canonical" href="https://lingo3.com/academy?lang=fa"'))
 const courseEn=await request({route:'courses/'+courseId,lang:'en'})
 assert.equal(courseEn.status,200)
 assert(courseEn.body.includes('Online Swedish A1 | Lingo3 Academy'))
 assert(courseEn.body.includes('"@type":"Course"'))
 assert(!courseEn.body.includes('hreflang="de"'))
 const courseDe=await request({route:'courses/'+courseId,lang:'de'})
 assert.equal(courseDe.status,200)
 assert(courseDe.body.includes('noindex, nofollow'))
 const teacherDe=await request({route:'teachers/'+teacherId,lang:'de'})
 assert(teacherDe.body.includes('noindex, nofollow'))
 const activeTeacher=await request({route:'teachers/'+teacherId,lang:'fa'})
 assert(!activeTeacher.body.includes('noindex, nofollow'))
 const missing=await request({route:'teachers/00000000-0000-4000-8000-000000000000',lang:'en'})
 assert.equal(missing.status,404)
 assert(missing.body.includes('noindex, nofollow'))
 const sitemap=await request({sitemap:'1'})
 assert.equal(sitemap.status,200)
 assert(sitemap.body.includes('/academy/courses/'+courseId+'?lang=fa'))
 assert(!sitemap.body.includes('/academy/courses/'+courseId+'?lang=de'))
 assert(!sitemap.body.includes('/academy/teachers/'+teacherId+'?lang=de'))
 assert(sitemap.body.includes('/academy/posts/'+postId+'?lang=fa'))
 assert(!sitemap.body.includes('/academy/admin'))
 const app=await request({root:'1'})
 assert.equal(app.status,200)
 assert(app.body.includes('rel="canonical" href="https://lingo3.com/"'))
 console.log('PASS SEO server: saved admin metadata, published multilingual canonical/hreflang, missing locale noindex, sitemap, drafts and private exclusions.')
}finally{fs.rmSync(output,{force:true})}
