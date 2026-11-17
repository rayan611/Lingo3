import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../auth/supabase'
import { navigateProduct } from '../lib/productNavigation'

type Locale = 'en' | 'sv' | 'fa' | 'de'
type Course = { id:string; subject_code:string; level_code:string; title_i18n:Record<string,string> }
type Teacher = { id:string; user_id:string|null; display_name:string; email?:string|null; phone?:string|null; teams_chat_url?:string|null; teams_call_url?:string|null; telegram_url?:string|null }
type Enrollment = { id:string; student_id:string; course_id:string; teacher_id:string|null; status:string }
type Space = {
  id:string
  enrollment_id:string|null
  student_id:string
  student_display_name:string|null
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
  teacher_id:string
  course_id:string|null
  availability_id:string|null
  session_type:string
  preferred_start:string|null
  confirmed_start:string|null
  duration_minutes:number|null
  status:string
  meeting_url:string|null
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

export function AcademyPortal({
 locale,userId,courses,teachers,selfTeacher,teacherCourseIds,isAdmin,onNotice
}:{
 locale:Locale
 userId:string
 courses:Course[]
 teachers:Teacher[]
 selfTeacher:Teacher|undefined
 teacherCourseIds:string[]
 isAdmin:boolean
 onNotice:(message:string)=>void
}){
 const t=copy[locale]
 const [enrollments,setEnrollments]=useState<Enrollment[]>([])
 const [studentSpaces,setStudentSpaces]=useState<Space[]>([])
 const [teacherSpaces,setTeacherSpaces]=useState<Space[]>([])
 const [bookings,setBookings]=useState<Booking[]>([])
 const [availability,setAvailability]=useState<Availability[]>([])
 const [dashboardResources,setDashboardResources]=useState<Resource[]>([])
 const [dashboardNotes,setDashboardNotes]=useState<Note[]>([])
 const [testResults,setTestResults]=useState<TestResult[]>([])
 const [dashboardSummaries,setDashboardSummaries]=useState<SessionSummary[]>([])
 const [selectedSummaries,setSelectedSummaries]=useState<SessionSummary[]>([])
 const [selectedTests,setSelectedTests]=useState<TestResult[]>([])
 const [studentAvailability,setStudentAvailability]=useState<Availability[]>([])
 const [selectedSpace,setSelectedSpace]=useState('')
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
 const [bookingDraft,setBookingDraft]=useState<Record<string,{confirmed_start:string;meeting_url:string;teacher_note:string;duration_minutes:string}>>({})
 const [busy,setBusy]=useState(false)

 const courseById=useMemo(()=>new Map(courses.map(c=>[c.id,c])),[courses])
 const teacherById=useMemo(()=>new Map(teachers.map(x=>[x.id,x])),[teachers])
 const ownBookings=bookings.filter(x=>x.student_id===userId)
 const teacherBookings=selfTeacher?bookings.filter(x=>x.teacher_id===selfTeacher.id):[]
 const selected=[...studentSpaces,...teacherSpaces].find(x=>x.id===selectedSpace)
 const selectedIsTeacher=Boolean(selected&&selfTeacher&&selected.teacher_id===selfTeacher.id&&selected.student_id!==userId)
 const teacherOnly=Boolean(selfTeacher&&!isAdmin)
 const bookingByAvailability=useMemo(()=>new Map(teacherBookings.filter(b=>b.availability_id).map(b=>[b.availability_id!,b])),[teacherBookings])
 const subjectName=(code:string)=>({sv:{en:'Swedish',sv:'Svenska',de:'Schwedisch',fa:'سوئدی'},en:{en:'English',sv:'Engelska',de:'Englisch',fa:'انگلیسی'},de:{en:'German',sv:'Tyska',de:'Deutsch',fa:'آلمانی'},fa:{en:'Persian',sv:'Persiska',de:'Persisch',fa:'فارسی'}} as any)[code]?.[locale]??code.toUpperCase()

 async function refresh(){
  const client=supabase()
  const reqs:PromiseLike<any>[]=[
   client.from('academy_enrollments').select('*').eq('student_id',userId).order('created_at',{ascending:false}),
   client.from('academy_learning_spaces').select('*').eq('student_id',userId).order('created_at',{ascending:false}),
   client.from('academy_bookings').select('*').order('created_at',{ascending:false}).limit(200),
  ]
  if(selfTeacher){
   reqs.push(client.from('academy_learning_spaces').select('*').eq('teacher_id',selfTeacher.id).order('created_at',{ascending:false}))
   reqs.push(client.from('academy_availability').select('*').eq('teacher_id',selfTeacher.id).gte('ends_at',new Date().toISOString()).order('starts_at').limit(100))
  }
  const results=await Promise.all(reqs)
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
   setDashboardResources((rr.data??[]) as Resource[])
   setDashboardNotes((nn.data??[]) as Note[])
   setTestResults(tr.error?[]:((tr.data??[]) as TestResult[]))
   setDashboardSummaries(sr.error?[]:((sr.data??[]) as SessionSummary[]))
  }else{setDashboardResources([]);setDashboardNotes([]);setTestResults([]);setDashboardSummaries([])}
  const taughtSpaces=selfTeacher?((results[3].data??[]) as Space[]):[]
  const slots=selfTeacher?((results[4].data??[]) as Availability[]):[]
  setTeacherSpaces(taughtSpaces.filter(x=>x.student_id!==userId))
  setAvailability(slots)
  const taught=taughtSpaces.filter(x=>x.student_id!==userId)
  const all=teacherOnly?taught:[...ownSpaces,...taught]
  if(!selectedSpace&&all[0])setSelectedSpace(all[0].id)
  if(selectedSpace&&!all.some(x=>x.id===selectedSpace))setSelectedSpace(all[0]?.id??'')
 }

 useEffect(()=>{void refresh()},[userId,selfTeacher?.id])

 useEffect(()=>{
  if(!selectedSpace){setNotes([]);setResources([]);setMessages([]);setSelectedSummaries([]);setSelectedTests([]);setStudentAvailability([]);return}
  let cancelled=false
  const space=[...studentSpaces,...teacherSpaces].find(x=>x.id===selectedSpace)
  const availabilityReq=space?.teacher_id&&space.student_id===userId
    ? supabase().rpc('academy_teacher_calendar',{p_teacher_id:space.teacher_id,p_from:new Date().toISOString(),p_to:new Date(Date.now()+60*86400000).toISOString()})
    : Promise.resolve({data:[],error:null})
  Promise.all([
   supabase().from('academy_notes').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).limit(50),
   supabase().from('academy_resources').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).limit(100),
   supabase().from('academy_messages').select('*').eq('learning_space_id',selectedSpace).order('created_at').limit(200),
   supabase().from('academy_session_summaries').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).limit(20),
   supabase().from('academy_test_results').select('*').eq('learning_space_id',selectedSpace).order('taken_at',{ascending:false}).limit(30),
   availabilityReq,
  ]).then(([n,r,m,summaries,tests,slots])=>{
   if(cancelled)return
   setNotes((n.data??[]) as Note[])
   setResources((r.data??[]) as Resource[])
   setSelectedSummaries(summaries.error?[]:((summaries.data??[]) as SessionSummary[]))
   setSelectedTests(tests.error?[]:((tests.data??[]) as TestResult[]))
   setStudentAvailability((slots.data??[]) as Availability[])
   const msg=(m.data??[]) as Message[]
   setMessages(msg)
   const unread=msg.filter(x=>x.recipient_id===userId&&!x.read_at).map(x=>x.id)
   if(unread.length)void supabase().from('academy_messages').update({read_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',unread)
  })
  return()=>{cancelled=true}
 },[selectedSpace,userId,studentSpaces,teacherSpaces])

 useEffect(()=>{
  if(!selected)return
  setGoal(selected.goal??'')
  setTeacherPlan({progress:String(selected.progress??0),nextTopics:(selected.next_session_topics??[]).join('\n'),goal:selected.goal??''})
 },[selectedSpace,selected?.progress,selected?.goal])

 async function run(action:()=>Promise<void>){
  if(busy)return
  setBusy(true)
  try{await action()}catch(error){onNotice(error instanceof Error?error.message:String(error))}
  finally{setBusy(false)}
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
   const {error}=await supabase().from('academy_notes').insert({learning_space_id:selected.id,author_id:userId,body:noteBody.trim(),visibility:shareNote?'shared':'private'})
   if(error)throw error
   setNoteBody('');onNotice(t.saved)
   const {data}=await supabase().from('academy_notes').select('*').eq('learning_space_id',selected.id).order('created_at',{ascending:false}).limit(50)
   setNotes((data??[]) as Note[])
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
   const {data}=await supabase().from('academy_resources').select('*').eq('learning_space_id',resource.learning_space_id).order('created_at',{ascending:false})
   setResources((data??[]) as Resource[])
  })
 }

 async function sendMessage(){
  if(!selected||!messageBody.trim())return
  const teacher=selected.teacher_id?teacherById.get(selected.teacher_id):undefined
  const recipient=selected.student_id===userId?teacher?.user_id:selected.student_id
  if(!recipient){onNotice('The other Academy member is not linked to a Lingo3 account yet.');return}
  await run(async()=>{
   const {error}=await supabase().from('academy_messages').insert({learning_space_id:selected.id,sender_id:userId,recipient_id:recipient,body:messageBody.trim()})
   if(error)throw error
   setMessageBody('');onNotice(t.sent)
   const {data}=await supabase().from('academy_messages').select('*').eq('learning_space_id',selected.id).order('created_at')
   setMessages((data??[]) as Message[])
  })
 }

 function weekdayLabel(day:number){const d=new Date(2026,10,15+day);return new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(d)}
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
  if(rows.length===0){onNotice(locale==='fa'?'زمان جدیدی برای ساختن وجود ندارد.':'No new times to create.');return}
  await run(async()=>{
   const {error}=await supabase().from('academy_availability').insert(rows)
   if(error)throw error
   onNotice(String(rows.length)+' '+t.saved);await refresh()
  })
 }

 async function addSlot(){
  if(!selfTeacher||!slotStart)return
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

 async function updateBooking(booking:Booking,status:string){
  const draft=bookingDraft[booking.id]??{confirmed_start:'',meeting_url:'',teacher_note:'',duration_minutes:'60'}
  await run(async()=>{
   const payload:any={status,updated_at:new Date().toISOString()}
   if(status==='confirmed'){
    payload.confirmed_start=draft.confirmed_start?toIso(draft.confirmed_start):(booking.preferred_start??new Date().toISOString())
    payload.duration_minutes=Number(draft.duration_minutes)||60
    payload.meeting_url=draft.meeting_url.trim()||null
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
  if(!selected||!selectedIsTeacher||!selfTeacher||!resourceForm.title.trim())return
  await run(async()=>{
   const {error}=await supabase().from('academy_resources').insert({
    learning_space_id:selected.id,teacher_id:selfTeacher.id,kind:resourceForm.kind,title:resourceForm.title.trim(),
    description:resourceForm.description.trim()||null,url:resourceForm.url.trim()||null,due_at:resourceForm.due?toIso(resourceForm.due):null,
   })
   if(error)throw error
   setResourceForm({kind:'material',title:'',description:'',url:'',due:''});onNotice(t.saved)
   const {data}=await supabase().from('academy_resources').select('*').eq('learning_space_id',selected.id).order('created_at',{ascending:false})
   setResources((data??[]) as Resource[])
  })
 }

 async function completeResource(resource:Resource){
  await run(async()=>{
   const feedback=window.prompt(t.feedback,resource.teacher_feedback??'')??resource.teacher_feedback
   const {error}=await supabase().from('academy_resources').update({student_status:'completed',teacher_feedback:feedback||null,updated_at:new Date().toISOString()}).eq('id',resource.id)
   if(error)throw error
   onNotice(t.saved)
   const {data}=await supabase().from('academy_resources').select('*').eq('learning_space_id',resource.learning_space_id).order('created_at',{ascending:false})
   setResources((data??[]) as Resource[])
  })
 }

 async function saveSessionSummary(){
  if(!selected||!selectedIsTeacher||!selfTeacher)return
  const hasText=Object.values(summaryForm).some(v=>v.trim())
  if(!hasText)return
  const related=teacherBookings.filter(b=>b.student_id===selected.student_id&&b.course_id===selected.course_id&&['completed','confirmed'].includes(b.status))
    .sort((a,b)=>new Date(b.confirmed_start??b.preferred_start??0).getTime()-new Date(a.confirmed_start??a.preferred_start??0).getTime())[0]
  await run(async()=>{
   const payload={
    learning_space_id:selected.id,booking_id:related?.id??null,teacher_id:selfTeacher.id,student_id:selected.student_id,
    covered:summaryForm.covered.trim()||null,grammar_focus:summaryForm.grammar_focus.trim()||null,
    strengths:summaryForm.strengths.trim()||null,improve_next:summaryForm.improve_next.trim()||null,next_focus:summaryForm.next_focus.trim()||null,
    updated_at:new Date().toISOString(),
   }
   let error
   if(related?.id){
    const existing=selectedSummaries.find(x=>x.booking_id===related.id)
    if(existing)({error}=await supabase().from('academy_session_summaries').update(payload).eq('id',existing.id))
    else ({error}=await supabase().from('academy_session_summaries').insert(payload))
   }else ({error}=await supabase().from('academy_session_summaries').insert(payload))
   if(error)throw error
   setSummaryForm({covered:'',grammar_focus:'',strengths:'',improve_next:'',next_focus:''});onNotice(t.saved)
   const {data}=await supabase().from('academy_session_summaries').select('*').eq('learning_space_id',selected.id).order('created_at',{ascending:false}).limit(20)
   setSelectedSummaries((data??[]) as SessionSummary[])
  })
 }

 async function addTestResult(){
  if(!selected||!selectedIsTeacher||!selfTeacher||!testForm.title.trim())return
  await run(async()=>{
   const {error}=await supabase().from('academy_test_results').insert({
    learning_space_id:selected.id,teacher_id:selfTeacher.id,student_id:selected.student_id,title:testForm.title.trim(),kind:testForm.kind,
    score:testForm.score===''?null:Number(testForm.score),max_score:testForm.max_score===''?null:Number(testForm.max_score),
    teacher_summary:testForm.teacher_summary.trim()||null,
   })
   if(error)throw error
   setTestForm({title:'',kind:'test',score:'',max_score:'',teacher_summary:''});onNotice(t.saved)
   const {data}=await supabase().from('academy_test_results').select('*').eq('learning_space_id',selected.id).order('taken_at',{ascending:false}).limit(30)
   setSelectedTests((data??[]) as TestResult[])
  })
 }

 const courseTitle=(id:string|null)=>id?(courseById.get(id)?i18n(courseById.get(id)!.title_i18n,locale):id):'—'
 const teacherTitle=(id:string)=>teacherById.get(id)?.display_name??'Teacher'

 return <div className="academy-portal">
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
       <div className="space-progress"><span>{t.progress}</span><b>{sp.progress}%</b></div><div className="progress-bar"><i style={{width:String(sp.progress)+'%'}}/></div>
       <dl className="academy-dashboard-facts">
        <div><dt>{locale==='fa'?'آخرین جلسه':locale==='sv'?'Senaste lektion':'Last session'}</dt><dd>{past?dt(past.confirmed_start??past.preferred_start):'—'}</dd></div>
        <div><dt>{locale==='fa'?'جلسه بعد':locale==='sv'?'Nästa lektion':'Next session'}</dt><dd>{next?dt(next.confirmed_start??next.preferred_start):'—'}</dd></div>
        <div><dt>{locale==='fa'?'جمع‌بندی استاد':locale==='sv'?'Lärarens senaste notering':'Latest teacher summary'}</dt><dd>{lastSummary?.next_focus||lastSummary?.covered||past?.teacher_note||'—'}</dd></div>
        <div><dt>{t.homework}</dt><dd>{open} {locale==='fa'?'باز':'open'}</dd></div>
        <div><dt>{t.notes}</dt><dd>{ownNoteCount}</dd></div>
        <div><dt>{locale==='fa'?'آخرین تست':'Latest test'}</dt><dd>{lastTest?(lastTest.percent!=null?Math.round(lastTest.percent)+'%':lastTest.title):'—'}</dd></div>
       </dl>
       <div className="academy-card-actions" onClick={e=>e.stopPropagation()}>
        <button className="small-link" onClick={()=>navigateProduct('/words',{directApp:true})}>{locale==='fa'?'لغات':'Words ↗'}</button>
        <button className="small-link" onClick={()=>navigateProduct('/grammar',{directApp:true})}>{locale==='fa'?'گرامر':'Grammar ↗'}</button>
       </div>
      </article>
    })}
   </div>
  </section>}
  {!teacherOnly&&<div className="academy-personal-grid">
   <article className="academy-card">
    <h3>{t.myCourses}</h3>
    {enrollments.length===0?<p>—</p>:enrollments.map(e=><div className="personal-row" key={e.id}><span>{courseTitle(e.course_id)}</span><b>{e.status}</b></div>)}
   </article>

   <article className="academy-card">
    <h3>{t.bookings}</h3>
    {ownBookings.length===0?<p>{t.noBookings}</p>:ownBookings.map(b=><div className="academy-session-row" key={b.id}>
     <div><strong>{teacherTitle(b.teacher_id)}</strong><small>{courseTitle(b.course_id)}</small></div>
     <div><span>{b.confirmed_start?t.confirmed:t.preferred}: {dt(b.confirmed_start??b.preferred_start)}</span><small>{b.status}</small></div>
     <div className="academy-card-actions">{b.meeting_url&&<a className="small-link" href={b.meeting_url} target="_blank" rel="noreferrer">{t.meeting}</a>}{['requested','confirmed'].includes(b.status)&&<button className="small-link" onClick={()=>cancelBooking(b.id)}>{t.cancel}</button>}</div>
    </div>)}
   </article>

   <article className="academy-card academy-learning-workspace">
    <h3>{t.learning}</h3>
    {studentSpaces.length===0?<p>{t.noSpace}</p>:<>
     <label>{t.myCourses}<select value={selectedSpace} onChange={e=>setSelectedSpace(e.target.value)}>{studentSpaces.map(sp=><option key={sp.id} value={sp.id}>{courseTitle(sp.course_id)}</option>)}</select></label>
     {selected&&selected.student_id===userId&&<>
      <div className="space-progress"><span>{t.progress}</span><b>{selected.progress}%</b></div><div className="progress-bar"><i style={{width:String(selected.progress)+'%'}}/></div>
      <label>{t.goal}<textarea value={goal} onChange={e=>setGoal(e.target.value)}/></label><button className="academy-primary small" onClick={saveGoal}>{t.saveGoal}</button>
     </>}
    </>}
   </article>

   {isAdmin&&<article className="academy-card"><h3>Admin</h3><p>Course, teacher and enrollment administration remains in Admin Studio.</p></article>}
  </div>}

  {!teacherOnly&&selected&&<div className="academy-learning-columns">
   <article className="academy-card">
    <h3>{t.notes}</h3>
    <textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} />
    <label className="inline-check"><input type="checkbox" checked={shareNote} onChange={e=>setShareNote(e.target.checked)}/>{t.share}</label>
    <button className="academy-primary small" onClick={saveNote}>{t.saveNote}</button>
    <div className="note-list">{notes.slice(0,8).map(n=><div key={n.id}><p>{n.body}</p><small>{n.visibility} · {dt(n.created_at)}</small></div>)}</div>
   </article>

   <article className="academy-card">
    <h3>{t.materials}</h3>
    {resources.length===0?<p>{t.noResources}</p>:resources.map(r=><div className="academy-resource" key={r.id}>
     <div className="academy-card-top"><span className="academy-badge">{r.kind==='homework'?t.homework:r.kind==='grammar'?'Grammar':r.kind==='lesson'?'Lesson':r.kind==='link'?'Link':t.material}</span><span>{r.student_status}</span></div>
     <strong>{r.title}</strong>{r.description&&<p>{r.description}</p>}{r.url&&<a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>}{r.due_at&&<small>{t.due}: {dt(r.due_at)}</small>}
     {r.kind==='homework'&&selected.student_id===userId&&r.student_status!=='completed'&&<><textarea placeholder={t.response} value={resourceResponse[r.id]??r.student_response??''} onChange={e=>setResourceResponse({...resourceResponse,[r.id]:e.target.value})}/><button className="small-link" onClick={()=>submitHomework(r)}>{t.submit}</button></>}
     {r.teacher_feedback&&<p><b>{t.feedback}:</b> {r.teacher_feedback}</p>}
     {selectedIsTeacher&&r.kind==='homework'&&r.student_status==='submitted'&&<button className="small-link" onClick={()=>completeResource(r)}>{t.markComplete}</button>}
    </div>)}
   </article>

   <article className="academy-card">
    <h3>{t.messages}</h3>
    <div className="academy-message-list">{messages.map(m=><div className={'academy-message '+(m.sender_id===userId?'mine':'theirs')} key={m.id}><p>{m.body}</p><small>{dt(m.created_at)}</small></div>)}</div>
    <textarea value={messageBody} onChange={e=>setMessageBody(e.target.value)} maxLength={5000}/>
    <button className="academy-primary small" onClick={sendMessage}>{t.send}</button>
   </article>
  </div>}

  {!teacherOnly&&selected&&selected.student_id===userId&&<div className="academy-learning-columns academy-learning-insights">
   <article className="academy-card">
    <h3>{locale==='fa'?'جمع‌بندی‌های استاد':'Teacher summaries'}</h3>
    {selectedSummaries.length===0?<p>—</p>:selectedSummaries.slice(0,5).map(s=><div className="academy-summary-item" key={s.id}>
     <strong>{dt(s.created_at)}</strong>{s.covered&&<p><b>{locale==='fa'?'مطالب جلسه':'Covered'}:</b> {s.covered}</p>}{s.grammar_focus&&<p><b>Grammar:</b> {s.grammar_focus}</p>}{s.strengths&&<p><b>{locale==='fa'?'نقاط قوت':'Strengths'}:</b> {s.strengths}</p>}{s.improve_next&&<p><b>{locale==='fa'?'تمرکز برای بهبود':'Improve'}:</b> {s.improve_next}</p>}{s.next_focus&&<p><b>{locale==='fa'?'جلسه بعد':'Next'}:</b> {s.next_focus}</p>}
    </div>)}
   </article>
   <article className="academy-card">
    <h3>{locale==='fa'?'نتایج تست‌ها':'Test results'}</h3>
    {selectedTests.length===0?<p>—</p>:selectedTests.slice(0,8).map(x=><div className="personal-row" key={x.id}><div><strong>{x.title}</strong><small>{dt(x.taken_at)}</small></div><b>{x.percent!=null?Math.round(x.percent)+'%':(x.score!=null?x.score+(x.max_score!=null?'/'+x.max_score:''):'—')}</b></div>)}
   </article>
   <article className="academy-card">
    <h3>{locale==='fa'?'تقویم استاد':'Teacher calendar'}</h3>
    {studentAvailability.length===0?<p>—</p>:<div className="academy-week-board">{studentAvailability.slice(0,16).map(a=><div className={'academy-week-slot '+(a.status==='free'?'is-free':'is-booked')} key={a.id}><div><strong>{new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(new Date(a.starts_at))}</strong><span>{new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(a.starts_at))}</span></div><small>{a.status==='free'?(locale==='fa'?'آزاد':'Free'):(locale==='fa'?'رزرو شده':'Busy')}</small></div>)}</div>}
   </article>
  </div>}

  {selfTeacher&&<section className="academy-teacher-desk">
   <div className="academy-teacher-summary">
    <div><p className="academy-kicker">{t.teacherDesk}</p><h2>{selfTeacher.display_name}</h2><p>{[selfTeacher.email,selfTeacher.phone].filter(Boolean).join(' · ')||'—'}</p></div>
    <div className="academy-tags">{teacherCourseIds.map(id=>courseById.get(id)).filter(Boolean).map(course=><span key={course!.id}>{subjectName(course!.subject_code)} · {course!.level_code}</span>)}</div>
    <div className="academy-card-actions">{selfTeacher.email&&<a className="small-link" href={'mailto:'+selfTeacher.email}>Email</a>}{selfTeacher.teams_chat_url&&<a className="small-link" href={selfTeacher.teams_chat_url} target="_blank" rel="noreferrer">Teams</a>}{selfTeacher.telegram_url&&<a className="small-link" href={selfTeacher.telegram_url} target="_blank" rel="noreferrer">Telegram</a>}<button className="small-link" onClick={()=>navigateProduct('/grammar',{directApp:true})}>Grammar ↗</button></div>
   </div>
   <div className="academy-learning-columns">
    <article className="academy-card">
     <h3>{t.availability}</h3>
     <label>{t.start}<input type="datetime-local" value={slotStart} onChange={e=>setSlotStart(e.target.value)}/></label>
     <div className="editor-two"><label>{t.duration}<input type="number" min="15" max="240" value={slotDuration} onChange={e=>setSlotDuration(e.target.value)}/></label><label>{t.mode}<select value={slotMode} onChange={e=>setSlotMode(e.target.value)}><option value="online">{t.online}</option><option value="offline">{t.offline}</option></select></label></div>
     <button className="academy-primary small" onClick={addSlot}>{t.addSlot}</button>
     <div className="academy-weekly-builder">
      <h4>{locale==='fa'?'برنامه تکرارشونده هفتگی':'Weekly recurring times'}</h4>
      <div className="academy-weekdays">{[1,2,3,4,5,6,0].map(day=><label key={day}><input type="checkbox" checked={weeklyDays.includes(day)} onChange={e=>setWeeklyDays(e.target.checked?[...weeklyDays,day]:weeklyDays.filter(x=>x!==day))}/>{weekdayLabel(day)}</label>)}</div>
      <div className="editor-two"><label>{locale==='fa'?'از ساعت':'From'}<input type="time" value={weeklyStart} onChange={e=>setWeeklyStart(e.target.value)}/></label><label>{locale==='fa'?'تا ساعت':'To'}<input type="time" value={weeklyEnd} onChange={e=>setWeeklyEnd(e.target.value)}/></label></div>
      <label>{locale==='fa'?'برای چند هفته':'Weeks'}<input type="number" min="1" max="8" value={weeklyWeeks} onChange={e=>setWeeklyWeeks(e.target.value)}/></label>
      <button className="small-link" onClick={addWeeklySlots}>{locale==='fa'?'ساخت زمان‌های هفتگی':'Create weekly times'}</button>
     </div>
     <div className="academy-week-board">{availability.map(a=>{const booked=bookingByAvailability.get(a.id);return <div className={'academy-week-slot '+(booked?'is-booked':'is-free')} key={a.id}><div><strong>{new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(new Date(a.starts_at))}</strong><span>{new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(a.starts_at))}</span></div><small>{booked?(booked.student_display_name??t.student):(a.status==='available'?'Free':a.status)}</small>{!booked&&a.status==='available'&&<button className="small-link" onClick={()=>removeSlot(a.id)}>{t.removeSlot}</button>}</div>})}</div>
    </article>

    <article className="academy-card">
     <h3>{t.sessionRequests}</h3>
     {teacherBookings.length===0?<p>—</p>:teacherBookings.map(b=>{
      const draft=bookingDraft[b.id]??{confirmed_start:b.confirmed_start?new Date(b.confirmed_start).toISOString().slice(0,16):'',meeting_url:b.meeting_url??'',teacher_note:b.teacher_note??'',duration_minutes:String(b.duration_minutes??60)}
      return <div className="academy-booking-admin" key={b.id}>
       <strong>{b.student_display_name??t.student}</strong><small>{courseTitle(b.course_id)} · {b.status}</small><small>{t.preferred}: {dt(b.preferred_start)}</small>{b.student_message&&<p>{b.student_message}</p>}
       {b.status==='requested'&&<><label>{t.when}<input type="datetime-local" value={draft.confirmed_start} onChange={e=>setBookingDraft({...bookingDraft,[b.id]:{...draft,confirmed_start:e.target.value}})}/></label><label>{t.meetingLink}<input value={draft.meeting_url} onChange={e=>setBookingDraft({...bookingDraft,[b.id]:{...draft,meeting_url:e.target.value}})}/></label><label>{t.teacherNote}<textarea value={draft.teacher_note} onChange={e=>setBookingDraft({...bookingDraft,[b.id]:{...draft,teacher_note:e.target.value}})}/></label><div className="academy-card-actions"><button className="academy-primary small" onClick={()=>updateBooking(b,'confirmed')}>{t.confirm}</button><button className="small-link" onClick={()=>updateBooking(b,'cancelled_teacher')}>{t.cancel}</button></div></>}
       {b.status==='confirmed'&&<div className="academy-card-actions"><button className="academy-primary small" onClick={()=>updateBooking(b,'completed')}>{t.complete}</button><button className="small-link" onClick={()=>updateBooking(b,'no_show')}>{t.noShow}</button><button className="small-link" onClick={()=>updateBooking(b,'cancelled_teacher')}>{t.cancel}</button></div>}
      </div>
     })}
    </article>

    <article className="academy-card">
     <h3>{t.students}</h3>
     {teacherSpaces.length===0?<p>—</p>:<><select value={teacherSpaces.some(x=>x.id===selectedSpace)?selectedSpace:''} onChange={e=>setSelectedSpace(e.target.value)}><option value="">—</option>{teacherSpaces.map(sp=><option value={sp.id} key={sp.id}>{sp.student_display_name??t.student} · {courseTitle(sp.course_id)}</option>)}</select>{selectedIsTeacher&&<>
      <label>{t.progress}<input type="number" min="0" max="100" value={teacherPlan.progress} onChange={e=>setTeacherPlan({...teacherPlan,progress:e.target.value})}/></label>
      <label>{t.goal}<textarea value={teacherPlan.goal} onChange={e=>setTeacherPlan({...teacherPlan,goal:e.target.value})}/></label>
      <label>{t.nextTopics}<textarea value={teacherPlan.nextTopics} onChange={e=>setTeacherPlan({...teacherPlan,nextTopics:e.target.value})}/></label>
      <button className="academy-primary small" onClick={saveTeacherPlan}>{t.savePlan}</button>
     </>}</>}
    </article>

    <article className="academy-card">
     <h3>{locale==='fa'?'جمع‌بندی جلسه و گرامر':'Session summary & grammar'}</h3>
     {!selectedIsTeacher?<p>{t.students}</p>:<>
      <label>{locale==='fa'?'مطالب تدریس‌شده':'Covered'}<textarea value={summaryForm.covered} onChange={e=>setSummaryForm({...summaryForm,covered:e.target.value})}/></label>
      <label>Grammar<textarea value={summaryForm.grammar_focus} onChange={e=>setSummaryForm({...summaryForm,grammar_focus:e.target.value})}/></label>
      <label>{locale==='fa'?'نقاط قوت':'Strengths'}<textarea value={summaryForm.strengths} onChange={e=>setSummaryForm({...summaryForm,strengths:e.target.value})}/></label>
      <label>{locale==='fa'?'نیاز به بهبود':'Improve next'}<textarea value={summaryForm.improve_next} onChange={e=>setSummaryForm({...summaryForm,improve_next:e.target.value})}/></label>
      <label>{locale==='fa'?'تمرکز جلسه بعد':'Next lesson'}<textarea value={summaryForm.next_focus} onChange={e=>setSummaryForm({...summaryForm,next_focus:e.target.value})}/></label>
      <button className="academy-primary small" onClick={saveSessionSummary}>{t.savePlan}</button>
      {selectedSummaries.slice(0,3).map(s=><div className="academy-summary-item" key={s.id}><small>{dt(s.created_at)}</small><p>{s.next_focus||s.covered||'—'}</p></div>)}
     </>}
    </article>

    <article className="academy-card">
     <h3>{locale==='fa'?'ثبت نتیجه تست':'Record test result'}</h3>
     {!selectedIsTeacher?<p>{t.students}</p>:<>
      <label>{t.title}<input value={testForm.title} onChange={e=>setTestForm({...testForm,title:e.target.value})}/></label>
      <div className="editor-two"><label>{locale==='fa'?'امتیاز':'Score'}<input type="number" value={testForm.score} onChange={e=>setTestForm({...testForm,score:e.target.value})}/></label><label>{locale==='fa'?'از':'Max'}<input type="number" value={testForm.max_score} onChange={e=>setTestForm({...testForm,max_score:e.target.value})}/></label></div>
      <label>{t.feedback}<textarea value={testForm.teacher_summary} onChange={e=>setTestForm({...testForm,teacher_summary:e.target.value})}/></label>
      <button className="academy-primary small" onClick={addTestResult}>{t.publish}</button>
      {selectedTests.slice(0,4).map(x=><div className="personal-row" key={x.id}><span>{x.title}</span><b>{x.percent!=null?Math.round(x.percent)+'%':'—'}</b></div>)}
     </>}
    </article>

    <article className="academy-card">
     <h3>{t.addResource}</h3>
     {!selectedIsTeacher?<p>{t.students}</p>:<>
      <label>{t.kind}<select value={resourceForm.kind} onChange={e=>setResourceForm({...resourceForm,kind:e.target.value})}><option value="material">{t.material}</option><option value="homework">{t.homework}</option><option value="lesson">Lesson note</option><option value="grammar">Grammar</option><option value="link">Useful link</option></select></label>
      <label>{t.title}<input value={resourceForm.title} onChange={e=>setResourceForm({...resourceForm,title:e.target.value})}/></label>
      <label>{t.description}<textarea value={resourceForm.description} onChange={e=>setResourceForm({...resourceForm,description:e.target.value})}/></label>
      <label>{t.url}<input value={resourceForm.url} onChange={e=>setResourceForm({...resourceForm,url:e.target.value})}/></label>
      {resourceForm.kind==='homework'&&<label>{t.due}<input type="datetime-local" value={resourceForm.due} onChange={e=>setResourceForm({...resourceForm,due:e.target.value})}/></label>}
      <button className="academy-primary small" onClick={addResource}>{t.publish}</button>
     </>}
    </article>
   </div>
  </section>}
 </div>
}
