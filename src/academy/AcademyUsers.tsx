import {AcademyField} from './AcademyField'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../auth/supabase'

type User = { user_id:string; display_name:string; email:string; is_admin:boolean; teacher_id:string|null; teacher_status:string|null;phone:string;username:string;last_sign_in_at:string|null }
type Locale = 'en'|'fa'|'sv'|'de'
const labels = {
 en: {title:'Users and access', search:'Search name, email, phone or username', all:'All users',admin:'Administrator',teacher:'Teacher',student:'Student',previous:'Previous',next:'Next',grant:'Grant admin access',revoke:'Remove admin access',confirm:'Confirm access change',cancel:'Cancel',profile:'Manage teacher profile',error:'Unable to load users',empty:'No users found'},
 fa: {title:'کاربران و دسترسی‌ها',search:'جستجوی نام، ایمیل، شماره یا نام کاربری',all:'همهٔ کاربران',admin:'ادمین',teacher:'استاد',student:'دانشجو',previous:'قبلی',next:'بعدی',grant:'دادن دسترسی ادمین',revoke:'گرفتن دسترسی ادمین',confirm:'تأیید تغییر دسترسی',cancel:'انصراف',profile:'مدیریت پروفایل استاد',error:'دریافت کاربران انجام نشد',empty:'کاربری پیدا نشد'},
 sv: {title:'Användare och behörigheter',search:'Sök namn, e-post eller konto-ID',all:'Alla användare',admin:'Administratör',teacher:'Lärare',student:'Elev',previous:'Föregående',next:'Nästa',grant:'Ge administratörsbehörighet',revoke:'Ta bort administratörsbehörighet',confirm:'Bekräfta ändring',cancel:'Avbryt',profile:'Hantera lärarprofil',error:'Kunde inte hämta användare',empty:'Inga användare hittades'},
 de: {title:'Benutzer und Berechtigungen',search:'Name, E-Mail oder Konto-ID suchen',all:'Alle Benutzer',admin:'Administrator',teacher:'Lehrkraft',student:'Lernende',previous:'Zurück',next:'Weiter',grant:'Administratorzugriff erteilen',revoke:'Administratorzugriff entziehen',confirm:'Änderung bestätigen',cancel:'Abbrechen',profile:'Lehrerprofil verwalten',error:'Benutzer konnten nicht geladen werden',empty:'Keine Benutzer gefunden'}
}
export function AcademyUsers({locale,onTeacher,onAccessChanged,onCourses}:{locale:Locale;onTeacher:(user:User)=>void;onAccessChanged:()=>void;onCourses:(userId:string)=>void}) {
 const t=labels[locale]
 const [query,setQuery]=useState(''),[role,setRole]=useState(''),[page,setPage]=useState(0)
 const [users,setUsers]=useState<User[]>([]),[total,setTotal]=useState(0),[error,setError]=useState('')
 const [pending,setPending]=useState<User|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 const generation=useRef(0)
 useEffect(()=>{
  const id=++generation.current
  setLoading(true);setError('');setUsers([])
  const timer=setTimeout(async()=>{
   try {
   const result=await supabase().rpc('academy_admin_users',{p_query:query.trim(),p_role:role,p_page:page})
   if(id!==generation.current)return
   setLoading(false)
   if(result.error){setError(t.error+' — '+result.error.message);return}
   setUsers(result.data.users);setTotal(result.data.total)
   } catch(e){if(id===generation.current){setLoading(false);setError(t.error)}}
  },250)
  return ()=>{clearTimeout(timer);generation.current++}
 },[query,role,page,revision,t.error])
 async function changeAccess(){
  if(!pending||busy)return
  setBusy(true);setError('')
  try {
   const {error}=await supabase().rpc('academy_admin_set_admin',{p_user_id:pending.user_id,p_enabled:!pending.is_admin})
   if(error)throw error
   setPending(null);setRevision(v=>v+1);onAccessChanged()
  } catch(error){setError(error instanceof Error?error.message:String(error))}
  finally{setBusy(false)}
 }
 return <section className="academy-card academy-users" aria-busy={loading||busy}>
  <h3>{t.title}</h3>
  <div className="editor-two"><AcademyField locale={locale}><label>{t.search}<input placeholder={t.search} value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/></label></AcademyField>
  <AcademyField locale={locale}><label>{t.all}<select value={role} onChange={e=>{setRole(e.target.value);setPage(0)}}><option value="">{t.all}</option><option value="admin">{t.admin}</option><option value="teacher">{t.teacher}</option><option value="student">{t.student}</option></select></label></AcademyField></div>
  {error&&<p role="alert">{error}</p>}
  {!loading&&!error&&users.length===0&&<p>{t.empty}</p>}
  {users.map(user=><article className="academy-card" key={user.user_id}>
   <strong>{user.display_name||user.email}</strong><p dir="ltr">{user.email}</p>
   <p dir="ltr">{user.phone} {user.username}</p><small>{locale==='fa'?'آخرین ورود':'Last sign-in'} {user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString(locale):'—'}</small><br/><small>{user.is_admin?t.admin:''} {user.teacher_status==='active'?t.teacher:''}</small>
   <div className="academy-card-actions"><button onClick={()=>onCourses(user.user_id)}>{locale==='fa'?'دوره‌های کاربر':'User courses'}</button><button disabled={busy} onClick={()=>onTeacher(user)}>{t.profile}</button><button disabled={busy} onClick={()=>setPending(user)}>{user.is_admin?t.revoke:t.grant}</button></div>
  </article>)}
  {pending&&<div className="academy-card" role="group" aria-label={t.confirm}><p>{pending.display_name||pending.email} — {pending.is_admin?t.revoke:t.grant}</p><div className="academy-card-actions"><button disabled={busy} onClick={changeAccess}>{t.confirm}</button><button disabled={busy} onClick={()=>setPending(null)}>{t.cancel}</button></div></div>}
  <div className="academy-card-actions"><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>{t.previous}</button><span>{page+1} / {Math.max(1,Math.ceil(total/25))}</span><button disabled={(page+1)*25>=total||loading} onClick={()=>setPage(p=>p+1)}>{t.next}</button></div>
 </section>
}
