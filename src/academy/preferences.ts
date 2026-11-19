import { useEffect, useRef, useState } from 'react'
import { authConfigured, supabase } from '../auth/supabase'
export type UiLocale='en'|'sv'|'de'|'fa'
export type AcademyTheme='light'|'dark'
type Preferences={locale:UiLocale;theme:AcademyTheme}
export const isUiLocale=(x:unknown):x is UiLocale=>['en','sv','de','fa'].includes(String(x))
export const countryLocale=(country:unknown):UiLocale=>({IR:'fa',DE:'de',SE:'sv'} as Record<string,UiLocale>)[String(country).toUpperCase()]??'en'
export function localizedName(teacher:{display_name:string;display_name_i18n?:Record<string,string>},locale:UiLocale){return teacher.display_name_i18n?.[locale]||(locale!=='fa'?teacher.display_name_i18n?.en:undefined)||teacher.display_name}
function localPreferences(key:string):Preferences|null{
 try{const p=JSON.parse(localStorage.getItem(key)??'null');return isUiLocale(p?.locale)?{locale:p.locale,theme:p.theme==='dark'?'dark':'light'}:null}catch{return null}
}
function cachePreferences(key:string,prefs:Preferences){try{localStorage.setItem(key,JSON.stringify(prefs))}catch{/* Account persistence must still work when browser storage is unavailable. */}}
export function useAcademyPreferences(userId:string|null){
 const key='lingo3.ui.preference.'+(userId??'guest')
 const [snapshot,setSnapshot]=useState(()=>({key,prefs:localPreferences(key)??{locale:'en' as UiLocale,theme:'light' as AcademyTheme}})),[error,setError]=useState('')
 // Never expose the previous account's settings while this account is loading.
 const prefs=snapshot.key===key?snapshot.prefs:localPreferences(key)??{locale:'en' as UiLocale,theme:'light' as AcademyTheme}
 const current=useRef({key,prefs});current.current={key,prefs}
 const epoch=useRef(0),saveQueue=useRef<Promise<void>>(Promise.resolve())
 useEffect(()=>{
  let alive=true;const version=epoch.current;const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),7000);setError('')
  async function load(){
   let saved:Preferences|null=null
   if(userId&&authConfigured){const r=await supabase().from('academy_preferences').select('locale,theme').eq('user_id',userId).abortSignal(controller.signal).maybeSingle();if(r.error&&!controller.signal.aborted){if(alive)setError(r.error.message)}else if(isUiLocale(r.data?.locale))saved={locale:r.data.locale,theme:r.data.theme==='dark'?'dark':'light'}}
   if(!saved)saved=localPreferences(key)
   if(!saved){try{const r=await fetch('/api/locale',{signal:controller.signal});const data=await r.json();saved={locale:isUiLocale(data.locale)?data.locale:'en',theme:'light'}}catch{saved={locale:'en',theme:'light'}}}
   if(alive&&epoch.current===version){setSnapshot({key,prefs:saved});current.current={key,prefs:saved};cachePreferences(key,saved);document.documentElement.lang=saved.locale}
  }
  void load().catch(e=>{if(alive)setError(String(e))}).finally(()=>clearTimeout(timer))
  return()=>{alive=false;controller.abort();clearTimeout(timer)}
 },[userId,key])
 async function save(patch:Partial<Preferences>){
  const version=++epoch.current;const next={...current.current.prefs,...patch};current.current={key,prefs:next};setSnapshot({key,prefs:next});setError('');cachePreferences(key,next);document.documentElement.lang=next.locale
  if(userId&&authConfigured){
   const write=async()=>{try{const {error}=await supabase().from('academy_preferences').upsert({user_id:userId,...next,updated_at:new Date().toISOString()});if(error&&current.current.key===key&&epoch.current===version)setError(error.message)}catch(e){if(current.current.key===key&&epoch.current===version)setError(String(e))}}
   // Preserve the final manual choice when two saves would otherwise race.
   saveQueue.current=saveQueue.current.then(write,write);await saveQueue.current
  }
 }
 return {...prefs,error,setLocale:(locale:UiLocale)=>save({locale}),setTheme:(theme:AcademyTheme)=>save({theme})}
}
