import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
import {renderToStaticMarkup} from 'react-dom/server'

// Real React components and effects; only the database transport is replaced.
// SQL role policies are tested separately in check-academy-workflow.sql.
const storage=new Map()
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))}
globalThis.window={localStorage,location:{pathname:'/academy/my',search:'',origin:'https://qa.invalid'},setInterval,clearInterval,setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},confirm:()=>true,history:{state:{},pushState(){},replaceState(){}},dispatchEvent(){}}
globalThis.location=window.location
globalThis.document={documentElement:{lang:'en'}}
globalThis.fetch=async()=>({json:async()=>({locale:'en'})})
const tables={
 academy_enrollments:[],
 academy_learning_spaces:[{id:'space-a',student_id:'student-a',teacher_id:'teacher-a',course_id:'course-a',student_display_name:'Student A',progress:20,goal:'A1',next_session_topics:['Shopping']},{id:'space-b',student_id:'student-b',teacher_id:'teacher-a',course_id:'course-a',student_display_name:'Student B',progress:5,goal:null,next_session_topics:[]}],
 academy_bookings:[{id:'cancelled',teacher_id:'teacher-a',student_id:'student-a',student_display_name:'Cancelled student',course_id:'course-a',availability_id:'slot-a',status:'cancelled_student',meeting_url:'https://zoom.us/j/999'},{id:'confirmed',teacher_id:'teacher-a',student_id:'student-a',course_id:'course-a',status:'confirmed',meeting_url:'https://zoom.us/j/123',meeting_backup_url:'https://teams.microsoft.com/l/meetup-join/example'}],academy_availability:[{id:'slot-a',teacher_id:'teacher-a',starts_at:'2027-01-05T18:00:00Z',ends_at:'2027-01-05T19:00:00Z',status:'available'}],academy_session_summaries:[{id:'summary-a',learning_space_id:'space-a',teacher_id:'teacher-a',student_id:'student-a',booking_id:null,covered:'Existing coverage',strengths:'Preserve strengths',created_at:'2026-11-18T09:00:00Z'}],academy_test_results:[],
 academy_notes:[{id:'note-a',learning_space_id:'space-a',author_id:'student-a',body:'Shared student note',visibility:'shared',created_at:'2026-11-18T09:00:00Z'}],
 academy_resources:[{id:'hw-a',learning_space_id:'space-a',teacher_id:'teacher-a',kind:'homework',title:'Lesson 1 homework',student_status:'submitted',student_response:'Student homework answer',description:'Write a sentence',url:null,due_at:null}],
 academy_messages:Array.from({length:225},(_,i)=>({id:'m'+i,learning_space_id:'space-a',sender_id:'student-a',recipient_id:'teacher-user',body:'Message '+(i+1),created_at:new Date(2026,10,18,0,i).toISOString(),read_at:'2026-11-18T10:00:00Z'}))
}
const writes=[]
class Query{
 constructor(table){this.table=table;this.filters=[];this.sort=null;this.start=0;this.end=Infinity;this.action='select'}
 select(){return this} eq(k,v){this.filters.push(r=>r[k]===v);return this} in(k,v){this.filters.push(r=>v.includes(r[k]));return this} gte(){return this} maybeSingle(){return Promise.resolve({data:null,error:null})}
 order(k,o={}){this.sort=[k,o.ascending!==false];return this} limit(n){this.end=n-1;return this} range(a,b){this.start=a;this.end=b;return this}
 insert(p){this.action='insert';this.payload=p;return this} update(p){this.action='update';this.payload=p;return this} delete(){this.action='delete';return this}
 then(resolve,reject){return Promise.resolve().then(()=>{
 let rows=(tables[this.table]??[]).filter(r=>this.filters.every(f=>f(r)))
 if(this.action!=='select'){writes.push({table:this.table,action:this.action,payload:this.payload,ids:rows.map(r=>r.id)});if(this.action==='update')rows.forEach(r=>Object.assign(r,this.payload));if(this.action==='insert'){for(const r of [this.payload].flat())(tables[this.table]??=[]).push({...r,id:'new-'+writes.length,created_at:new Date().toISOString()})}}
 if(this.sort){const [k,asc]=this.sort;rows=[...rows].sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(asc?1:-1))}
 return {data:rows.slice(this.start,this.end+1),error:null}
 }).then(resolve,reject)}
}
globalThis.__academyQAClient={from:t=>new Query(t),rpc:()=>Promise.resolve({data:[],error:null})}
const output=path.resolve('node_modules/.cache/academy-behavior.mjs');fs.mkdirSync(path.dirname(output),{recursive:true})
await build({stdin:{contents:"export {AcademyPortal} from './src/academy/AcademyPortal';export {Landing} from './src/ui/Landing';export {countryLocale,localizedName,useAcademyPreferences} from './src/academy/preferences'",resolveDir:process.cwd(),loader:'tsx'},outfile:output,bundle:true,jsx:'automatic',platform:'node',format:'esm',external:['react','react/jsx-runtime'],plugins:[{name:'qa-transport',setup(b){b.onResolve({filter:/auth\/supabase$/},()=>({path:'qa-client',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const authConfigured=false;export const supabase=()=>globalThis.__academyQAClient;',loader:'js'}))}}]})
const {AcademyPortal,Landing,countryLocale,localizedName}=await import('file://'+output+'?'+Date.now())
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join(' ')
const find=(root,type,label)=>root.findAllByType(type).find(n=>text(n).includes(label))
const flush=async()=>{await act(async()=>{await new Promise(r=>setTimeout(r,15))})}
const notices=[]
const base={locale:'en',courses:[{id:'course-a',subject_code:'sv',level_code:'A1',title_i18n:{en:'Swedish A1'}}],teachers:[{id:'teacher-a',user_id:'teacher-user',display_name:'Teacher A'}],teacherCourseIds:['course-a'],isAdmin:false,onNotice:m=>notices.push(m)}
let tree
try{
 await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyPortal,{...base,userId:'teacher-user',selfTeacher:base.teachers[0]}))});await flush();await flush()
 assert.match(text(tree.toJSON()),/Shared student note/);assert.match(text(tree.toJSON()),/Student homework answer/);assert.match(text(tree.toJSON()),/Message 225/);assert.doesNotMatch(text(tree.toJSON()),/Message 1\s/)
 assert(find(tree.root,'h3','Messages'),'teacher messaging panel visible')
 const weekBoard=tree.root.findAll(n=>n.props.className==='academy-week-board')[0];assert.match(text(weekBoard),/Free/);assert.doesNotMatch(text(weekBoard),/Cancelled student/)
 const summaryPanel=tree.root.findAllByType('article').find(n=>text(n).includes('Session summary & grammar'));assert(summaryPanel)
 await act(async()=>find(summaryPanel,'button','Edit').props.onClick())
 const coverage=summaryPanel.findAllByType('textarea').find(n=>n.props.placeholder==='e.g. Everyday verbs and word order')
 await act(async()=>coverage.props.onChange({target:{value:'Updated coverage'}}))
 await act(async()=>find(summaryPanel,'button','Save progress & plan').props.onClick());await flush()
 assert(writes.some(w=>w.table==='academy_session_summaries'&&w.action==='update'&&w.payload.strengths==='Preserve strengths'&&w.payload.booking_id===null))
 const feedback=tree.root.findAllByType('textarea').find(n=>n.props.placeholder==='Teacher feedback');assert(feedback,'inline feedback editor visible')
 await act(async()=>feedback.props.onChange({target:{value:'Useful feedback'}}))
 await act(async()=>find(tree.root,'button','Mark completed').props.onClick());await flush()
 assert(writes.some(w=>w.table==='academy_resources'&&w.payload?.teacher_feedback==='Useful feedback'&&w.payload.student_status==='completed'))
 await act(async()=>find(tree.root,'button','Older').props.onClick());await flush()
 const messageBox=tree.root.findAllByType('textarea').find(n=>n.props.placeholder==='Write a message to the other classroom member…')
 await act(async()=>messageBox.props.onChange({target:{value:'New teacher message'}}))
 const messagesPanel=tree.root.findAllByType('article').find(n=>n.findAllByType('h3').some(h=>text(h)==='Messages'))
 await act(async()=>find(messagesPanel,'button','Send').props.onClick());await flush();await flush()
 assert(writes.some(w=>w.table==='academy_messages'&&w.payload?.recipient_id==='student-a'&&w.payload?.body==='New teacher message'))
 assert.match(text(tree.toJSON()),/New teacher message/);assert.match(text(tree.toJSON()),/Message 225/)
 assert(find(tree.root,'button','Newer').props.disabled,'writing from older history returns to newest page')
 const msg=tree.root.findAllByType('textarea').find(n=>n.props.placeholder==='Write a message to the other classroom member…')
 await act(async()=>msg.props.onChange({target:{value:'Unsent for A'}}))
 const selector=tree.root.findAllByType('select').find(n=>n.findAllByType('option').some(o=>o.props.value==='space-b'))
 await act(async()=>selector.props.onChange({target:{value:'space-b'}}));await flush()
 assert.equal(tree.root.findAllByType('textarea').find(n=>n.props.placeholder==='Write a message to the other classroom member…').props.value,'')
 assert.doesNotMatch(text(tree.toJSON()),/Shared student note/)
 await act(async()=>tree.unmount())
 await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyPortal,{...base,userId:'student-a',selfTeacher:undefined}))});await flush();await flush()
 const joinLinks=tree.root.findAllByType('a')
 assert(joinLinks.some(link=>link.props.href==='https://zoom.us/j/123'&&text(link).includes('Join lesson')))
 assert(joinLinks.some(link=>link.props.href.includes('meetup-join')&&text(link).includes('Backup link')))
 assert(!joinLinks.some(link=>link.props.href==='https://zoom.us/j/999'))
 assert.match(text(tree.toJSON()),/Useful feedback/);assert.match(text(tree.toJSON()),/Shopping/);assert(!find(tree.root,'h3','Teacher workspace'))
 await act(async()=>tree.unmount())
 await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyPortal,{...base,userId:'admin',selfTeacher:undefined,isAdmin:true,initialSpaceId:'space-b'}))});await flush();await flush()
 assert.match(text(tree.toJSON()),/Classroom management/);assert(tree.root.findAllByType('option').some(o=>o.props.value==='space-a'));assert(tree.root.findAllByType('option').some(o=>o.props.value==='space-b'))
 await act(async()=>tree.unmount())
 await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyPortal,{...base,userId:'student-a',isAdmin:true,view:'student'}))});await flush();await flush()
 assert.match(text(tree.toJSON()),/Your learning overview/)
 assert(!find(tree.root,'h3','Classroom management'))
 assert(!tree.root.findAllByType('option').some(o=>o.props.value==='space-b'))
 assert.equal(countryLocale('IR'),'fa');assert.equal(countryLocale('DE'),'de');assert.equal(countryLocale('SE'),'sv');assert.equal(countryLocale(null),'en')
 assert.equal(localizedName({display_name:'Original',display_name_i18n:{en:'Latin',fa:'فارسی'}},'de'),'Latin')
 assert.equal(localizedName({display_name:'Original',display_name_i18n:{en:'Latin',fa:'فارسی'}},'fa'),'فارسی')
 const home=renderToStaticMarkup(React.createElement(Landing,{onOpen(){}}));assert(!home.includes('<iframe'));assert.equal((home.match(/<article/g)??[]).length,2)
 console.log('PASS: real React teacher/student/admin panels, submitted homework and feedback, latest >200 messages, class-switch draft/data isolation, admin class selection, country fallback, localized names and compact homepage.')
}finally{if(tree)await act(async()=>tree.unmount());fs.rmSync(output,{force:true})}
