import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
const saves=[]
class Query{
 constructor(table){this.table=table;this.action='select'}
 select(){return this}limit(){return this}
 upsert(payload,options){this.action='upsert';saves.push({table:this.table,payload,options});return Promise.resolve({data:[payload],error:null})}
 then(resolve,reject){const data=this.table==='academy_seo_settings'?[{entity_type:'page',entity_id:'home',locale:'fa',title:'Existing title',description:'Existing description',target_keywords:['online'],image_url:null,updated_at:'2026-11-20T00:00:00Z'}]:[];return Promise.resolve({data,error:null}).then(resolve,reject)}
}
globalThis.__seoClient={from:table=>new Query(table)}
globalThis.window={location:{origin:'https://lingo3.com'}}
const out=path.resolve('node_modules/.cache/seo-manager-test.mjs');fs.mkdirSync(path.dirname(out),{recursive:true})
await build({entryPoints:['src/academy/AcademySeoManager.tsx'],outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'seo-transport',setup(b){
 b.onResolve({filter:/auth\/supabase$/},()=>({path:'transport',namespace:'qa'}))
 b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const authConfigured=true;export const supabase=()=>globalThis.__seoClient;'}))
}}]})
const {AcademySeoManager}=await import('file://'+out)
let tree
const flush=()=>act(async()=>new Promise(resolve=>setTimeout(resolve,20)))
const text=node=>typeof node==='string'?node:(node?.children??[]).map(text).join(' ')
const label=starts=>tree.root.findAllByType('label').find(node=>text(node).startsWith(starts))
try{
 await act(async()=>{tree=TestRenderer.create(React.createElement(AcademySeoManager,{locale:'fa',userId:'00000000-0000-4000-8000-000000000002',courses:[],teachers:[]}))});await flush()
 assert.equal(label('SEO Title').findByType('input').props.value,'Existing title')
 const selects=tree.root.findAllByType('select')
 assert.equal(selects.length,3,'Type, language and page selectors visible')
 await act(async()=>selects[0].props.onChange({target:{value:'app'}}));await flush()
 assert.equal(tree.root.findAllByType('select')[1].props.value,'en','English must be used on app homepage')
 await act(async()=>label('SEO Title').findByType('input').props.onChange({target:{value:'Lingo3 Swedish language practice'}}))
 await act(async()=>label('Meta Description').findByType('textarea').props.onChange({target:{value:'Custom metadata for language learning homepage and Lingo3 practice.'}}))
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));await flush()
 assert.equal(saves.length,1)
 assert.equal(saves[0].table,'academy_seo_settings')
 assert.equal(saves[0].payload.entity_type,'app')
 assert.equal(saves[0].payload.entity_id,'home')
 assert.equal(saves[0].payload.locale,'en')
 assert.equal(saves[0].payload.title,'Lingo3 Swedish language practice')
 assert.equal(saves[0].options.onConflict,'entity_type,entity_id,locale')
 assert(text(tree.toJSON()).includes('ذخیره شد'))
 console.log('PASS SEO admin: existing metadata load, app locale enforcement, editable title/description, persisted payload, success feedback.')
}finally{if(tree)await act(async()=>tree.unmount());fs.rmSync(out,{force:true})}
