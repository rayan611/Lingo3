import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
const local=new Map(),accounts=new Map([['user-a',{locale:'fa',theme:'dark'}],['user-b',{locale:'en',theme:'light'}]])
globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)}
globalThis.document={documentElement:{lang:'en'}}
let geo='en',delay=0,writeDelay=0
const pause=n=>new Promise(r=>setTimeout(r,n))
globalThis.fetch=async()=>({json:async()=>({locale:geo})})
globalThis.__preferencesQA={from:()=>({select(){return this},eq(_,v){this.uid=v;return this},abortSignal(){return this},async maybeSingle(){const data=accounts.get(this.uid);await pause(delay);return {data:data?{...data}:null,error:null}},async upsert(row){await pause(writeDelay);accounts.set(row.user_id,{locale:row.locale,theme:row.theme});return {error:null}}})}
const file=path.resolve('node_modules/.cache/preferences-qa.mjs');fs.mkdirSync(path.dirname(file),{recursive:true})
await build({entryPoints:['src/academy/preferences.ts'],outfile:file,bundle:true,platform:'node',format:'esm',external:['react'],plugins:[{name:'prefs-transport',setup(b){b.onResolve({filter:/auth\/supabase$/},()=>({path:'prefs',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const authConfigured=true;export const supabase=()=>globalThis.__preferencesQA;'}))}}]})
const {useAcademyPreferences,countryLocale}=await import('file://'+file)
let state,tree
function Probe({userId}){state=useAcademyPreferences(userId);return React.createElement('div',null,state.locale+' '+state.theme)}
async function mount(userId){await act(async()=>{tree=TestRenderer.create(React.createElement(Probe,{userId}));await pause(35)})}
async function stop(){await act(async()=>tree.unmount())}
try{
 local.set('lingo3.ui.preference.guest',JSON.stringify({locale:'de',theme:'light'}));await mount('user-a');assert.equal(state.locale,'fa');assert.equal(state.theme,'dark')
 await act(async()=>{await state.setLocale('de')});assert.equal(accounts.get('user-a').locale,'de');await stop()
 local.clear();await mount('user-a');assert.equal(state.locale,'de','same account restores preference on a fresh device');await stop()
 local.clear();await mount('user-b');assert.equal(state.locale,'en','other account does not inherit preference');await stop()
 for(const [country,expected]of [['IR','fa'],['DE','de'],['SE','sv'],['unknown','en']]){local.clear();geo=countryLocale(country);await mount(null);assert.equal(state.locale,expected);await act(async()=>state.setLocale('en'));assert.equal(state.locale,'en');await stop()}
 local.clear();delay=50;await act(async()=>{tree=TestRenderer.create(React.createElement(Probe,{userId:'user-a'}))});await act(async()=>state.setLocale('sv'));await act(async()=>pause(65));assert.equal(state.locale,'sv','late account fetch cannot undo a manual choice');await stop()
 local.clear();delay=0;await mount('user-a');delay=50
 await act(async()=>{tree.update(React.createElement(Probe,{userId:'user-b'}))})
 assert.equal(state.locale,'en','same mounted hook must not expose the previous account while loading')
 await act(async()=>state.setLocale('fa'));assert.equal(accounts.get('user-b').theme,'light','early change on B must not copy A dark theme');await act(async()=>pause(65));await stop()
 local.clear();delay=0;await mount('user-b');writeDelay=25
 await act(async()=>{await Promise.all([state.setLocale('sv'),state.setTheme('dark')])})
 assert.deepEqual(accounts.get('user-b'),{locale:'sv',theme:'dark'},'rapid locale/theme saves preserve both final choices');writeDelay=0;await stop()
 local.clear();const storage=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('Storage disabled')},setItem(){throw Error('Storage disabled')}}
 await mount('user-b');await act(async()=>state.setLocale('de'));assert.equal(accounts.get('user-b').locale,'de','blocked local storage must not prevent account persistence');await stop();globalThis.localStorage=storage
 console.log('PASS: account preference overrides guest/geo, save and fresh-device restore, cross-account isolation, IR/DE/SE/unknown fallback, manual override, stale-fetch guard, mounted-account switch, rapid saves and blocked browser storage.')
}finally{fs.rmSync(file,{force:true})}
