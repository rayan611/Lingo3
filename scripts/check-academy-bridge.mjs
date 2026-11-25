import './lib/loose-source.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
const pause=n=>new Promise(r=>setTimeout(r,n))
globalThis.location={search:''}
const writes=[]
let pendingRelease
const rows={sv:[{id:'sv-item',conceptId:'concept',headword:'hej',meaning:'hello'}],de:[{id:'de-item',conceptId:'concept',headword:'hallo',meaning:'hello'}]}
globalThis.__bridgeDatabase={
 name:'account-user',
 concepts:{filter(){return {primaryKeys:async()=>['concept']}}},
 entries:{where(){return {equals(lang){return {async toArray(){
  if(lang==='de')await new Promise(r=>{pendingRelease=r})
  return rows[lang]??[]
 }}}}}}
}
globalThis.__bridgeTransport={from(table){return {
 select(){return this},eq(){return this},order(){return this},
 insert(payload){writes.push(payload);return Promise.resolve({error:null})},
 then(resolve,reject){return Promise.resolve({data:table==='academy_learning_spaces'?[{id:'space',teacher_id:'teacher',course_id:'course'}]:[{id:'course',title_i18n:{en:'Course'}}],error:null}).then(resolve,reject)}
}}}
const file=path.resolve('node_modules/.cache/bridge-qa.mjs');fs.mkdirSync(path.dirname(file),{recursive:true})
await build({entryPoints:['src/ui/AcademyBridge.tsx'],outfile:file,bundle:true,jsx:'automatic',platform:'node',format:'esm',external:['react','react/jsx-runtime'],plugins:[{name:'bridge-transport',setup(b){
 b.onResolve({filter:/db\/db$/},()=>({path:'db',namespace:'qa'}));b.onResolve({filter:/db\/grammar$/},()=>({path:'grammar',namespace:'qa'}));b.onResolve({filter:/auth\/supabase$/},()=>({path:'transport',namespace:'qa'}))
 b.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:a.path==='db'?"export const db=globalThis.__bridgeDatabase;export const dbNameFor=id=>'account-'+id;":a.path==='grammar'?"export const addGrammarSection=()=>{};export const addGrammarRule=()=>{};export const updateGrammarRule=()=>{};":"export const supabase=()=>globalThis.__bridgeTransport;"}))
}}]})
const {AcademyBridge}=await import('file://'+file)
let tree
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join(' ')
const button=label=>tree.root.findAllByType('button').find(n=>text(n).includes(label))
const flush=async()=>act(async()=>pause(10))
try{
 await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyBridge,{userId:'user',kind:'words',languages:['sv','de']}))})
 await act(async()=>button('Share selected').props.onClick());await flush()
 let word=tree.root.findAllByType('input').find(n=>n.props.type==='checkbox');assert(word,'loaded vocabulary appears')
 await act(async()=>word.props.onChange({target:{checked:true}}))
 let preview=tree.root.findByType('textarea');assert.match(preview.props.value,/hej/)
 const confirm=tree.root.findAllByType('input').filter(n=>n.props.type==='checkbox').at(-1)
 await act(async()=>confirm.props.onChange({target:{checked:true}}))
 await act(async()=>tree.root.findAllByType('select')[0].props.onChange({target:{value:'de'}}))
 assert.equal(tree.root.findByType('textarea').props.value,'','changing language immediately clears the old snapshot')
 assert.equal(tree.root.findByType('fieldset').props.disabled,true,'sharing is locked during replacement loading')
 // Even a captured click callback cannot send a previous-language snapshot.
 await act(async()=>button('Share preview').props.onClick());assert.equal(writes.length,0)
 await act(async()=>pendingRelease());await flush()
 assert.match(text(tree.toJSON()),/hallo/);assert.doesNotMatch(text(tree.toJSON()),/hej/)
 assert.equal(tree.root.findByType('fieldset').props.disabled,false)
 console.log('PASS: selected App vocabulary preview, immediate language-switch reset, loading lock and no stale sharing.')
}finally{if(tree)await act(async()=>tree.unmount());fs.rmSync(file,{force:true})}
