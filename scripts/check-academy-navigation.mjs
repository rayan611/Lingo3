import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
const pause=n=>new Promise(r=>setTimeout(r,n)),listeners=new Map(),local=new Map(),calls=[]
let stack=[],index=0,role='guest'
const location={origin:'https://qa.invalid',pathname:'/academy',search:'',href:'https://qa.invalid/academy'}
function apply(entry){const u=new URL(entry.url,location.origin);Object.assign(location,{pathname:u.pathname,search:u.search,href:u.href});history.state=entry.state}
function emit(e){for(const f of listeners.get(e.type)??[])f(e)}
const history={state:{},pushState(state,_,url){stack.splice(index+1);stack.push({state,url});index=stack.length-1;apply(stack[index])},replaceState(state,_,url){stack[index]={state,url};apply(stack[index])},back(){if(index>0){apply(stack[--index]);emit({type:'popstate'})}},forward(){if(index<stack.length-1){apply(stack[++index]);emit({type:'popstate'})}}}
function reset(url='/academy'){stack=[{state:{},url}];index=0;apply(stack[0])}
globalThis.window={location,history,addEventListener(t,f){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(f)},removeEventListener(t,f){listeners.get(t)?.delete(f)},dispatchEvent:emit,confirm:()=>true,setInterval,clearInterval}
globalThis.location=location;globalThis.PopStateEvent=class{constructor(type,options){this.type=type;Object.assign(this,options)}}
globalThis.addEventListener=window.addEventListener;globalThis.removeEventListener=window.removeEventListener;globalThis.scrollY=0;globalThis.scrollTo=()=>{}
globalThis.document={documentElement:{lang:'en'}};globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)}
globalThis.fetch=async()=>({json:async()=>({locale:'en'})})
const course={id:'course',subject_code:'sv',level_code:'A1',title_i18n:{en:'Swedish A1'},description_i18n:{en:'Learn Swedish'},topics_i18n:{en:['Greetings']},delivery_modes:['individual_online'],price_sek:300,duration_minutes:60,telegram_url:'https://t.me/example',status:'active',sort_order:0}
const teacher={id:'teacher',user_id:'teacher-user',display_name:'Teacher A',intro_i18n:{en:'Swedish teacher'},teaching_languages:['sv'],spoken_languages:['en'],levels:['A1'],specialties:[],email:'teacher@example.invalid',phone:'+460000000',teams_chat_url:'https://teams.microsoft.com/chat',teams_call_url:'https://teams.microsoft.com/call',telegram_url:'https://t.me/example',status:'active'}
class Query{
 constructor(table){this.table=table;this.action='select'}select(){return this}eq(){return this}gt(){return this}order(){return this}limit(){return this}abortSignal(){return this}maybeSingle(){return this}insert(payload){this.action='insert';this.payload=payload;return this}update(payload){this.action='update';this.payload=payload;return this}
 then(resolve,reject){calls.push({table:this.table,action:this.action,payload:this.payload});const data={academy_courses:[course],academy_teachers:[teacher],academy_teacher_courses:[{teacher_id:'teacher',course_id:'course'}],academy_languages:[{code:'sv',name_i18n:{en:'Swedish'},status:'active',sort_order:0}],user_settings:{display_name:'QA',is_admin:role==='admin'},academy_preferences:null,academy_enrollments:[],academy_availability:[]}[this.table]??[];return Promise.resolve({data,error:null}).then(resolve,reject)}
}
globalThis.__navClient={from:t=>new Query(t),rpc:async(name,payload)=>{calls.push({rpc:name,payload});return {data:[],error:null}},auth:{signOut:async()=>{calls.push({auth:'out'});return {error:null}}}}
globalThis.__navAuth=async(name,...args)=>{calls.push({auth:name,args});return name==='google'?Promise.reject(Error('Simulated OAuth failure')):{needsConfirmation:true}}
const file=path.resolve('node_modules/.cache/nav-qa.mjs');fs.mkdirSync(path.dirname(file),{recursive:true})
await build({entryPoints:['src/academy/Academy.tsx'],outfile:file,bundle:true,jsx:'automatic',platform:'node',format:'esm',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'nav-transport',setup(b){
 b.onResolve({filter:/auth\/supabase$/},()=>({path:'transport',namespace:'qa'}))
 b.onResolve({filter:/useSession$/},()=>({path:'auth',namespace:'qa'}))
 b.onResolve({filter:/Captcha$/},()=>({path:'captcha',namespace:'qa'}))
 b.onResolve({filter:/AcademyPortal$/},()=>({path:'portal',namespace:'qa'}))
 b.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:a.path==='transport'?'export const authConfigured=true;export const supabase=()=>globalThis.__navClient;':a.path==='auth'?"export const consumeAuthLinkError=()=>null;export const signIn=(...a)=>globalThis.__navAuth('in',...a);export const signUp=(...a)=>globalThis.__navAuth('up',...a);export const requestPasswordReset=(...a)=>globalThis.__navAuth('reset',...a);export const signInWithGoogle=(...a)=>globalThis.__navAuth('google',...a);":a.path==='captcha'?'export const captchaEnabled=false;export const Captcha=()=>null;':"export const AcademyPortal=()=>null;"}))
}}]})
const {Academy}=await import('file://'+file)
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join(' ').replace(/\s+/g,' ').trim()
let tree,checks=0
const flush=()=>act(async()=>pause(10))
const find=(label)=>tree.root.findAllByType('button').find(n=>(text(n)===label||n.props['aria-label']===label))
const click=async(label)=>{const b=find(label);assert(b,'Button exists: '+label);await act(async()=>b.props.onClick());await flush();checks++}
const page=()=>tree.root.find(n=>n.props.className==='academy').props['data-page']
async function mount(nextRole,url='/academy'){role=nextRole;reset(url);await act(async()=>{tree=TestRenderer.create(React.createElement(Academy,{userId:role==='guest'?null:role==='teacher'?'teacher-user':'student-user',email:role+'@example.invalid'}),{createNodeMock:()=>({querySelectorAll:()=>[]})})});await flush()}
async function unmount(){await act(async()=>tree.unmount())}
const routes=[['Home','home','/academy'],['Find your learning path','path','/academy/path'],['Courses','courses','/academy/courses'],['Teachers','teachers','/academy/teachers'],['Personal space','personal','/academy/my'],['How it works','about','/academy/about'],['Pricing','pricing','/academy/pricing'],['Resources','resources','/academy/resources'],['Contact','contact','/academy/contact']]
try{
 for(const r of ['guest','student','teacher','admin']){
  await mount(r)
  for(const [label,expected,url] of routes){await click(label);assert.equal(page(),expected);assert.equal(location.pathname,url);await act(async()=>history.back());await act(async()=>history.forward());assert.equal(page(),expected);checks+=3
   for(const link of tree.root.findAllByType('a')){assert.match(link.props.href,/^(https:\/\/|mailto:|tel:|\/)/);if(link.props.target==='_blank')assert.match(link.props.rel,/noreferrer/)}
  }
  if(r==='admin'){await click('Admin Studio');assert.equal(page(),'admin');assert.equal(tree.root.findAllByType('form').length,2)}else{assert(!find('Admin Studio'))}
  await click('Settings ⚙');assert(tree.root.findAll(n=>n.props['aria-label']==='Academy settings').length)
  await act(async()=>emit({type:'keydown',key:'Escape'}));assert.equal(tree.root.findAll(n=>n.props['aria-label']==='Academy settings').length,0)
  await act(async()=>history.forward());await click('Close settings');assert.equal(history.state.academySettings,undefined)
  await click('Teachers');await click('Request trial');assert.equal(history.state.academyDialog.type,'booking')
  await act(async()=>history.back());assert.equal(tree.root.findAllByType('form').length,0)
  await act(async()=>history.forward());const booking=tree.root.findByType('form')
  if(r==='guest'){await act(async()=>booking.props.onSubmit({preventDefault(){}}));assert(!calls.some(c=>c.table==='academy_bookings'&&c.action==='insert'))}
  else{await act(async()=>tree.root.findByProps({type:'datetime-local'}).props.onChange({target:{value:'2099-01-02T15:30'}}));await act(async()=>booking.props.onSubmit({preventDefault(){}}));assert(calls.some(c=>c.table==='academy_bookings'&&c.payload?.course_id==='course'));assert.equal(page(),'personal');assert(!history.state.academyDialog)}
  await act(async()=>{if(history.state.academyDialog)history.back()})
  if(r==='guest'){
   await click('Log in');assert.equal(history.state.academyDialog.type,'login');await act(async()=>history.back());assert.equal(tree.root.findAllByType('form').length,0);await act(async()=>history.forward())
   await act(async()=>tree.root.findByProps({type:'email'}).props.onChange({target:{value:' qa@example.invalid '}}));await act(async()=>tree.root.findByProps({type:'password'}).props.onChange({target:{value:'password-test'}}));await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert(calls.some(c=>c.auth==='in'&&c.args[0]==='qa@example.invalid'));await click('Forgot your password?');await act(async()=>tree.root.findByProps({type:'email'}).props.onChange({target:{value:' qa@example.invalid '}}));await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert(calls.some(c=>c.auth==='reset'&&c.args[0]==='qa@example.invalid'))
   await click('Back to sign in');await click('No account yet? Create one');await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert(calls.some(c=>c.auth==='up'));await click('Continue with Google');assert(calls.some(c=>c.auth==='google'&&c.args[0]==='/academy'));await click('Back to Academy');assert(!history.state.academyDialog)
  }else{await click('Log out');assert(calls.some(c=>c.auth==='out'))}
  await click('Lingo3 App');assert.equal(location.pathname,'/');assert(history.state.lingo3DirectApp);assert(!history.state.academyDialog&&!history.state.academySettings);await unmount()
 }
 for(const [,expected,url]of routes){await mount('guest',url);assert.equal(page(),expected);await unmount();checks++}
 await mount('guest','/academy/levels');assert.equal(page(),'courses');assert(!find('Levels'));await unmount();
 await mount('student','/academy/admin');assert(!find('Save course'));await click('Personal space');assert.equal(page(),'personal');await unmount()
 await mount('guest','/academy/posts?lang=fa');await click('مدرس‌ها');assert.equal(location.search,'?lang=fa');assert(find('دوره‌ها'));await act(async()=>history.back());assert.equal(location.search,'?lang=fa');await click('اپ Lingo3');assert.equal(location.search,'');await unmount();checks+=3
 const css=postcss.parse(fs.readFileSync('src/academy/academy.css','utf8'));css.walkRules(r=>r.selectors.forEach(s=>assert(s.trim().startsWith('.academy'),'Academy CSS must not leak into App: '+s)))
 console.log(`PASS: ${checks} route/navigation assertions; 4 roles, direct URLs, Back/Forward, Settings/Escape, login modes/OAuth error, booking guest/submit, signout, external link formats and scoped CSS. Transport/auth are mocked; no real account or message created.`)
}finally{if(tree)await act(async()=>tree.unmount());fs.rmSync(file,{force:true})}
