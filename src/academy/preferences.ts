import { useEffect, useRef, useState } from 'react'
import { authConfigured, supabase } from '../auth/supabase'
export type UiLocale='en'|'sv'|'de'|'fa'
export type AcademyTheme='light'|'dark'
export const isUiLocale=(x:unknown):x is UiLocale=>['en','sv','de','fa'].includes(String(x))
export const countryLocale=(country:unknown):UiLocale=>({IR:'fa',DE:'de',SE:'sv'} as Record<string,UiLocale>)[String(country).toUpperCase()]??'en'
export function localizedName(teacher:{display_name:string;display_name_i18n?:Record<string,string>},locale:UiLocale){return teacher.display_name_i18n?.[locale]||(locale!=='fa'?teacher.display_name_i18n?.en:undefined)||teacher.display_name}
export function useAcademyPreferences(userId:string|null){
 const key='lingo3.ui.preference.'+(userId??'guest')
 const initial=():{locale:UiLocale;theme:AcademyTheme}=>{try{const p=JSON.parse(localStorage.getItem(key)??'null');return {locale:isUiLocale(p?.locale)?p.locale:'en' as UiLocale,theme:p?.theme==='dark'?'dark' as const:'light' as const}}catch{return {locale:'en' as UiLocale,theme:'light' as AcademyTheme}}}
 const [prefs,setPrefs]=useState(initial),[error,setError]=useState('')
 const epoch=useRef(0)
 useEffect(()=>{
  let alive=true;const version=epoch.current;const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),7000)
  async function load(){
   let saved: {locale:UiLocale;theme:AcademyTheme}|null=null
   if(userId&&authConfigured){const r=await supabase().from('academy_preferences').select('locale,theme').eq('user_id',userId).abortSignal(controller.signal).maybeSingle();if(r.error&&!controller.signal.aborted){if(alive)setError(r.error.message)}else saved=r.data}
   if(!saved){try{const local=JSON.parse(localStorage.getItem(key)??'null');if(isUiLocale(local?.locale))saved=local}catch{}}
   if(!saved){try{const r=await fetch('/api/locale',{signal:controller.signal});const data=await r.json();saved={locale:isUiLocale(data.locale)?data.locale:'en',theme:'light'}}catch{saved={locale:'en',theme:'light'}}}
   if(alive&&epoch.current===version){setPrefs(saved!);localStorage.setItem(key,JSON.stringify(saved));document.documentElement.lang=saved!.locale}
  }
  void load().catch(e=>{if(alive)setError(String(e))}).finally(()=>clearTimeout(timer))
  return()=>{alive=false;controller.abort();clearTimeout(timer)}
 },[userId,key])
 async function save(patch:Partial<{locale:UiLocale;theme:AcademyTheme}>){
  epoch.current++;const next={...prefs,...patch};setPrefs(next);setError('');localStorage.setItem(key,JSON.stringify(next));localStorage.setItem('lingo3.academy.locale',next.locale);document.documentElement.lang=next.locale
  if(userId&&authConfigured){const {error}=await supabase().from('academy_preferences').upsert({user_id:userId,...next,updated_at:new Date().toISOString()});if(error)setError(error.message)}
 }
 return {...prefs,error,setLocale:(locale:UiLocale)=>save({locale}),setTheme:(theme:AcademyTheme)=>save({theme})}
}
