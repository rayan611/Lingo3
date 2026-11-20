import {academyStatus} from './statusLabels'
import {AcademyField} from './AcademyField'
import {AcademyHelp} from './AcademyHelp'
import {AcademySchedule} from './AcademySchedule'
import {workspaceLabel} from './workspaceLabels'
import {AcademyPostStudio} from './AcademyPosts'
import {AcademyClasses} from './AcademyClasses'
import {meetingLinkPair,meetingProvider,type MeetingProvider} from './meetingLinks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../auth/supabase'
import {localizedName} from './preferences'
import { AcademyTimeOff } from './AcademyScheduling'
import { AcademyDemoStudent } from './AcademyDemoStudent'
import { AcademyTeacherDesk } from './AcademyTeacherDesk'
import { navigateProduct } from '../lib/productNavigation'

type Locale = 'en' | 'sv' | 'fa' | 'de'
type Course = { id:string; subject_code:string; level_code:string; title_i18n:Record<string,string> }
type Teacher = { id:string; user_id:string|null; display_name:string; display_name_i18n?:Record<string,string>; email?:string|null; phone?:string|null; teams_chat_url?:string|null; teams_call_url?:string|null; telegram_url?:string|null }
type Enrollment = { id:string; student_id:string; course_id:string; teacher_id:string|null; status:string }
type Space = {
  id:string
  enrollment_id:string|null
  student_id:string
  student_display_name:string|null
  resolved_name?:string
  awaiting_review?:number
  is_demo?:boolean
  teacher_id:string|null
  course_id:string
  goal:string|null
  current_level:string|null
  target_level:string|null
  progress:number
  next_session_topics:string[]
}
type Booking = {
  id:string
  student_id:string
  student_display_name:string|null
  resolved_name?:string
  awaiting_review?:number
  is_demo?:boolean
  teacher_id:string
  course_id:string|null
  availability_id:string|null
  session_type:string
  preferred_start:string|null
  confirmed_start:string|null
  duration_minutes:number|null
  status:string
  meeting_url:string|null
  meeting_backup_url?:string|null
  student_message:string|null
  teacher_note:string|null
}
type Availability = {
  id:string
  teacher_id:string
  starts_at:string
  ends_at:string
  delivery_mode:string
  status:string
  note:string|null
}
type Resource = {
  id:string
  learning_space_id:string
  teacher_id:string
  kind:'material'|'homework'|'lesson'|'grammar'|'link'
  title:string
  description:string|null
  url:string|null
  due_at:string|null
  student_status:'assigned'|'submitted'|'completed'
  student_response:string|null
  teacher_feedback:string|null
}
type Note = {
  id:string
  learning_space_id:string
  author_id:string
  body:string
  visibility:'private'|'shared'
  created_at:string
}
type TestResult = { id:string; learning_space_id:string; title:string; score:number|null; max_score:number|null; percent:number|null; teacher_summary:string|null; taken_at:string }
type SessionSummary = { id:string; learning_space_id:string; booking_id:string|null; teacher_id:string; student_id:string; covered:string|null; grammar_focus:string|null; strengths:string|null; improve_next:string|null; next_focus:string|null; created_at:string }
type Message = {
  id:string
  learning_space_id:string
  sender_id:string
  recipient_id:string
  body:string
  read_at:string|null
  created_at:string
}

const copy = {
 en:{
  myCourses:'Courses you learn',teacherCourses:'Courses you teach',bookings:'Bookings & sessions',noBookings:'No booking requests yet.',preferred:'Requested',confirmed:'Confirmed',cancel:'Cancel',meeting:'Join meeting',learning:'Learning Space',noSpace:'Your Learning Space appears after enrollment is activated.',goal:'Learning goal',saveGoal:'Save goal',notes:'Notes',share:'Share with teacher',saveNote:'Save note',materials:'Materials & homework',noResources:'No materials or homework yet.',response:'Your response',submit:'Submit homework',feedback:'Teacher feedback',messages:'Messages',send:'Send',teacherDesk:'Teacher workspace',availability:'Availability',addSlot:'Add available time',start:'Start',duration:'Duration',mode:'Mode',online:'Online',offline:'Offline',students:'Students',progress:'Progress',nextTopics:'Next session topics',savePlan:'Save progress & plan',addResource:'Add material / homework',kind:'Type',material:'Material',homework:'Homework',title:'Title',description:'Description',url:'Link',due:'Due date',publish:'Publish',sessionRequests:'Session requests',confirm:'Confirm',complete:'Complete',noShow:'No-show',teacherNote:'Teacher note',meetingLink:'Meeting link',when:'Date & time',status:'Status',student:'Student',refresh:'Refresh',saved:'Saved.',sent:'Sent.',removeSlot:'Remove',markComplete:'Mark completed',submitted:'Submitted',assigned:'Assigned',completed:'Completed'
 },
 de:{
  myCourses:'Kurse, die du lernst',teacherCourses:'Kurse, die du unterrichtest',bookings:'Buchungen & Sitzungen',noBookings:'Noch keine Buchungsanfragen.',preferred:'Angefragt',confirmed:'Bestätigt',cancel:'Stornieren',meeting:'Meeting öffnen',learning:'Learning Space',noSpace:'Dein Learning Space erscheint nach Aktivierung der Einschreibung.',goal:'Lernziel',saveGoal:'Ziel speichern',notes:'Notizen',share:'Mit Lehrkraft teilen',saveNote:'Notiz speichern',materials:'Materialien & Hausaufgaben',noResources:'Noch keine Materialien oder Hausaufgaben.',response:'Deine Antwort',submit:'Hausaufgabe abgeben',feedback:'Feedback der Lehrkraft',messages:'Nachrichten',send:'Senden',teacherDesk:'Lehrkraft-Bereich',availability:'Verfügbarkeit',addSlot:'Verfügbare Zeit hinzufügen',start:'Start',duration:'Dauer',mode:'Format',online:'Online',offline:'Vor Ort',students:'Lernende',progress:'Fortschritt',nextTopics:'Themen der nächsten Sitzung',savePlan:'Fortschritt & Plan speichern',addResource:'Material / Hausaufgabe hinzufügen',kind:'Typ',material:'Material',homework:'Hausaufgabe',title:'Titel',description:'Beschreibung',url:'Link',due:'Fällig am',publish:'Veröffentlichen',sessionRequests:'Sitzungsanfragen',confirm:'Bestätigen',complete:'Abschließen',noShow:'Nicht erschienen',teacherNote:'Notiz der Lehrkraft',meetingLink:'Meeting-Link',when:'Datum & Uhrzeit',status:'Status',student:'Lernende Person',refresh:'Aktualisieren',saved:'Gespeichert.',sent:'Gesendet.',removeSlot:'Entfernen',markComplete:'Als abgeschlossen markieren',submitted:'Abgegeben',assigned:'Zugewiesen',completed:'Abgeschlossen'
 },
 sv:{
  myCourses:'Kurser du läser',teacherCourses:'Kurser du undervisar',bookings:'Bokningar & lektioner',noBookings:'Inga bokningsförfrågningar ännu.',preferred:'Önskad',confirmed:'Bekräftad',cancel:'Avboka',meeting:'Öppna möte',learning:'Learning Space',noSpace:'Din Learning Space visas när registreringen aktiveras.',goal:'Studiemål',saveGoal:'Spara mål',notes:'Anteckningar',share:'Dela med lärare',saveNote:'Spara anteckning',materials:'Material & läxor',noResources:'Inget material eller läxa ännu.',response:'Ditt svar',submit:'Skicka läxa',feedback:'Lärarfeedback',messages:'Meddelanden',send:'Skicka',teacherDesk:'Lärarvy',availability:'Tillgänglighet',addSlot:'Lägg till ledig tid',start:'Start',duration:'Längd',mode:'Format',online:'Online',offline:'På plats',students:'Elever',progress:'Framsteg',nextTopics:'Nästa lektions innehåll',savePlan:'Spara framsteg & plan',addResource:'Lägg till material / läxa',kind:'Typ',material:'Material',homework:'Läxa',title:'Titel',description:'Beskrivning',url:'Länk',due:'Deadline',publish:'Publicera',sessionRequests:'Lektionsförfrågningar',confirm:'Bekräfta',complete:'Klar',noShow:'Uteblev',teacherNote:'Läraranteckning',meetingLink:'Möteslänk',when:'Datum & tid',status:'Status',student:'Elev',refresh:'Uppdatera',saved:'Sparat.',sent:'Skickat.',removeSlot:'Ta bort',markComplete:'Markera klar',submitted:'Inskickad',assigned:'Tilldelad',completed:'Klar'
 },
 fa:{
  myCourses:'دوره‌هایی که یاد می‌گیری',teacherCourses:'دوره‌هایی که تدریس می‌کنی',bookings:'رزروها و جلسه‌ها',noBookings:'هنوز درخواست جلسه‌ای نداری.',preferred:'زمان پیشنهادی',confirmed:'تأییدشده',cancel:'لغو',meeting:'ورود به جلسه',learning:'فضای یادگیری',noSpace:'بعد از فعال‌شدن ثبت‌نام، فضای یادگیری نمایش داده می‌شود.',goal:'هدف یادگیری',saveGoal:'ذخیره هدف',notes:'یادداشت‌ها',share:'اشتراک با مدرس',saveNote:'ذخیره یادداشت',materials:'منابع و تکلیف‌ها',noResources:'هنوز منبع یا تکلیفی نیست.',response:'پاسخ شما',submit:'ارسال تکلیف',feedback:'بازخورد مدرس',messages:'پیام‌ها',send:'ارسال',teacherDesk:'فضای مدرس',availability:'زمان‌های آزاد',addSlot:'افزودن زمان آزاد',start:'شروع',duration:'مدت',mode:'نوع',online:'آنلاین',offline:'حضوری',students:'زبان‌آموزها',progress:'پیشرفت',nextTopics:'موضوعات جلسه بعد',savePlan:'ذخیره پیشرفت و برنامه',addResource:'افزودن منبع / تکلیف',kind:'نوع',material:'منبع',homework:'تکلیف',title:'عنوان',description:'توضیحات',url:'لینک',due:'مهلت',publish:'انتشار',sessionRequests:'درخواست‌های جلسه',confirm:'تأیید',complete:'تکمیل',noShow:'عدم حضور',teacherNote:'یادداشت مدرس',meetingLink:'لینک جلسه',when:'تاریخ و زمان',status:'وضعیت',student:'زبان‌آموز',refresh:'بازخوانی',saved:'ذخیره شد.',sent:'ارسال شد.',removeSlot:'حذف',markComplete:'تکمیل شد',submitted:'ارسال‌شده',assigned:'داده‌شده',completed:'تکمیل‌شده'
 }
} satisfies Record<Locale,Record<string,string>>

function i18n(v:Record<string,string>, locale:Locale){return v[locale]||v.en||Object.values(v)[0]||''}
function dt(v:string|null){return v?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—'}
function toIso(v:string){return new Date(v).toISOString()}

type MeetingDraft = { teams: string; zoom: string; primary: MeetingProvider }
const blankMeeting: MeetingDraft = {teams:'',zoom:'',primary:'Teams'}

function bookingMeetingDraft(booking: Booking): MeetingDraft {
 const links = [booking.meeting_url, booking.meeting_backup_url]
 return {
  teams: links.find(link => link && meetingProvider(link)==='Teams') ?? '',
  zoom: links.find(link => link && meetingProvider(link)==='Zoom') ?? '',
  primary: booking.meeting_url && meetingProvider(booking.meeting_url)==='Zoom' ? 'Zoom' : 'Teams',
 }
}

function JoinMeetingLinks({booking,locale}:{booking:Booking;locale:Locale}) {
 if (!['confirmed','in_progress'].includes(booking.status)) return null
 return <div className="academy-card-actions">
  {[booking.meeting_url,booking.meeting_backup_url].map((link,i) => {
   if (!link || !/^https:\/\//i.test(link)) return null
   const provider = meetingProvider(link)
   return <a key={link} className="small-link" href={link} target="_blank" rel="noreferrer">
    {i===0 ? (workspaceLabel(locale,"ورود به کلاس","Join lesson")) : (workspaceLabel(locale,"لینک جایگزین","Backup link"))}{provider ? ' · '+provider : ''}
   </a>
  })}
 </div>
}

export function AcademyPortal({
 locale,userId,courses,teachers,selfTeacher,teacherCourseIds,isAdmin,onNotice,initialSpaceId,view
}:{
 locale:Locale
 userId:string
 courses:Course[]
 teachers:Teacher[]
 selfTeacher:Teacher|undefined
 teacherCourseIds:string[]
 isAdmin:boolean
 view?:'student'|'teacher'
 initialSpaceId?:string
 onNotice:(message:string)=>void
}){
 const t=copy[locale]
 type PortalPanel='overview'|'schedule'|'classroom'|'teacher'
 const [panel,setPanel]=useState<PortalPanel>(initialSpaceId?'classroom':'overview')
 type TeacherTool='home'|'availability'|'requests'|'plan'|'summary'|'test'|'resource'
 const [teacherTool,setTeacherTool]=useState<TeacherTool>('home')
 type ClassroomTool='home'|'notes'|'materials'|'messages'|'progress'
 const [classroomTool,setClassroomTool]=useState<ClassroomTool>('home')
 const openClassroomTool=(tool:ClassroomTool)=>{window.history.pushState({...window.history.state,academyPortalPanel:'classroom',academyClassroomTool:tool},'',window.location.href);setPanel('classroom');setClassroomTool(tool)}
 const openTeacherTool=(tool:TeacherTool)=>{window.history.pushState({...window.history.state,academyPortalPanel:'teacher',academyTeacherTool:tool},'',window.location.href);setPanel('teacher');setTeacherTool(tool)}
 const openPanel=(next:PortalPanel)=>{if(next===panel)return;window.history.pushState({...window.history.state,academyPortalPanel:next},'',window.location.href);setPanel(next)}
 useEffect(()=>{const onPop=()=>{const value=window.history.state?.academyPortalPanel;setPanel(['overview','schedule','classroom','teacher'].includes(value)?value:'overview');const tool=window.history.state?.academyTeacherTool;setTeacherTool(['home','availability','requests','plan','summary','test','resource'].includes(tool)?tool:'home');const ct=window.history.state?.academyClassroomTool;setClassroomTool(['home','notes','materials','messages','progress'].includes(ct)?ct:'home')};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[])

 const [enrollments,setEnrollments]=useState<Enrollment[]>([])
 const [studentSpaces,setStudentSpaces]=useState<Space[]>([])
 const [teacherSpaces,setTeacherSpaces]=useState<Space[]>([])
 const [selectedBookings,setSelectedBookings]=useState<Booking[]>([]),[selectedBookingsError,setSelectedBookingsError]=useState(''),[completedPrivateCount,setCompletedPrivateCount]=useState<number|null>(null)
 const [scheduleRevision,setScheduleRevision]=useState(0)
 const [bookings,setBookings]=useState<Booking[]>([])
 const [availability,setAvailability]=useState<Availability[]>([])
 const [teacherCalendar,setTeacherCalendar]=useState<{id:string;starts_at:string;ends_at:string;status:string}[]>([])
 const [dashboardResources,setDashboardResources]=useState<Resource[]>([])
 const [dashboardNotes,setDashboardNotes]=useState<Note[]>([])
 const [testResults,setTestResults]=useState<TestResult[]>([])
 const [dashboardSummaries,setDashboardSummaries]=useState<SessionSummary[]>([])
 const [selectedSummaries,setSelectedSummaries]=useState<SessionSummary[]>([])
 const [selectedTests,setSelectedTests]=useState<TestResult[]>([])
 const [studentAvailability,setStudentAvailability]=useState<Availability[]>([])
 const [studentFilter,setStudentFilter]=useState('')
 const [selectedSpace,setSelectedSpace]=useState(initialSpaceId??'')
 const [notes,setNotes]=useState<Note[]>([])
 const [resources,setResources]=useState<Resource[]>([])
 const [messages,setMessages]=useState<Message[]>([])
 const [goal,setGoal]=useState('')
 const [noteBody,setNoteBody]=useState('')
 const [shareNote,setShareNote]=useState(false)
 const [messageBody,setMessageBody]=useState('')
 const [resourceResponse,setResourceResponse]=useState<Record<string,string>>({})
 const [slotStart,setSlotStart]=useState('')
 const [slotDuration,setSlotDuration]=useState('60')
 const [slotMode,setSlotMode]=useState('online')
 const [weeklyDays,setWeeklyDays]=useState<number[]>([])
 const [weeklyStart,setWeeklyStart]=useState('18:00')
 const [weeklyEnd,setWeeklyEnd]=useState('19:00')
 const [weeklyWeeks,setWeeklyWeeks]=useState('6')
 const [teacherPlan,setTeacherPlan]=useState({progress:'0',nextTopics:'',goal:''})
 const [resourceForm,setResourceForm]=useState({kind:'material',title:'',description:'',url:'',due:''})
 const [summaryForm,setSummaryForm]=useState({covered:'',grammar_focus:'',strengths:'',improve_next:'',next_focus:''})
 const [testForm,setTestForm]=useState({title:'',kind:'test',score:'',max_score:'',teacher_summary:''})
 const [meetingDefaults,setMeetingDefaults]=useState<MeetingDraft>(blankMeeting)
 const [meetingDrafts,setMeetingDrafts]=useState<Record<string,MeetingDraft>>({})
 const [savedMeetingDefaults,setSavedMeetingDefaults]=useState<MeetingDraft>(blankMeeting)
 const [defaultsReady,setDefaultsReady]=useState(false)
 useEffect(()=>{
  if(!selfTeacher || (isAdmin && view==='student')) return
  let active=true
  void Promise.resolve(supabase().from('academy_teacher_meeting_links').select('teams_url,zoom_url').eq('teacher_id',selfTeacher.id).maybeSingle()).then(({data,error})=>{
   if(!active) return
   if(error){onNotice(error.message);return}
   const saved:MeetingDraft={teams:data?.teams_url??'',zoom:data?.zoom_url??'',primary:'Teams'}
   setMeetingDefaults(saved)
   setSavedMeetingDefaults(saved)
   setDefaultsReady(true)
  }).catch(error=>{if(active)onNotice(String(error))})
  return()=>{active=false}
 },[selfTeacher?.id,isAdmin,view])
 const [bookingDraft,setBookingDraft]=useState<Record<string,{confirmed_start:string;teacher_note:string;duration_minutes:string}>>({})
 const [demoView,setDemoView]=useState(false)
 const [busy,setBusy]=useState(false)
 const busyRef=useRef(false),requestVersion=useRef(0)
 const [contentLoading,setContentLoading]=useState(false)
 const [refreshTick,setRefreshTick]=useState(0),[historyPage,setHistoryPage]=useState(0)
 const [summaryBooking,setSummaryBooking]=useState(''),[summaryEditId,setSummaryEditId]=useState('')
 const [resourceEditId,setResourceEditId]=useState('')
 const [feedbackDraft,setFeedbackDraft]=useState<Record<string,string>>({})
 const [editNoteId,setEditNoteId]=useState('')


 const courseById=useMemo(()=>new Map(courses.map(c=>[c.id,c])),[courses])
 const teacherById=useMemo(()=>new Map(teachers.map(x=>[x.id,x])),[teachers])
 const ownBookings=bookings.filter(x=>x.student_id===userId)
 const teacherBookings=selfTeacher?bookings.filter(x=>x.teacher_id===selfTeacher.id):[]
 const demoStudentIds=new Set(teacherSpaces.filter(s=>s.is_demo).map(s=>s.student_id))
 const realTeacherBookings=teacherBookings.filter(b=>!b.is_demo&&!demoStudentIds.has(b.student_id))
 const teacherOnly=isAdmin?(view??'teacher')==='teacher':Boolean(selfTeacher)
 const selected=(teacherOnly?teacherSpaces:studentSpaces).find(x=>x.id===selectedSpace)
 const selectedIsTeacher=Boolean(selected&&teacherOnly&&(isAdmin||(selfTeacher&&selected.teacher_id===selfTeacher.id&&selected.student_id!==userId)))
 const bookingByAvailability=useMemo(()=>new Map(teacherBookings.filter(b=>b.availability_id&&['requested','confirmed','in_progress'].includes(b.status)).map(b=>[b.availability_id!,b])),[teacherBookings])
 const subjectName=(code:string)=>({sv:{en:'Swedish',sv:'Svenska',de:'Schwedisch',fa:'سوئدی'},en:{en:'English',sv:'Engelska',de:'Englisch',fa:'انگلیسی'},de:{en:'German',sv:'Tyska',de:'Deutsch',fa:'آلمانی'},fa:{en:'Persian',sv:'Persiska',de:'Persisch',fa:'فارسی'}} as any)[code]?.[locale]??code.toUpperCase()

 async function refresh(){
  const version=++requestVersion.current
  const client=supabase()
  const reqs:PromiseLike<any>[]=[
   client.from('academy_enrollments').select('*').eq('student_id',userId).order('created_at',{ascending:false}),
   client.from('academy_learning_spaces').select('*').eq('student_id',userId).order('created_at',{ascending:false}),
   client.from('academy_bookings').select('*').order('created_at',{ascending:false}).limit(200),
  ]
  if(selfTeacher||isAdmin){
   let q=client.from('academy_learning_spaces').select('*').order('created_at',{ascending:false})
   if(!isAdmin)q=q.eq('teacher_id',selfTeacher!.id)
   reqs.push(isAdmin?q.limit(1000):client.rpc('academy_teacher_roster',{p_teacher:selfTeacher!.id}))
   reqs.push(client.from('academy_availability').select('*').eq('teacher_id',selfTeacher?.id??'00000000-0000-0000-0000-000000000000').gte('ends_at',new Date().toISOString()).order('starts_at').limit(100))
   reqs.push(client.rpc('academy_teacher_calendar',{p_teacher_id:selfTeacher?.id??'00000000-0000-0000-0000-000000000000'}))
  }
  const results=await Promise.all(reqs)
  if(version!==requestVersion.current)return
  const failed=results.find(r=>r.error);if(failed){onNotice(failed.error.message);return}
  setEnrollments((results[0].data??[]) as Enrollment[])
  const ownSpaces=(results[1].data??[]) as Space[]
  setStudentSpaces(ownSpaces)
  setBookings((results[2].data??[]) as Booking[])
  if(ownSpaces.length){
   const ids=ownSpaces.map(x=>x.id)
   const [rr,nn,tr,sr]=await Promise.all([
    client.from('academy_resources').select('*').in('learning_space_id',ids).order('created_at',{ascending:false}).limit(300),
    client.from('academy_notes').select('*').in('learning_space_id',ids).order('created_at',{ascending:false}).limit(300),
    client.from('academy_test_results').select('*').in('learning_space_id',ids).order('taken_at',{ascending:false}).limit(200),
    client.from('academy_session_summaries').select('*').in('learning_space_id',ids).order('created_at',{ascending:false}).limit(200),
   ])
   if(version!==requestVersion.current)return
   setDashboardResources((rr.data??[]) as Resource[])
   setDashboardNotes((nn.data??[]) as Note[])
   setTestResults(tr.error?[]:((tr.data??[]) as TestResult[]))
   setDashboardSummaries(sr.error?[]:((sr.data??[]) as SessionSummary[]))
  }else{setDashboardResources([]);setDashboardNotes([]);setTestResults([]);setDashboardSummaries([])}
  const taughtSpaces=(selfTeacher||isAdmin)?((results[3].data??[]) as Space[]).map(sp=>({...sp,student_display_name:sp.resolved_name||sp.student_display_name})):[]
  const slots=(selfTeacher||isAdmin)?((results[4].data??[]) as Availability[]):[]
  setTeacherSpaces(taughtSpaces.filter(x=>x.student_id!==userId))
  setAvailability(slots)
  setTeacherCalendar(results[5]?.data??[])
  const taught=taughtSpaces.filter(x=>x.student_id!==userId)
  const all=teacherOnly?taught:ownSpaces
  if(!selectedSpace&&all[0])setSelectedSpace(all[0].id)
  if(selectedSpace&&!all.some(x=>x.id===selectedSpace))setSelectedSpace(all[0]?.id??'')
  setScheduleRevision(n=>n+1)
 }

 useEffect(()=>{void refresh().catch(e=>onNotice(String(e)));return()=>{requestVersion.current++}},[userId,selfTeacher?.id,isAdmin])
 useEffect(()=>{const timer=window.setInterval(()=>setRefreshTick(n=>n+1),20000);return()=>clearInterval(timer)},[])
 useEffect(()=>{
  setNotes([]);setResources([]);setMessages([]);setSelectedSummaries([]);setSelectedTests([])
  setNoteBody('');setShareNote(false);setMessageBody('');setResourceResponse({});setHistoryPage(0);setEditNoteId('');setResourceEditId('');setSummaryEditId('');setSummaryBooking('')
  setSummaryForm({covered:'',grammar_focus:'',strengths:'',improve_next:'',next_focus:''})
  setTestForm({title:'',kind:'test',score:'',max_score:'',teacher_summary:''})
  setResourceForm({kind:'material',title:'',description:'',url:'',due:''})
 },[selectedSpace])

 useEffect(()=>{
  if(!selectedSpace){setNotes([]);setResources([]);setMessages([]);setSelectedSummaries([]);setSelectedTests([]);setStudentAvailability([]);return}
  let cancelled=false
  setContentLoading(true)
  const space=[...studentSpaces,...teacherSpaces].find(x=>x.id===selectedSpace)
  const availabilityReq=space?.teacher_id&&space.student_id===userId
    ? supabase().rpc('academy_teacher_calendar',{p_teacher_id:space.teacher_id,p_from:new Date().toISOString(),p_to:new Date(Date.now()+60*86400000).toISOString()})
    : Promise.resolve({data:[],error:null})
  Promise.all([
   supabase().from('academy_notes').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).range(historyPage*50,historyPage*50+49),
   supabase().from('academy_resources').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).range(historyPage*50,historyPage*50+49),
   supabase().from('academy_messages').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).range(historyPage*50,historyPage*50+49),
   supabase().from('academy_session_summaries').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).range(historyPage*50,historyPage*50+49),
   supabase().from('academy_test_results').select('*').eq('learning_space_id',selectedSpace).order('taken_at',{ascending:false}).range(historyPage*50,historyPage*50+49),
   availabilityReq,
  ]).then(([n,r,m,summaries,tests,slots])=>{
   if(cancelled)return
   setContentLoading(false)
   const failed=[n,r,m,summaries,tests,slots].find(x=>x.error);if(failed){onNotice(failed.error!.message);return}
   setNotes((n.data??[]) as Note[])
   setResources((r.data??[]) as Resource[])
   setSelectedSummaries(summaries.error?[]:((summaries.data??[]) as SessionSummary[]))
   setSelectedTests(tests.error?[]:((tests.data??[]) as TestResult[]))
   setStudentAvailability((slots.data??[]) as Availability[])
   const msg=((m.data??[]) as Message[]).reverse()
   setMessages(msg)
   const unread=msg.filter(x=>x.recipient_id===userId&&!x.read_at).map(x=>x.id)
   if(unread.length)void supabase().from('academy_messages').update({read_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',unread)
  }).catch(error=>{if(!cancelled){setContentLoading(false);onNotice(String(error))}})
  return()=>{cancelled=true}
 },[selectedSpace,userId,studentSpaces,teacherSpaces,refreshTick,historyPage])

 useEffect(()=>{
  let live=true;setSelectedBookings([]);setSelectedBookingsError('');setCompletedPrivateCount(null)
  if(!selected||!selectedIsTeacher||!selected.teacher_id)return
  const client=supabase(),byStudent=(query:any)=>query.eq('student_id',selected.student_id).eq('teacher_id',selected.teacher_id).eq('course_id',selected.course_id)
  void Promise.all([byStudent(client.from('academy_bookings').select('*')).order('confirmed_start',{ascending:false}).limit(200),byStudent(client.from('academy_bookings').select('id',{count:'exact',head:true})).eq('status','completed')]).then(([result,total])=>{if(live){setSelectedBookings((result.data??[]) as Booking[]);setCompletedPrivateCount(typeof total.count==='number'?total.count:null);if(result.error||total.error)setSelectedBookingsError((result.error||total.error).message)}}).catch(error=>{if(live)setSelectedBookingsError(String(error))})
  return()=>{live=false}
 },[selected?.id,selected?.student_id,selected?.teacher_id,selected?.course_id,selectedIsTeacher,refreshTick])

 useEffect(()=>{
  if(!selected)return
  setGoal(selected.goal??'')
  setTeacherPlan({progress:String(selected.progress??0),nextTopics:(selected.next_session_topics??[]).join('\n'),goal:selected.goal??''})
 },[selectedSpace,selected?.progress,selected?.goal])

 async function run(action:()=>Promise<void>){
  if(busyRef.current||contentLoading)return
  busyRef.current=true;setBusy(true)
  try{await action()}catch(error){onNotice(error instanceof Error?error.message:String(error))}
  finally{busyRef.current=false;setBusy(false)}
 }

 async function saveGoal(){
  if(!selected||selected.student_id!==userId)return
  await run(async()=>{
   const {error}=await supabase().from('academy_learning_spaces').update({goal:goal.trim()||null,updated_at:new Date().toISOString()}).eq('id',selected.id)
   if(error)throw error
   onNotice(t.saved);await refresh()
  })
 }

 async function saveNote(){
  if(!selected||!noteBody.trim())return
  await run(async()=>{
   const payload={body:noteBody.trim(),visibility:shareNote?'shared':'private'}
   const q=editNoteId?supabase().from('academy_notes').update({...payload,updated_at:new Date().toISOString()}).eq('id',editNoteId).eq('author_id',userId):supabase().from('academy_notes').insert({...payload,learning_space_id:selected.id,author_id:userId})
   const {error}=await q
   if(error)throw error
   setNoteBody('');setEditNoteId('');setShareNote(false);onNotice(t.saved);void refresh()
   setHistoryPage(0);setRefreshTick(n=>n+1)
  })
 }

 async function cancelBooking(id:string){
  await run(async()=>{
   const {error}=await supabase().from('academy_bookings').update({status:'cancelled_student',updated_at:new Date().toISOString()}).eq('id',id)
   if(error)throw error
   onNotice(t.saved);await refresh()
  })
 }

 async function submitHomework(resource:Resource){
  await run(async()=>{
   const {error}=await supabase().from('academy_resources').update({student_response:(resourceResponse[resource.id]??'').trim()||null,student_status:'submitted',updated_at:new Date().toISOString()}).eq('id',resource.id)
   if(error)throw error
   onNotice(t.saved)
   setHistoryPage(0);setRefreshTick(n=>n+1)
  })
 }

 async function sendMessage(){
  if(!selected||!messageBody.trim())return
  const teacher=selected.teacher_id?teacherById.get(selected.teacher_id):undefined
  const recipient=selected.student_id===userId?teacher?.user_id:selected.student_id
  if(isAdmin&&selected.student_id!==userId&&selfTeacher?.id!==selected.teacher_id){onNotice(workspaceLabel(locale,"پیام فقط بین استاد و دانشجوی کلاس ارسال می‌شود.","Messages are sent only between the assigned teacher and student."));return}
  if(!recipient){onNotice('The other Academy member is not linked to a Lingo3 account yet.');return}
  await run(async()=>{
   const {error}=await supabase().from('academy_messages').insert({learning_space_id:selected.id,sender_id:userId,recipient_id:recipient,body:messageBody.trim()})
   if(error)throw error
   setMessageBody('');onNotice(t.sent)
   setHistoryPage(0);setRefreshTick(n=>n+1)
  })
 }

 function weekdayLabel(day:number){const d=new Date(2026,10,15+day);return new Intl.DateTimeFormat(locale,{weekday:'short'}).format(d)}
 function weeklyDate(day:number,week:number,time:string){
  const now=new Date(),base=new Date(now);base.setHours(0,0,0,0)
  const untilMonday=((8-base.getDay())%7)||7
  base.setDate(base.getDate()+untilMonday+week*7+(day===0?6:day-1))
  const [hour,minute]=time.split(':').map(Number);base.setHours(hour||0,minute||0,0,0)
  return base
 }
 async function addWeeklySlots(){
  if(!selfTeacher||weeklyDays.length===0)return
  const weeks=Math.max(1,Math.min(8,Number(weeklyWeeks)||1))
  const rows=[] as Array<{teacher_id:string;starts_at:string;ends_at:string;delivery_mode:string;status:string}>
  for(let week=0;week<weeks;week++)for(const day of weeklyDays){
   const start=weeklyDate(day,week,weeklyStart),end=weeklyDate(day,week,weeklyEnd)
   if(end<=start)continue
   const overlaps=availability.some(a=>new Date(a.starts_at)<end&&new Date(a.ends_at)>start&&a.status!=='cancelled')
   if(!overlaps)rows.push({teacher_id:selfTeacher.id,starts_at:start.toISOString(),ends_at:end.toISOString(),delivery_mode:slotMode,status:'available'})
  }
  if(rows.length===0){onNotice(workspaceLabel(locale,"زمان جدیدی برای ساختن وجود ندارد.","No new times to create."));return}
  await run(async()=>{
   const {error}=await supabase().from('academy_availability').insert(rows)
   if(error)throw error
   onNotice(String(rows.length)+' '+t.saved);await refresh()
  })
 }

 async function addSlot(){
  if(!selfTeacher||!slotStart)return
  const chosen=new Date(slotStart),duration=Number(slotDuration)
  if(!Number.isFinite(chosen.getTime())||chosen.getTime()<=Date.now()||!Number.isInteger(duration)||duration<15||duration>240){onNotice(workspaceLabel(locale,"زمان آینده و مدت ۱۵ تا ۲۴۰ دقیقه انتخاب کن.","Choose a future time and a duration of 15–240 minutes."));return}
  await run(async()=>{
   const start=new Date(slotStart)
   const end=new Date(start.getTime()+(Number(slotDuration)||60)*60000)
   const {error}=await supabase().from('academy_availability').insert({teacher_id:selfTeacher.id,starts_at:start.toISOString(),ends_at:end.toISOString(),delivery_mode:slotMode,status:'available'})
   if(error)throw error
   setSlotStart('');onNotice(t.saved);await refresh()
  })
 }

 async function removeSlot(id:string){
  await run(async()=>{
   const {error}=await supabase().from('academy_availability').delete().eq('id',id)
   if(error)throw error
   onNotice(t.saved);await refresh()
  })
 }

 async function saveMeetingDefaults(){
  if(!selfTeacher || !defaultsReady) return
  await run(async()=>{
   meetingLinkPair(meetingDefaults.teams,meetingDefaults.zoom,'Teams')
   const {error}=await supabase().from('academy_teacher_meeting_links').upsert({
    teacher_id:selfTeacher.id,teams_url:meetingDefaults.teams.trim()||null,zoom_url:meetingDefaults.zoom.trim()||null,
   })
   if(error) throw error
   setSavedMeetingDefaults(meetingDefaults)
   onNotice(t.saved)
  })
 }

 async function saveBookingLinks(booking: Booking){
  const draft=meetingDrafts[booking.id]
  if(!draft) return
  await run(async()=>{
   const links=meetingLinkPair(draft.teams,draft.zoom,draft.primary)
   const {error}=await supabase().from('academy_bookings')
    .update({...links,updated_at:new Date().toISOString()}).eq('id',booking.id).eq('status','confirmed').select('id').single()
   if(error) throw error
   setMeetingDrafts(previous=>{const next={...previous};delete next[booking.id];return next})
   onNotice(t.saved)
   await refresh()
  })
 }
 async function updateBooking(booking:Booking,status:string){
  const draft=bookingDraft[booking.id]??{confirmed_start:'',teacher_note:'',duration_minutes:'60'}
  await run(async()=>{
   const payload:any={status,updated_at:new Date().toISOString()}
   if(status==='confirmed'){
    payload.confirmed_start=draft.confirmed_start?toIso(draft.confirmed_start):(booking.preferred_start??new Date().toISOString())
    const slot=availability.find(a=>a.id===booking.availability_id)
    payload.duration_minutes=slot?Math.round((new Date(slot.ends_at).getTime()-new Date(slot.starts_at).getTime())/60000):(Number(draft.duration_minutes)||60)
    if(meetingDrafts[booking.id]) {
     const {teams,zoom,primary}=meetingDrafts[booking.id]
     Object.assign(payload,meetingLinkPair(teams,zoom,primary))
    }
    payload.teacher_note=draft.teacher_note.trim()||null
   }
   const {error}=await supabase().from('academy_bookings').update(payload).eq('id',booking.id)
   if(error)throw error
   onNotice(t.saved);await refresh()
  })
 }

 async function saveTeacherPlan(){
  if(!selected||!selectedIsTeacher)return
  await run(async()=>{
   const {error}=await supabase().from('academy_learning_spaces').update({
    progress:Math.max(0,Math.min(100,Number(teacherPlan.progress)||0)),
    next_session_topics:teacherPlan.nextTopics.split('\n').map(x=>x.trim()).filter(Boolean),
    goal:teacherPlan.goal.trim()||null,
    updated_at:new Date().toISOString(),
   }).eq('id',selected.id)
   if(error)throw error
   onNotice(t.saved);await refresh()
  })
 }

 async function addResource(){
  if(!selected||!selectedIsTeacher||!selected.teacher_id||!resourceForm.title.trim())return
  await run(async()=>{
   const payload={
    learning_space_id:selected.id,teacher_id:selected.teacher_id!,kind:resourceForm.kind,title:resourceForm.title.trim(),
    description:resourceForm.description.trim()||null,url:resourceForm.url.trim()||null,due_at:resourceForm.due?toIso(resourceForm.due):null,
   }
   const {learning_space_id:_space,teacher_id:_teacher,...editable}=payload
   const {error}=await (resourceEditId?supabase().from('academy_resources').update(editable).eq('id',resourceEditId):supabase().from('academy_resources').insert(payload))
   if(error)throw error
   setResourceEditId('');setResourceForm({kind:'material',title:'',description:'',url:'',due:''});onNotice(t.saved)
   setHistoryPage(0);setRefreshTick(n=>n+1)
  })
 }

 async function completeResource(resource:Resource){
  await run(async()=>{
   const feedback=feedbackDraft[resource.id]??resource.teacher_feedback??''
   const {error}=await supabase().from('academy_resources').update({student_status:'completed',teacher_feedback:feedback||null,updated_at:new Date().toISOString()}).eq('id',resource.id)
   if(error)throw error
   onNotice(t.saved)
   setHistoryPage(0);setRefreshTick(n=>n+1)
  })
 }

 async function saveSessionSummary(){
  if(!selected||!selectedIsTeacher||!selected.teacher_id)return
  const hasText=Object.values(summaryForm).some(v=>v.trim())
  if(!hasText)return
  const related=summaryBooking?bookings.find(b=>b.id===summaryBooking):undefined
  await run(async()=>{
   const payload={
    learning_space_id:selected.id,booking_id:related?.id??null,teacher_id:selected.teacher_id!,student_id:selected.student_id,
    covered:summaryForm.covered.trim()||null,grammar_focus:summaryForm.grammar_focus.trim()||null,
    strengths:summaryForm.strengths.trim()||null,improve_next:summaryForm.improve_next.trim()||null,next_focus:summaryForm.next_focus.trim()||null,
    updated_at:new Date().toISOString(),
   }
   let error
   if(related?.id){
    const existing=summaryEditId?selectedSummaries.find(x=>x.id===summaryEditId):selectedSummaries.find(x=>x.booking_id===related.id)
    if(existing)({error}=await supabase().from('academy_session_summaries').update(payload).eq('id',existing.id))
    else ({error}=await supabase().from('academy_session_summaries').insert(payload))
   }else if(summaryEditId)({error}=await supabase().from('academy_session_summaries').update(payload).eq('id',summaryEditId))
   else ({error}=await supabase().from('academy_session_summaries').insert(payload))
   if(error)throw error
   setSummaryEditId('');setSummaryBooking('');setSummaryForm({covered:'',grammar_focus:'',strengths:'',improve_next:'',next_focus:''});onNotice(t.saved)
   setHistoryPage(0);setRefreshTick(n=>n+1)
  })
 }

 async function addTestResult(){
  if(!selected||!selectedIsTeacher||!selected.teacher_id||!testForm.title.trim())return
  const score=testForm.score===''?null:Number(testForm.score),maximum=testForm.max_score===''?null:Number(testForm.max_score)
  if((score!==null&&(!Number.isFinite(score)||score<0))||(maximum!==null&&(!Number.isFinite(maximum)||maximum<=0))||(score!==null&&maximum!==null&&score>maximum)){onNotice(workspaceLabel(locale,"امتیاز باید بین صفر و حداکثر آزمون باشد.","Score must be between zero and the test maximum."));return}
  await run(async()=>{
   const {error}=await supabase().from('academy_test_results').insert({
    learning_space_id:selected.id,teacher_id:selected.teacher_id!,student_id:selected.student_id,title:testForm.title.trim(),kind:testForm.kind,
    score:testForm.score===''?null:Number(testForm.score),max_score:testForm.max_score===''?null:Number(testForm.max_score),
    teacher_summary:testForm.teacher_summary.trim()||null,
   })
   if(error)throw error
   setTestForm({title:'',kind:'test',score:'',max_score:'',teacher_summary:''});onNotice(t.saved)
   setHistoryPage(0);setRefreshTick(n=>n+1)
  })
 }

 const courseTitle=(id:string|null)=>id?(courseById.get(id)?i18n(courseById.get(id)!.title_i18n,locale):id):'—'
 const teacherTitle=(id:string)=>{const t=teacherById.get(id);return t?localizedName(t,locale):'Teacher'}

 const demoControls=selfTeacher&&teacherOnly&&<div className="academy-card-actions"><button onClick={()=>{setDemoView(false);void refresh()}}>{locale==='fa'?'نمای استاد':locale==='sv'?'Lärarvy':locale==='de'?'Lehrkraftansicht':'Teacher view'}</button><button disabled={busy} onClick={()=>void run(async()=>{const r=await supabase().rpc('academy_prepare_demo');if(r.error)throw r.error;setDemoView(true)})}>{locale==='fa'?'نمای دانشجوی آزمایشی':locale==='sv'?'Testelevens vy':locale==='de'?'Testschüleransicht':'Demo student view'}</button><button disabled={busy} onClick={()=>void run(async()=>{if(!window.confirm(workspaceLabel(locale,"فقط داده‌های دانشجوی آزمایشی بازنشانی شوند؟","Reset only the demo student data?")))return;const r=await supabase().rpc('academy_prepare_demo',{p_reset:true});if(r.error)throw r.error;setDemoView(false);await refresh();setRefreshTick(n=>n+1)})}>{locale==='fa'?'بازنشانی آزمایشی':locale==='sv'?'Återställ testdata':locale==='de'?'Testdaten zurücksetzen':'Reset demo'}</button></div>
 if(demoView&&teacherOnly&&selfTeacher)return <div className="academy-portal">{demoControls}<AcademyDemoStudent key={userId} locale={locale}/></div>
 return <div className="academy-portal" aria-busy={busy||contentLoading}>{demoControls}
  <nav className="academy-portal-nav" aria-label={t.learning}>{([['overview',({fa:'نمای کلی',en:'Overview',sv:'Översikt',de:'Übersicht'})[locale]],['schedule',({fa:'برنامه و کلاس‌ها',en:'Schedule & classes',sv:'Schema och klasser',de:'Termine und Klassen'})[locale]],['classroom',({fa:'فضای یادگیری',en:'Learning space',sv:'Lärmiljö',de:'Lernraum'})[locale]],...(teacherOnly?([['teacher',({fa:'ابزار استاد',en:'Teacher tools',sv:'Lärarverktyg',de:'Lehrwerkzeuge'})[locale]]] as [string,string][]):[])] as [string,string][]).map(([id,label])=><button type="button" key={id} aria-pressed={panel===id} onClick={()=>openPanel(id as PortalPanel)}>{label}</button>)}</nav>
  <p className="academy-section-hint">{({overview:{fa:'مرور دوره‌ها، ثبت‌نام‌ها و فعالیت‌های اخیر.',en:'Review your courses, enrollments and recent activity.',sv:'Se dina kurser, registreringar och senaste aktiviteter.',de:'Kurse, Anmeldungen und aktuelle Aktivitäten ansehen.'},schedule:{fa:'برنامهٔ کلاس‌ها و زمان‌های آزاد را ببین و مدیریت کن.',en:'View and manage lesson times and availability.',sv:'Se och hantera lektioner och lediga tider.',de:'Unterrichtstermine und Verfügbarkeit ansehen und verwalten.'},classroom:{fa:'یادداشت، منابع، پیام‌ها و پیشرفت این دوره را ببین.',en:'See notes, materials, messages and progress for this course.',sv:'Se kursens anteckningar, material, meddelanden och framsteg.',de:'Notizen, Materialien, Nachrichten und Fortschritt dieses Kurses ansehen.'},teacher:{fa:'کلاس‌ها، مطالب و پیشرفت زبان‌آموزان را مدیریت کن.',en:'Manage classes, learning materials and student progress.',sv:'Hantera klasser, material och elevernas framsteg.',de:'Klassen, Lernmaterial und Fortschritte verwalten.'}} as const)[panel][locale]}</p>
  {panel!=='overview'&&<button type="button" className="academy-panel-back" onClick={()=>{if(window.history.state?.academyPortalPanel)window.history.back();else setPanel('overview')}}>{({fa:'بازگشت به نمای کلی',en:'Back to overview',sv:'Tillbaka till översikten',de:'Zurück zur Übersicht'})[locale]}</button>}
  <div hidden={panel!=='schedule'}>
  <AcademySchedule revision={scheduleRevision} locale={locale} userId={userId} teacherId={teacherOnly?selfTeacher?.id:undefined} studentTeacherId={!teacherOnly?selected?.teacher_id??undefined:undefined} courses={courses} onSelectDay={teacherOnly&&selfTeacher?(day)=>{const d=new Date(day),now=new Date();d.setHours(9,0,0,0);if(d.getTime()<=now.getTime())d.setHours(Math.min(now.getHours()+1,23),now.getHours()===23?59:0,0,0);setSlotStart(new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16));openTeacherTool('availability');window.setTimeout(()=>document.getElementById('academy-availability')?.scrollIntoView({behavior:'smooth',block:'start'}),0)}:undefined}/>

  </div>
  <div hidden={panel!=='overview'}>
  {teacherOnly&&<section className="academy-card"><h3>{locale==='fa'?'خلاصهٔ تدریس':locale==='sv'?'Undervisningsöversikt':locale==='de'?'Unterrichtsübersicht':'Teaching overview'}</h3><div className="academy-tags"><span>{t.students}: {new Set(teacherSpaces.filter(s=>!s.is_demo).map(s=>s.student_id)).size}</span><span>{t.sessionRequests}: {realTeacherBookings.filter(b=>b.status==='requested').length}</span><span>{t.submitted}: {teacherSpaces.filter(s=>!s.is_demo).reduce((n,s)=>n+(s.awaiting_review||0),0)}</span></div>{realTeacherBookings.filter(b=>['confirmed','in_progress'].includes(b.status)&&b.confirmed_start&&new Date(b.confirmed_start)>new Date()).sort((a,b)=>String(a.confirmed_start).localeCompare(String(b.confirmed_start))).slice(0,1).map(b=><p key={b.id}>{locale==='fa'?'جلسهٔ بعدی':locale==='sv'?'Nästa lektion':locale==='de'?'Nächste Stunde':'Next lesson'}: {dt(b.confirmed_start)} · {b.student_display_name||teacherSpaces.find(s=>s.student_id===b.student_id)?.student_display_name||t.student}</p>)}</section>}
  </div>
  <div hidden={panel!=='classroom'&&panel!=='teacher'}>
  {teacherOnly&&<section className="academy-teacher-switch"><h3>{locale==='fa'?'فضای مشترک با شاگردان':locale==='sv'?'Elevernas lärmiljö':locale==='de'?'Lernräume der Schüler':'Shared student workspaces'}</h3><AcademyField locale={locale}><label className="academy-search">{({fa:"جستجوی دانشجو",en:"Search students",sv:"Sök elev",de:"Schüler suchen"})[locale]}<input type="search" value={studentFilter} onChange={e=>setStudentFilter(e.target.value)}/></label><label>{t.students}<select aria-label={t.students} value={selectedSpace} onChange={e=>setSelectedSpace(e.target.value)}><option value="">—</option>{teacherSpaces.filter(sp=>sp.id===selectedSpace||[sp.student_display_name,courseTitle(sp.course_id)].join(' ').toLocaleLowerCase().includes(studentFilter.toLocaleLowerCase())).map(sp=><option key={sp.id} value={sp.id}>{sp.student_display_name||sp.student_id} · {courseTitle(sp.course_id)}{sp.awaiting_review?' · '+t.submitted+': '+sp.awaiting_review:''}</option>)}</select></label></AcademyField>{teacherSpaces.length===0&&<p>{t.noSpace}</p>}{selected&&<p>{selected.student_display_name} · {selected.progress}% · {selected.next_session_topics.join(' · ')}</p>}</section>}
  </div>
  <div hidden={panel!=='teacher'}>
  {teacherOnly&&(selfTeacher||isAdmin)&&<AcademyPostStudio key={'posts-'+userId} locale={locale} userId={userId} isAdmin={isAdmin} spaces={teacherSpaces}/>}
  {teacherOnly&&selfTeacher&&<AcademyTeacherDesk key={userId} userId={userId} locale={locale}/>}
  {teacherOnly&&selfTeacher&&<AcademyTimeOff teacherId={selfTeacher.id} locale={locale} onChanged={()=>void refresh()}/>}
  </div>
  <div hidden={panel!=='schedule'}>
  <AcademyClasses onScheduleChanged={()=>setScheduleRevision(n=>n+1)} onOpenSpace={id=>{void refresh();setSelectedSpace(id);openPanel('classroom')}} key={userId+String(teacherOnly)} isAdmin={isAdmin&&teacherOnly} locale={locale} userId={userId} teacherId={teacherOnly?selfTeacher?.id:undefined} courses={courses.filter(c=>teacherCourseIds.includes(c.id))}/>
  </div>
  <div className="academy-card-actions"><button disabled={busy} onClick={()=>{void refresh().catch(e=>onNotice(String(e)));setRefreshTick(n=>n+1)}}>{t.refresh}</button>{selected&&<><button disabled={historyPage===0||busy||contentLoading} onClick={()=>setHistoryPage(n=>n-1)}>{workspaceLabel(locale,"جدیدتر","Newer")}</button><span>{workspaceLabel(locale,"صفحه","Page")} {historyPage+1}</span><button disabled={busy||contentLoading||Math.max(notes.length,resources.length,messages.length,selectedSummaries.length,selectedTests.length)<50} onClick={()=>setHistoryPage(n=>n+1)}>{workspaceLabel(locale,"قدیمی‌تر","Older")}</button></>}</div>
  {contentLoading&&<p role="status">{workspaceLabel(locale,"در حال دریافت اطلاعات کلاس…","Loading classroom…")}</p>}
  <fieldset disabled={busy||contentLoading} className="academy-workflow-fields">
  <div hidden={panel!=='overview'}>
  {!teacherOnly&&<section className="academy-dashboard-summary">
   <div className="academy-section-head"><p>{locale==='fa'?'زبان‌های من':locale==='sv'?'Mina språk':locale==='de'?'Meine Sprachen':'My languages'}</p><h3>{locale==='fa'?'وضعیت یادگیری':locale==='sv'?'Din läröversikt':locale==='de'?'Dein Lernüberblick':'Your learning overview'}</h3></div>
   <div className="academy-language-dashboard">
    {studentSpaces.length===0?<div className="academy-empty">{t.noSpace}</div>:studentSpaces.map(sp=>{
      const c=courseById.get(sp.course_id)
      const bs=ownBookings.filter(b=>b.course_id===sp.course_id)
      const now=Date.now()
      const past=bs.filter(b=>['completed','confirmed'].includes(b.status)&&new Date(b.confirmed_start??b.preferred_start??0).getTime()<now).sort((a,b)=>new Date(b.confirmed_start??b.preferred_start??0).getTime()-new Date(a.confirmed_start??a.preferred_start??0).getTime())[0]
      const next=bs.filter(b=>['confirmed','requested'].includes(b.status)&&new Date(b.confirmed_start??b.preferred_start??0).getTime()>=now).sort((a,b)=>new Date(a.confirmed_start??a.preferred_start??0).getTime()-new Date(b.confirmed_start??b.preferred_start??0).getTime())[0]
      const hw=dashboardResources.filter(r=>r.learning_space_id===sp.id&&r.kind==='homework')
      const open=hw.filter(r=>r.student_status!=='completed').length
      const lastTest=testResults.find(r=>r.learning_space_id===sp.id)
      const lastSummary=dashboardSummaries.find(r=>r.learning_space_id===sp.id)
      const ownNoteCount=dashboardNotes.filter(n=>n.learning_space_id===sp.id&&n.author_id===userId).length
      return <article className={'academy-card academy-language-card '+(selectedSpace===sp.id?'is-selected':'')} key={sp.id} onClick={()=>setSelectedSpace(sp.id)}>
       <div className="academy-card-top"><span className="academy-badge">{subjectName(c?.subject_code??'')}</span><span>{c?.level_code??sp.current_level??'—'}</span></div>
       <h3>{c?i18n(c.title_i18n,locale):sp.current_level??t.learning}</h3>
       <div className="space-progress"><span>{workspaceLabel(locale,"پیشرفت ثبت‌شده توسط استاد","Teacher-recorded progress")}</span><b>{sp.progress}%</b></div><div className="progress-bar"><i style={{width:String(sp.progress)+'%'}}/></div>
       <dl className="academy-dashboard-facts">
        <div><dt>{locale==='fa'?'آخرین جلسه':locale==='sv'?'Senaste lektion':'Last session'}</dt><dd>{past?dt(past.confirmed_start??past.preferred_start):'—'}</dd></div>
        <div><dt>{locale==='fa'?'جلسه بعد':locale==='sv'?'Nästa lektion':'Next session'}</dt><dd>{next?dt(next.confirmed_start??next.preferred_start):'—'}</dd></div>
        <div><dt>{locale==='fa'?'جمع‌بندی استاد':locale==='sv'?'Lärarens senaste notering':'Latest teacher summary'}</dt><dd>{lastSummary?.next_focus||lastSummary?.covered||past?.teacher_note||'—'}</dd></div>
        <div><dt>{t.homework}</dt><dd>{open} {workspaceLabel(locale,"باز","open")}</dd></div>
        <div><dt>{t.notes}</dt><dd>{ownNoteCount}</dd></div>
        <div><dt>{workspaceLabel(locale,"آخرین تست","Latest test")}</dt><dd>{lastTest?(lastTest.percent!=null?Math.round(lastTest.percent)+'%':lastTest.title):'—'}</dd></div>
       </dl>
       <div className="academy-card-actions" onClick={e=>e.stopPropagation()}>
        <button type="button" onClick={()=>{setSelectedSpace(sp.id);openPanel('classroom')}}>{({fa:'بازکردن فضای یادگیری',en:'Open learning space',sv:'Öppna lärmiljö',de:'Lernraum öffnen'})[locale]}</button>
        <button className="small-link" onClick={()=>navigateProduct('/words?academyLang='+encodeURIComponent(c?.subject_code??''),{directApp:true})}>{workspaceLabel(locale,"لغات","Words ↗")}</button>
        <button className="small-link" onClick={()=>navigateProduct('/grammar?academyLang='+encodeURIComponent(courseById.get(selected?.course_id??'')?.subject_code??''),{directApp:true})}>{workspaceLabel(locale,"گرامر","Grammar ↗")}</button>
       </div>
      </article>
    })}
   </div>
  </section>}
  {!teacherOnly&&<div className="academy-personal-grid">
   <article className="academy-card">
    <h3>{t.myCourses}</h3>
    {enrollments.length===0?<p>—</p>:enrollments.map(e=><div className="personal-row" key={e.id}><span>{courseTitle(e.course_id)}</span><b>{academyStatus(e.status,locale)}</b></div>)}
   </article>

   <article className="academy-card">
    <h3>{t.bookings}</h3>
    {ownBookings.length===0?<p>{t.noBookings}</p>:ownBookings.map(b=><div className="academy-session-row" key={b.id}>
     <div><strong>{teacherTitle(b.teacher_id)}</strong><small>{courseTitle(b.course_id)}</small></div>
     <div><span>{b.confirmed_start?t.confirmed:t.preferred}: {dt(b.confirmed_start??b.preferred_start)}</span><small>{academyStatus(b.status,locale)}</small></div>
     <JoinMeetingLinks booking={b} locale={locale}/><div className="academy-card-actions">{['requested','confirmed'].includes(b.status)&&<button className="small-link" onClick={()=>cancelBooking(b.id)}>{t.cancel}</button>}</div>
    </div>)}
   </article>

   <article className="academy-card academy-learning-workspace">
    <h3>{t.learning}</h3>{selected?.next_session_topics?.length? <p>{t.nextTopics}: {selected.next_session_topics.join(' · ')}</p>:null}
    {studentSpaces.length===0?<p>{t.noSpace}</p>:<>
     <AcademyField locale={locale}><label>{t.myCourses}<select value={selectedSpace} onChange={e=>setSelectedSpace(e.target.value)}>{studentSpaces.map(sp=><option key={sp.id} value={sp.id}>{courseTitle(sp.course_id)}</option>)}</select></label></AcademyField>
     {selected&&selected.student_id===userId&&<>
      <div className="space-progress"><span>{workspaceLabel(locale,"پیشرفت ثبت‌شده توسط استاد","Teacher-recorded progress")}</span><b>{selected.progress}%</b></div><div className="progress-bar"><i style={{width:String(selected.progress)+'%'}}/></div>
      <AcademyField locale={locale}><label>{t.goal}<textarea placeholder={workspaceLabel(locale,"مثال: تا پایان این دوره بتوانم مکالمه روزمره انجام دهم","e.g. Hold a basic everyday conversation by the end of this course")} value={goal} onChange={e=>setGoal(e.target.value)}/></label></AcademyField><button className="academy-primary small" onClick={saveGoal}>{t.saveGoal}</button>
     </>}
    </>}
   </article>

   {isAdmin&&<article className="academy-card"><h3>Admin</h3><p>Course, teacher and enrollment administration remains in Admin Studio.</p></article>}
  </div>}

  </div>
  <div hidden={panel!=='classroom'}>
  {selected&&<div className="academy-context-card"><strong>{courseTitle(selected.course_id)}</strong><span>{selected.teacher_id?teacherTitle(selected.teacher_id):''}</span>{!teacherOnly&&ownBookings.filter(b=>b.course_id===selected.course_id&&b.teacher_id===selected.teacher_id&&['confirmed','in_progress'].includes(b.status)&&b.confirmed_start&&new Date(b.confirmed_start).getTime()>=Date.now()-24*60*60*1000).sort((a,b)=>String(a.confirmed_start).localeCompare(String(b.confirmed_start))).slice(0,1).map(b=><div key={b.id}><small>{dt(b.confirmed_start)}</small><JoinMeetingLinks booking={b} locale={locale}/></div>)}</div>}
  <nav className="academy-portal-nav" aria-label={t.learning}>{([['notes',t.notes],['materials',t.materials],['messages',t.messages],...(!teacherOnly?([['progress',({fa:'پیشرفت و نتایج',en:'Progress & results',sv:'Framsteg och resultat',de:'Fortschritt und Ergebnisse'})[locale]]] as [ClassroomTool,string][]):[])] as [ClassroomTool,string][]).map(([id,label])=><button key={id} type="button" disabled={!selected} aria-pressed={classroomTool===id} onClick={()=>openClassroomTool(id)}>{label}</button>)}</nav>{!selected&&<p className="academy-empty">{t.noSpace}</p>}{classroomTool!=='home'&&<button type="button" className="academy-panel-back" onClick={()=>window.history.state?.academyClassroomTool?window.history.back():setClassroomTool('home')}>{({fa:'بازگشت به فضای یادگیری',en:'Back to learning space',sv:'Tillbaka till lärmiljön',de:'Zurück zum Lernraum'})[locale]}</button>}
  {selected&&<div className="academy-learning-columns academy-single-tool">
   <div hidden={classroomTool!=='notes'}><article className="academy-card">
    <h3>{t.notes}</h3>
    <AcademyField locale={locale}><label>{t.notes}<textarea aria-label={t.notes} placeholder={workspaceLabel(locale,"یادداشت خودت درباره درس یا جلسه را اینجا بنویس…","Write your own lesson note here…")} value={noteBody} onChange={e=>setNoteBody(e.target.value)} /></label></AcademyField>
    <AcademyField locale={locale}><label className="inline-check"><input type="checkbox" checked={shareNote} onChange={e=>setShareNote(e.target.checked)}/>{t.share}</label></AcademyField>
    <button className="academy-primary small" onClick={saveNote}>{t.saveNote}</button>
    <div className="note-list">{notes.map(n=><div key={n.id}><p>{n.body}</p><small>{n.visibility} · {dt(n.created_at)}</small>{n.author_id===userId&&<div className="academy-card-actions"><button onClick={()=>{setEditNoteId(n.id);setNoteBody(n.body);setShareNote(n.visibility==='shared')}}>{workspaceLabel(locale,"ویرایش / اشتراک","Edit / sharing")}</button><button onClick={()=>void run(async()=>{if(!window.confirm(workspaceLabel(locale,"این یادداشت حذف شود؟","Delete this note?")))return;const {error}=await supabase().from('academy_notes').delete().eq('id',n.id);if(error)throw error;setRefreshTick(x=>x+1)})}>{workspaceLabel(locale,"حذف","Delete")}</button></div>}</div>)}</div>
   </article></div>

   <div hidden={classroomTool!=='materials'}><article className="academy-card">
    <h3>{t.materials}</h3>
    {resources.length===0?<p>{t.noResources}</p>:resources.map(r=><div className="academy-resource" key={r.id}>
     <div className="academy-card-top"><span className="academy-badge">{r.kind==='homework'?t.homework:r.kind==='grammar'?'Grammar':r.kind==='lesson'?'Lesson':r.kind==='link'?'Link':t.material}</span><span>{academyStatus(r.student_status,locale)}</span></div>
     <strong>{r.title}</strong>{r.description&&<p>{r.description}</p>}{r.url&&<a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>}{r.due_at&&<small>{t.due}: {dt(r.due_at)}</small>}
     {r.kind==='homework'&&selected.student_id===userId&&r.student_status!=='completed'&&<><AcademyField locale={locale}><label>{t.response}<textarea aria-label={t.response} placeholder={t.response} value={resourceResponse[r.id]??r.student_response??''} onChange={e=>setResourceResponse({...resourceResponse,[r.id]:e.target.value})}/></label></AcademyField><button className="small-link" onClick={()=>submitHomework(r)}>{t.submit}</button></>}
     {r.student_response&&selectedIsTeacher&&<p style={{whiteSpace:'pre-wrap'}}><b>{t.response}:</b> {r.student_response}</p>}
     {r.kind==='grammar'&&selected.student_id===userId&&<button onClick={()=>navigateProduct('/grammar?academyLang='+encodeURIComponent(courseById.get(selected.course_id)?.subject_code??'')+'&academyResource='+r.id,{directApp:true})}>{workspaceLabel(locale,"افزودن به دفتر گرامر من","Add to my grammar notebook")}</button>}
     {r.teacher_feedback&&<p><b>{t.feedback}:</b> {r.teacher_feedback}</p>}
     {selectedIsTeacher&&r.kind==='homework'&&r.student_status==='submitted'&&<AcademyField locale={locale}><label>{t.feedback}<textarea placeholder={t.feedback} value={feedbackDraft[r.id]??r.teacher_feedback??''} onChange={e=>setFeedbackDraft({...feedbackDraft,[r.id]:e.target.value})}/></label></AcademyField>}
     {selectedIsTeacher&&<div className="academy-card-actions"><button onClick={()=>{openTeacherTool('resource');setResourceEditId(r.id);setResourceForm({kind:r.kind,title:r.title,description:r.description??'',url:r.url??'',due:r.due_at?new Date(new Date(r.due_at).getTime()-new Date(r.due_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''})}}>{workspaceLabel(locale,"ویرایش منبع","Edit resource")}</button><button onClick={()=>void run(async()=>{if(!window.confirm(workspaceLabel(locale,"این منبع حذف شود؟","Delete this resource?")))return;const {error}=await supabase().from('academy_resources').delete().eq('id',r.id);if(error)throw error;setRefreshTick(x=>x+1)})}>{workspaceLabel(locale,"حذف","Delete")}</button></div>}
     {selectedIsTeacher&&r.kind==='homework'&&r.student_status==='submitted'&&<button className="small-link" onClick={()=>completeResource(r)}>{t.markComplete}</button>}
    </div>)}
   </article></div>

   <div hidden={classroomTool!=='messages'}><article className="academy-card">
    <h3>{t.messages}</h3>
    <div className="academy-message-list">{messages.map(m=><div className={'academy-message '+(m.sender_id===userId?'mine':'theirs')} key={m.id}><p>{m.body}</p><small>{dt(m.created_at)}</small></div>)}</div>
    <AcademyField locale={locale}><label>{t.messages}<textarea aria-label={t.messages} placeholder={workspaceLabel(locale,"پیام برای عضو دیگر کلاس…","Write a message to the other classroom member…")} value={messageBody} onChange={e=>setMessageBody(e.target.value)} maxLength={5000}/></label></AcademyField>
    <button className="academy-primary small" onClick={sendMessage}>{t.send}</button>
   </article></div>
  </div>}

  {!teacherOnly&&selected&&selected.student_id===userId&&<div className="academy-learning-columns academy-learning-insights" hidden={classroomTool!=='progress'}>
   <article className="academy-card">
    <h3>{workspaceLabel(locale,"جمع‌بندی‌های استاد","Teacher summaries")}</h3>
    {selectedSummaries.length===0?<p>—</p>:selectedSummaries.map(s=><div className="academy-summary-item" key={s.id}>
     <strong>{dt(s.created_at)}</strong>{s.covered&&<p><b>{workspaceLabel(locale,"مطالب جلسه","Covered")}:</b> {s.covered}</p>}{s.grammar_focus&&<p><b>Grammar:</b> {s.grammar_focus}</p>}{s.strengths&&<p><b>{workspaceLabel(locale,"نقاط قوت","Strengths")}:</b> {s.strengths}</p>}{s.improve_next&&<p><b>{workspaceLabel(locale,"تمرکز برای بهبود","Improve")}:</b> {s.improve_next}</p>}{s.next_focus&&<p><b>{workspaceLabel(locale,"جلسه بعد","Next")}:</b> {s.next_focus}</p>}
    </div>)}
   </article>
   <article className="academy-card">
    <h3>{workspaceLabel(locale,"نتایج تست‌ها","Test results")}</h3>
    {selectedTests.length===0?<p>—</p>:selectedTests.map(x=><div className="personal-row" key={x.id}><div><strong>{x.title}</strong><small>{dt(x.taken_at)}</small>{x.teacher_summary&&<p>{x.teacher_summary}</p>}</div><b>{x.percent!=null?Math.round(x.percent)+'%':(x.score!=null?x.score+(x.max_score!=null?'/'+x.max_score:''):'—')}</b></div>)}
   </article>
   <article className="academy-card">
    <h3>{workspaceLabel(locale,"تقویم استاد","Teacher calendar")}</h3>
    {studentAvailability.length===0?<p>—</p>:<div className="academy-week-board">{studentAvailability.map(a=><div className={'academy-week-slot '+(a.status==='free'?'is-free':'is-booked')} key={a.id}><div><strong>{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date(a.starts_at))}</strong><span>{new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(a.starts_at))}</span></div><small>{a.status==='free'?(workspaceLabel(locale,"آزاد","Free")):(workspaceLabel(locale,"رزرو شده","Busy"))}</small></div>)}</div>}
   </article>
  </div>}

  </div>
  <div hidden={panel!=='teacher'}>
  {teacherOnly&&(selfTeacher||isAdmin)&&<section className="academy-teacher-desk">
   <div className="academy-teacher-summary">
    <div><p className="academy-kicker">{t.teacherDesk}</p><h2>{selfTeacher?.display_name??(workspaceLabel(locale,"مدیریت کلاس‌ها","Classroom management"))}</h2><p>{[selfTeacher?.email,selfTeacher?.phone].filter(Boolean).join(' · ')||'—'}</p></div>
    <div className="academy-tags">{teacherCourseIds.map(id=>courseById.get(id)).filter(Boolean).map(course=><span key={course!.id}>{subjectName(course!.subject_code)} · {course!.level_code}</span>)}</div>
    <div className="academy-card-actions">{selfTeacher?.email&&<a className="small-link" href={'mailto:'+selfTeacher.email}>Email</a>}{selfTeacher?.teams_chat_url&&<a className="small-link" href={selfTeacher.teams_chat_url} target="_blank" rel="noreferrer">Teams</a>}{selfTeacher?.telegram_url&&<a className="small-link" href={selfTeacher.telegram_url} target="_blank" rel="noreferrer">Telegram</a>}<button className="small-link" onClick={()=>navigateProduct('/grammar?academyLang='+encodeURIComponent(courseById.get(selected?.course_id??'')?.subject_code??''),{directApp:true})}>Grammar ↗</button></div>
   </div>
   <nav className="academy-portal-nav" aria-label={t.teacherDesk}>{([['availability',t.availability],['requests',t.sessionRequests],['plan',t.students],['summary',workspaceLabel(locale,'جمع‌بندی جلسه','Session summary & grammar')],['test',workspaceLabel(locale,'ثبت نتیجه تست','Record test result')],['resource',t.addResource]] as [TeacherTool,string][]).filter(([id])=>id!=='availability'||Boolean(selfTeacher)).map(([id,label])=><button key={id} type="button" aria-pressed={teacherTool===id} onClick={()=>openTeacherTool(id)}>{label}</button>)}</nav>{teacherTool!=='home'&&<button type="button" className="academy-panel-back" onClick={()=>window.history.state?.academyTeacherTool?window.history.back():setTeacherTool('home')}>{({fa:'بازگشت به ابزار استاد',en:'Back to teacher tools',sv:'Tillbaka till lärarverktyg',de:'Zurück zu Lehrwerkzeugen'})[locale]}</button>}
   <div className="academy-learning-columns academy-single-tool">
    <div hidden={teacherTool!=='availability'}><article className="academy-card" hidden={!selfTeacher}>
     <h3 id="academy-availability">{t.availability}</h3>
     <div className="academy-field-help"><label>{t.start}<input type="datetime-local" value={slotStart} onChange={e=>setSlotStart(e.target.value)}/></label><AcademyHelp locale={locale} text={{fa:'زمان شروع بازهٔ آزادی را که دانشجو می\u200cتواند درخواست کند انتخاب کنید.',en:'Choose the start of a time slot students may request.',sv:'Välj starttid för den lediga tid elever kan boka.',de:'Wählen Sie den Beginn eines verfügbaren Termins.'}}/></div>
     <div className="editor-two"><div className="academy-field-help"><label>{t.duration}<input placeholder="60" type="number" min="15" max="240" value={slotDuration} onChange={e=>setSlotDuration(e.target.value)}/></label><AcademyHelp locale={locale} text={{fa:'مدت هر جلسه را به دقیقه وارد کنید.',en:'Enter the session length in minutes.',sv:'Ange lektionens längd i minuter.',de:'Geben Sie die Dauer in Minuten ein.'}}/></div><div className="academy-field-help"><label>{t.mode}<select value={slotMode} onChange={e=>setSlotMode(e.target.value)}><option value="online">{t.online}</option><option value="offline">{t.offline}</option></select></label><AcademyHelp locale={locale} text={{fa:'نحوه برگزاری این بازه را مشخص کنید.',en:'Choose whether this time is online or in person.',sv:'Välj om tiden är online eller på plats.',de:'Wählen Sie online oder vor Ort.'}}/></div></div>
     <button className="academy-primary small" onClick={addSlot}>{t.addSlot}</button>
     <div className="academy-weekly-builder">
      <h4>{workspaceLabel(locale,"برنامه تکرارشونده هفتگی","Weekly recurring times")}</h4>
      <div className="academy-weekdays">{[1,2,3,4,5,6,0].map(day=><AcademyField locale={locale} key={day}><label key={day}><input type="checkbox" checked={weeklyDays.includes(day)} onChange={e=>setWeeklyDays(e.target.checked?[...weeklyDays,day]:weeklyDays.filter(x=>x!==day))}/>{weekdayLabel(day)}</label></AcademyField>)}</div>
      <div className="editor-two"><AcademyField locale={locale}><label>{workspaceLabel(locale,"از ساعت","From")}<input type="time" value={weeklyStart} onChange={e=>setWeeklyStart(e.target.value)}/></label></AcademyField><AcademyField locale={locale}><label>{workspaceLabel(locale,"تا ساعت","To")}<input type="time" value={weeklyEnd} onChange={e=>setWeeklyEnd(e.target.value)}/></label></AcademyField></div>
      <AcademyField locale={locale}><label>{workspaceLabel(locale,"برای چند هفته","Weeks")}<input placeholder="4" type="number" min="1" max="8" value={weeklyWeeks} onChange={e=>setWeeklyWeeks(e.target.value)}/></label></AcademyField>
      <button className="small-link" onClick={addWeeklySlots}>{workspaceLabel(locale,"ساخت زمان‌های هفتگی","Create weekly times")}</button>
     </div>
     <div className="academy-week-board">{availability.map(a=>{const booked=bookingByAvailability.get(a.id);const occupied=teacherCalendar.some(c=>c.status==='busy'&&new Date(c.starts_at)<new Date(a.ends_at)&&new Date(c.ends_at)>new Date(a.starts_at));return <div className={'academy-week-slot '+(booked||occupied?'is-booked':'is-free')} key={a.id}><div><strong>{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date(a.starts_at))}</strong><span>{new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(a.starts_at))}</span></div><small>{booked?(booked.student_display_name??t.student):(occupied?(workspaceLabel(locale,"رزرو شده","Busy")):a.status==='available'?'Free':a.status)}</small>{!booked&&!occupied&&a.status==='available'&&<button className="small-link" onClick={()=>removeSlot(a.id)}>{t.removeSlot}</button>}</div>})}</div>
    </article></div>

    <div hidden={teacherTool!=='requests'}><article className="academy-card">
     {selfTeacher&&<details className="academy-meeting-options">
      <summary>{workspaceLabel(locale,"لینک‌های ثابت کلاس","Reusable meeting links")}</summary>
      <p>{workspaceLabel(locale,"لینک‌های ثابت را فقط در رزروهای انتخابی به اشتراک بگذار.","Reuse these links on selected bookings.")}</p>
      <AcademyField locale={locale}><label>Teams<input type="url" disabled={!defaultsReady} placeholder="https://teams.microsoft.com/l/meetup-join/…" value={meetingDefaults.teams} onChange={e=>setMeetingDefaults({...meetingDefaults,teams:e.target.value})}/></label></AcademyField>
      <AcademyField locale={locale}><label>Zoom<input type="url" disabled={!defaultsReady} placeholder="https://zoom.us/my/your-room" value={meetingDefaults.zoom} onChange={e=>setMeetingDefaults({...meetingDefaults,zoom:e.target.value})}/></label></AcademyField>
      <button type="button" disabled={!defaultsReady} onClick={saveMeetingDefaults}>{workspaceLabel(locale,"ذخیره لینک‌های ثابت","Save reusable links")}</button>
     </details>}
     <h3>{t.sessionRequests}</h3>
     {teacherBookings.length===0?<p>—</p>:teacherBookings.map(b=>{
      const draft=bookingDraft[b.id]??{confirmed_start:b.confirmed_start?new Date(new Date(b.confirmed_start).getTime()-new Date(b.confirmed_start).getTimezoneOffset()*60000).toISOString().slice(0,16):'',teacher_note:b.teacher_note??'',duration_minutes:String(b.duration_minutes??60)}
      const links=meetingDrafts[b.id]??bookingMeetingDraft(b)
      const updateLinks=(patch:Partial<MeetingDraft>)=>setMeetingDrafts(previous=>({
       ...previous,[b.id]:{...(previous[b.id]??bookingMeetingDraft(b)),...patch},
      }))
      return <div className="academy-booking-admin" key={b.id}>
       <strong>{b.student_display_name??t.student}</strong><small>{courseTitle(b.course_id)} · {academyStatus(b.status,locale)}</small><small>{t.preferred}: {dt(b.preferred_start)}</small>{b.student_message&&<p>{b.student_message}</p>}
       <JoinMeetingLinks booking={b} locale={locale}/>
       {['requested','confirmed'].includes(b.status)&&<details className="academy-meeting-options">
        <summary>{workspaceLabel(locale,"لینک ورود به جلسه","Meeting links")}</summary>
        {defaultsReady&&(savedMeetingDefaults.teams||savedMeetingDefaults.zoom)&&<button type="button" onClick={()=>updateLinks(savedMeetingDefaults)}>{workspaceLabel(locale,"کپی لینک‌های ثابت","Use reusable links")}</button>}
        <AcademyField locale={locale}><label>Teams<input type="url" placeholder="https://teams.microsoft.com/l/meetup-join/…" value={links.teams} onChange={e=>updateLinks({teams:e.target.value})}/></label></AcademyField>
        <AcademyField locale={locale}><label>Zoom<input type="url" placeholder="https://zoom.us/j/123456789" value={links.zoom} onChange={e=>updateLinks({zoom:e.target.value})}/></label></AcademyField>
        <AcademyField locale={locale}><label>{workspaceLabel(locale,"سرویس اصلی","Primary service")}<select value={links.primary} onChange={e=>updateLinks({primary:e.target.value==='Zoom'?'Zoom':'Teams'})}><option>Teams</option><option>Zoom</option></select></label></AcademyField>
        {b.status==='confirmed'&&<button type="button" disabled={!meetingDrafts[b.id]} onClick={()=>void saveBookingLinks(b)}>{workspaceLabel(locale,"ذخیره لینک جلسه","Save meeting links")}</button>}
       </details>}
       {b.status==='requested'&&<><AcademyField locale={locale}><label>{t.when}<input type="datetime-local" value={draft.confirmed_start} onChange={e=>setBookingDraft({...bookingDraft,[b.id]:{...draft,confirmed_start:e.target.value}})}/></label></AcademyField><AcademyField locale={locale}><label>{t.teacherNote}<textarea placeholder={workspaceLabel(locale,"مثال: قبل از جلسه فصل ۳ را مرور کن","e.g. Review chapter 3 before the lesson")} value={draft.teacher_note} onChange={e=>setBookingDraft({...bookingDraft,[b.id]:{...draft,teacher_note:e.target.value}})}/></label></AcademyField><div className="academy-card-actions"><button className="academy-primary small" onClick={()=>updateBooking(b,'confirmed')}>{t.confirm}</button><button className="small-link" onClick={()=>updateBooking(b,'cancelled_teacher')}>{t.cancel}</button></div></>}
       {b.status==='confirmed'&&<div className="academy-card-actions"><button className="academy-primary small" onClick={()=>updateBooking(b,'completed')}>{t.complete}</button><button className="small-link" onClick={()=>updateBooking(b,'no_show')}>{t.noShow}</button><button className="small-link" onClick={()=>updateBooking(b,'cancelled_teacher')}>{t.cancel}</button></div>}
      </div>
     })}
    </article></div>

    <div hidden={teacherTool!=='plan'}><article className="academy-card">
     <h3>{t.students}</h3>
     {teacherSpaces.length===0?<p>—</p>:<><AcademyField locale={locale}><label>{t.students}<select value={teacherSpaces.some(x=>x.id===selectedSpace)?selectedSpace:''} onChange={e=>setSelectedSpace(e.target.value)}><option value="">—</option>{teacherSpaces.map(sp=><option value={sp.id} key={sp.id}>{sp.student_display_name??t.student} · {courseTitle(sp.course_id)}</option>)}</select></label></AcademyField>{selectedIsTeacher&&<>
      <AcademyField locale={locale}><label>{t.progress}<input placeholder="e.g. 45" type="number" min="0" max="100" value={teacherPlan.progress} onChange={e=>setTeacherPlan({...teacherPlan,progress:e.target.value})}/></label></AcademyField>
      <AcademyField locale={locale}><label>{t.goal}<textarea placeholder={workspaceLabel(locale,"هدف این دانشجو، مثال: رسیدن به A2","Student goal, e.g. reach A2")} value={teacherPlan.goal} onChange={e=>setTeacherPlan({...teacherPlan,goal:e.target.value})}/></label></AcademyField>
      <AcademyField locale={locale}><label>{t.nextTopics}<textarea placeholder={workspaceLabel(locale,"هر موضوع جلسه بعد در یک خط","One next-lesson topic per line")} value={teacherPlan.nextTopics} onChange={e=>setTeacherPlan({...teacherPlan,nextTopics:e.target.value})}/></label></AcademyField>
      <section className="academy-student-session-list"><h4>{({fa:'جلسات این دانشجو',en:'This student’s lessons',sv:'Elevens lektioner',de:'Unterricht dieser Person'})[locale]}</h4>{completedPrivateCount!==null&&<p><strong>{({fa:'جلسات خصوصی انجام‌شده',en:'Completed private lessons',sv:'Avslutade privatlektioner',de:'Abgeschlossene Einzelstunden'})[locale]}: {completedPrivateCount}</strong></p>}<small>{({fa:'نمایش حداکثر ۲۰۰ جلسهٔ اخیر خصوصی',en:'Showing up to 200 recent private lessons',sv:'Visar högst 200 senaste privatlektioner',de:'Bis zu 200 letzte Einzelstunden'})[locale]}</small>{selectedBookingsError&&<p role="alert">{selectedBookingsError}</p>}{selectedBookings.length===0&&!selectedBookingsError&&<p>—</p>}{selectedBookings.map(booking=><div className="academy-session-row" key={booking.id}><span>{dt(booking.confirmed_start??booking.preferred_start)} · {academyStatus(booking.status,locale)}</span>{booking.status==='confirmed'&&<button type="button" onClick={async()=>{await updateBooking(booking,'completed');setRefreshTick(n=>n+1)}}>{t.markComplete}</button>}</div>)}</section><button className="academy-primary small" onClick={saveTeacherPlan}>{t.savePlan}</button>
     </>}</>}
    </article></div>

    <div hidden={teacherTool!=='summary'}><article className="academy-card">
     <h3>{workspaceLabel(locale,"جمع‌بندی جلسه و گرامر","Session summary & grammar")}</h3>
     {!selectedIsTeacher?<p>{t.students}</p>:<>
      <AcademyField locale={locale}><label>{workspaceLabel(locale,"جلسهٔ مربوط","Related session")}<select value={summaryBooking} onChange={e=>{const id=e.target.value;setSummaryBooking(id);const prev=selectedSummaries.find(x=>x.booking_id===id);setSummaryEditId(prev?.id??'');setSummaryForm({covered:prev?.covered??'',grammar_focus:prev?.grammar_focus??'',strengths:prev?.strengths??'',improve_next:prev?.improve_next??'',next_focus:prev?.next_focus??''})}}><option value="">{workspaceLabel(locale,"یادداشت مستقل کلاس","Standalone classroom summary")}</option>{bookings.filter(b=>b.student_id===selected?.student_id&&b.course_id===selected?.course_id&&b.teacher_id===selected?.teacher_id&&['confirmed','completed'].includes(b.status)).map(b=><option key={b.id} value={b.id}>{dt(b.confirmed_start??b.preferred_start)} · {academyStatus(b.status,locale)}</option>)}</select></label></AcademyField>
      <AcademyField locale={locale}><label>{workspaceLabel(locale,"مطالب تدریس‌شده","Covered")}<textarea placeholder={workspaceLabel(locale,"مثال: افعال روزمره و ترتیب کلمات","e.g. Everyday verbs and word order")} value={summaryForm.covered} onChange={e=>setSummaryForm({...summaryForm,covered:e.target.value})}/></label></AcademyField>
      <AcademyField locale={locale}><label>Grammar<textarea placeholder={workspaceLabel(locale,"مثال: BIFF و جایگاه inte","e.g. BIFF rule and position of inte")} value={summaryForm.grammar_focus} onChange={e=>setSummaryForm({...summaryForm,grammar_focus:e.target.value})}/></label></AcademyField>
      <AcademyField locale={locale}><label>{workspaceLabel(locale,"نقاط قوت","Strengths")}<textarea placeholder={workspaceLabel(locale,"مثال: دایره لغات خوب و تلفظ واضح","e.g. Strong vocabulary and clear pronunciation")} value={summaryForm.strengths} onChange={e=>setSummaryForm({...summaryForm,strengths:e.target.value})}/></label></AcademyField>
      <AcademyField locale={locale}><label>{workspaceLabel(locale,"نیاز به بهبود","Improve next")}<textarea placeholder={workspaceLabel(locale,"مثال: تمرین بیشتر ترتیب کلمات","e.g. Practise word order more")} value={summaryForm.improve_next} onChange={e=>setSummaryForm({...summaryForm,improve_next:e.target.value})}/></label></AcademyField>
      <AcademyField locale={locale}><label>{workspaceLabel(locale,"تمرکز جلسه بعد","Next lesson")}<textarea placeholder={workspaceLabel(locale,"مثال: گذشته افعال و مکالمه خرید","e.g. Past tense and shopping dialogue")} value={summaryForm.next_focus} onChange={e=>setSummaryForm({...summaryForm,next_focus:e.target.value})}/></label></AcademyField>
      <button className="academy-primary small" onClick={saveSessionSummary}>{t.savePlan}</button>
      {selectedSummaries.map(s=><div className="academy-summary-item" key={s.id}><small>{dt(s.created_at)}</small><p>{s.next_focus||s.covered||'—'}</p>{s.teacher_id===selected?.teacher_id&&<button onClick={()=>{setSummaryEditId(s.id);setSummaryBooking(s.booking_id??'');setSummaryForm({covered:s.covered??'',grammar_focus:s.grammar_focus??'',strengths:s.strengths??'',improve_next:s.improve_next??'',next_focus:s.next_focus??''})}}>{workspaceLabel(locale,"ویرایش","Edit")}</button>}</div>)}
     </>}
    </article></div>

    <div hidden={teacherTool!=='test'}><article className="academy-card">
     <h3>{workspaceLabel(locale,"ثبت نتیجه تست","Record test result")}</h3>
     {!selectedIsTeacher?<p>{t.students}</p>:<>
      <AcademyField locale={locale}><label>{t.title}<input placeholder={workspaceLabel(locale,"مثال: آزمون A1 — درس ۴","e.g. A1 quiz — Lesson 4")} value={testForm.title} onChange={e=>setTestForm({...testForm,title:e.target.value})}/></label></AcademyField>
      <div className="editor-two"><AcademyField locale={locale}><label>{workspaceLabel(locale,"امتیاز","Score")}<input placeholder="e.g. 18" type="number" value={testForm.score} onChange={e=>setTestForm({...testForm,score:e.target.value})}/></label></AcademyField><AcademyField locale={locale}><label>{workspaceLabel(locale,"از","Max")}<input placeholder="e.g. 20" type="number" value={testForm.max_score} onChange={e=>setTestForm({...testForm,max_score:e.target.value})}/></label></AcademyField></div>
      <AcademyField locale={locale}><label>{t.feedback}<textarea placeholder={workspaceLabel(locale,"مثال: نتیجه خوب؛ روی صرف فعل بیشتر کار شود","e.g. Good result; practise verb conjugation next")} value={testForm.teacher_summary} onChange={e=>setTestForm({...testForm,teacher_summary:e.target.value})}/></label></AcademyField>
      <button className="academy-primary small" onClick={addTestResult}>{t.publish}</button>
      {selectedTests.map(x=><div className="personal-row" key={x.id}><span>{x.title}</span><b>{x.percent!=null?Math.round(x.percent)+'%':'—'}</b></div>)}
     </>}
    </article></div>

    <div hidden={teacherTool!=='resource'}><article className="academy-card">
     <h3>{t.addResource}</h3>
     {!selectedIsTeacher?<p>{t.students}</p>:<>
      <div className="academy-field-help"><label>{t.kind}<select value={resourceForm.kind} onChange={e=>setResourceForm({...resourceForm,kind:e.target.value})}><option value="material">{t.material}</option><option value="homework">{t.homework}</option><option value="lesson">Lesson note</option><option value="grammar">Grammar</option><option value="link">Useful link</option></select></label><AcademyHelp locale={locale} text={{fa:'نوع محتوایی را که برای دانشجو می\u200cفرستید مشخص کنید.',en:'Choose the type of content to share with the student.',sv:'Välj vilken typ av innehåll som ska delas med eleven.',de:'Wählen Sie die Art des Inhalts für den Lernenden.'}}/></div>
      <div className="academy-field-help"><label>{t.title}<input placeholder={workspaceLabel(locale,"مثال: تمرین درس ۵","e.g. Lesson 5 homework")} value={resourceForm.title} onChange={e=>setResourceForm({...resourceForm,title:e.target.value})}/></label><AcademyHelp locale={locale} text={{fa:'عنوانی برای تکلیف یا منبع بنویسید.',en:'Enter a title for the assignment or resource.',sv:'Ange en titel för läxan eller materialet.',de:'Geben Sie einen Titel für Aufgabe oder Material ein.'}}/></div>
      <AcademyField locale={locale}><label>{t.description}<textarea placeholder={workspaceLabel(locale,"توضیح کوتاه درباره تکلیف، گرامر یا منبع","Short instructions for this homework, grammar note or resource")} value={resourceForm.description} onChange={e=>setResourceForm({...resourceForm,description:e.target.value})}/></label></AcademyField>
      <div className="academy-field-help"><label>{t.url}<input placeholder="https://example.com/resource" value={resourceForm.url} onChange={e=>setResourceForm({...resourceForm,url:e.target.value})}/></label><AcademyHelp locale={locale} text={{fa:'لینک منبع را در صورت نیاز وارد کنید.',en:'Optionally enter the resource link.',sv:'Ange vid behov en länk till materialet.',de:'Geben Sie bei Bedarf den Link zum Material ein.'}}/></div>
      {resourceForm.kind==='homework'&&<div className="academy-field-help"><label>{t.due}<input type="datetime-local" value={resourceForm.due} onChange={e=>setResourceForm({...resourceForm,due:e.target.value})}/></label><AcademyHelp locale={locale} text={{fa:'مهلت ارسال تکلیف را انتخاب کنید.',en:'Choose when the assignment is due.',sv:'Välj sista tid för inlämning.',de:'Wählen Sie den Abgabetermin.'}}/></div>}
      <button className="academy-primary small" onClick={addResource}>{t.publish}</button>
     </>}
    </article></div>
   </div>
  </section>}
 </div>
 </fieldset></div>
}
