import assert from 'node:assert/strict'
import {build} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import Renderer,{act} from 'react-test-renderer'
const file=path.resolve('node_modules/.cache/academy-roster-qa.mjs')
fs.mkdirSync(path.dirname(file),{recursive:true})
await build({entryPoints:['src/academy/AcademyUsers.tsx'],outfile:file,bundle:true,jsx:'automatic',platform:'node',format:'esm',external:['react'],plugins:[{name:'transport',setup(b){b.onResolve({filter:/auth\/supabase$/},()=>({path:'transport',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase=()=>globalThis.rosterClient'}))}}]})
const {AcademyUsers}=await import('file://'+file)
const calls=[],user={user_id:'student',display_name:'Student',email:'s@example.invalid',phone:'123',username:'learner',last_sign_in_at:null,is_admin:false,teacher_id:null,teacher_status:null}
let mode='normal',deferred,chosen,course,updated=0
const pause=()=>new Promise(r=>setTimeout(r,280))
globalThis.rosterClient={rpc:async(name,args)=>{calls.push({name,args});if(name==='academy_admin_set_admin')return {error:null};if(mode==='throw')throw new Error('Offline');if(args.p_query==='slow')return await new Promise(r=>deferred=r);return {data:{users:[user],total:26},error:null}}}
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('')
let tree
const click=async label=>{const b=tree.root.findAllByType('button').find(n=>text(n)===label);assert(b,label);await act(async()=>b.props.onClick())}
await act(async()=>{tree=Renderer.create(React.createElement(AcademyUsers,{locale:'en',onTeacher:u=>chosen=u.user_id,onCourses:u=>course=u,onAccessChanged:()=>updated++}));await pause()})
assert.equal(tree.root.findAllByType('article').length,1)
await click('Manage teacher profile');assert.equal(chosen,'student')
await click('User courses');assert.equal(course,'student')
await click('Grant admin access');assert(!calls.some(c=>c.name==='academy_admin_set_admin'))
await click('Confirm access change');assert.equal(updated,1);assert.deepEqual(calls.find(c=>c.name==='academy_admin_set_admin').args,{p_user_id:'student',p_enabled:true})
await act(async()=>{await pause()});await click('Next');await act(async()=>{await pause()});assert.equal(calls.at(-1).args.p_page,1)
const input=()=>tree.root.findByType('input')
await act(async()=>input().props.onChange({target:{value:'slow'}}));await act(async()=>{await pause()})
await act(async()=>input().props.onChange({target:{value:'learner'}}));await act(async()=>{await pause()})
await act(async()=>deferred({data:{users:[],total:0},error:null}));assert.equal(tree.root.findAllByType('article').length,1,'Stale search discarded');assert.equal(calls.at(-1).args.p_page,0)
mode='throw';await act(async()=>input().props.onChange({target:{value:'offline'}}));await act(async()=>{await pause()});assert.equal(tree.root.findAllByProps({role:'alert'}).length,1)
await act(async()=>tree.unmount());fs.unlinkSync(file)
console.log('PASS roster UI: user/course shortcuts, explicit role confirmation, pagination, stale searches and network errors (mock transport).')
