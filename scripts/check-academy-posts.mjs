import './lib/loose-source.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
const translations=[{post_id:'post',locale:'fa',title:'درس فارسی',body:'متن فارسی',description:'معرفی',status:'published',keywords:['گرامر'],video_url:null},{post_id:'post',locale:'en',title:'Private English',body:'PRIVATE_DRAFT',description:'',status:'draft',keywords:[],video_url:null}]
const post={id:'post',category:'grammar',original_locale:'fa',author_id:'teacher',academy_post_translations:translations},calls=[]
class Q{select(){return this}eq(){return this}order(){return this}limit(){return this}then(resolve,reject){return Promise.resolve({data:[post],error:null}).then(resolve,reject)}}
globalThis.__postClient={from:()=>new Q(),rpc:async(name,args)=>{calls.push({name,args});return {data:'post',error:null}}}
globalThis.window={location:{origin:'https://lingo3.com'},confirm:()=>true};globalThis.navigator??={};
const out=path.resolve('node_modules/.cache/post-test.mjs');fs.mkdirSync(path.dirname(out),{recursive:true})
await build({entryPoints:['src/academy/AcademyPosts.tsx'],outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'mock',setup(b){b.onResolve({filter:/auth\/supabase$/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase=()=>globalThis.__postClient'}))}}]})
const {AcademyPosts,AcademyPostStudio}=await import('file://'+out)
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join(' ')
const flush=()=>act(async()=>new Promise(r=>setTimeout(r,15)))
let tree
try{
 await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyPosts,{locale:'fa'}))});await flush();assert.match(text(tree.toJSON()),/درس فارسی/);assert.doesNotMatch(text(tree.toJSON()),/Private English/)
 await act(async()=>tree.update(React.createElement(AcademyPosts,{locale:'en'})));await flush();assert.doesNotMatch(text(tree.toJSON()),/درس فارسی|PRIVATE_DRAFT|Private English/)
 await act(async()=>tree.unmount());await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyPostStudio,{locale:'en',userId:'teacher',isAdmin:false,spaces:[{id:'space',student_display_name:'Learner'}]}))});await flush()
 const field=(label)=>tree.root.findAllByType('label').find(n=>text(n).startsWith(label))
 await act(async()=>field('Content language').findByType('select').props.onChange({target:{value:'sv'}}))
 await act(async()=>field('Title').findByType('input').props.onChange({target:{value:'Svensk artikel'}}))
 await act(async()=>field('Article text').findByType('textarea').props.onChange({target:{value:'Svensk text'}}))
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));await flush()
 assert.equal(calls[0].args.p_locale,'sv');assert.equal(calls[0].args.p_status,'draft');assert.equal(calls[0].args.p_title,'Svensk artikel')
 await act(async()=>field('Choose a student workspace').findByType('select').props.onChange({target:{value:'space'}}))
 await act(async()=>tree.root.findAllByType('button').find(b=>text(b)==='Share a saved copy with student').props.onClick());await flush()
 assert.equal(calls[1].name,'academy_share_post');assert.equal(calls[1].args.p_space,'space');assert.equal(calls[1].args.p_locale,'sv')
 console.log('PASS articles UI: strict public locale, no draft fallback, original language save and explicit student-sharing RPC.')
}finally{if(tree)await act(async()=>tree.unmount());fs.rmSync(out,{force:true})}
