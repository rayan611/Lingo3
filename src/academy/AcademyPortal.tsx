import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../auth/supabase'

type Locale = 'en' | 'sv' | 'fa'
type Course = { id:string; level_code:string; title_i18n:Record<string,string> }
type Teacher = { id:string; user_id:string|null; display_name:string }
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
  kind:'material'|'homework'
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
 locale,userId,courses,teachers,selfTeacher,isAdmin,onNotice
}:{
 locale:Locale
 userId:string
 courses:Course[]
 teachers:Teacher[]
 selfTeacher:Teacher|undefined
 isAdmin:boolean
 onNotice:(message:string)=>void
}){
 const t=copy[locale]
 const [enrollments,setEnrollments]=useState<Enrollment[]>([])
 const [studentSpaces,setStudentSpaces]=useState<Space[]>([])
 const [teacherSpaces,setTeacherSpaces]=useState<Space[]>([])
 const [bookings,setBookings]=useState<Booking[]>([])
 const [availability,setAvailability]=useState<Availability[]>([])
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
 const [teacherPlan,setTeacherPlan]=useState({progress:'0',nextTopics:'',goal:''})
 const [resourceForm,setResourceForm]=useState({kind:'material',title:'',description:'',url:'',due:''})
 const [bookingDraft,setBookingDraft]=useState<Record<string,{confirmed_start:string;meeting_url:string;teacher_note:string;duration_minutes:string}>>({})
 const [busy,setBusy]=useState(false)

 const courseById=useMemo(()=>new Map(courses.map(c=>[c.id,c])),[courses])
 const teacherById=useMemo(()=>new Map(teachers.map(x=>[x.id,x])),[teachers])
 const ownBookings=bookings.filter(x=>x.student_id===userId)
 const teacherBookings=selfTeacher?bookings.filter(x=>x.teacher_id===selfTeacher.id):[]
 const selected=[...studentSpaces,...teacherSpaces].find(x=>x.id===selectedSpace)
 const selectedIsTeacher=Boolean(selected&&selfTeacher&&selected.teacher_id===selfTeacher.id&&selected.student_id!==userId)

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
  const taughtSpaces=selfTeacher?((results[3].data??[]) as Space[]):[]
  const slots=selfTeacher?((results[4].data??[]) as Availability[]):[]
  setTeacherSpaces(taughtSpaces.filter(x=>x.student_id!==userId))
  setAvailability(slots)
  const all=[...ownSpaces,...taughtSpaces.filter(x=>x.student_id!==userId)]
  if(!selectedSpace&&all[0])setSelectedSpace(all[0].id)
  if(selectedSpace&&!all.some(x=>x.id===selectedSpace))setSelectedSpace(all[0]?.id??'')
 }

 useEffect(()=>{void refresh()},[userId,selfTeacher?.id])

 useEffect(()=>{
  if(!selectedSpace){setNotes([]);setResources([]);setMessages([]);return}
  let cancelled=false
  Promise.all([
   supabase().from('academy_notes').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).limit(50),
   supabase().from('academy_resources').select('*').eq('learning_space_id',selectedSpace).order('created_at',{ascending:false}).limit(100),
   supabase().from('academy_messages').select('*').eq('learning_space_id',selectedSpace).order('created_at').limit(200),
  ]).then(([n,r,m])=>{
   if(cancelled)return
   setNotes((n.data??[]) as Note[])
   setResources((r.data??[]) as Resource[])
   const msg=(m.data??[]) as Message[]
   setMessages(msg)
   const unread=msg.filter(x=>x.recipient_id===userId&&!x.read_at).map(x=>x.id)
   if(unread.length)void supabase().from('academy_messages').update({read_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',unread)
  })
  return()=>{cancelled=true}
 },[selectedSpace,userId])

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

 const courseTitle=(id:string|null)=>id?(courseById.get(id)?i18n(courseById.get(id)!.title_i18n,locale):id):'—'
 const teacherTitle=(id:string)=>teacherById.get(id)?.display_name??'Teacher'

 return <div className="academy-portal">
  <div className="academy-personal-grid">
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

   {isAdmin&&<article className="academy-card"><h3>Admin</h3><p>Course, teacher and enrollment administration remains in Admin Studio below.</p></article>}
  </div>

  {selected&&<div className="academy-learning-columns">
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
     <div className="academy-card-top"><span className="academy-badge">{r.kind==='homework'?t.homework:t.material}</span><span>{r.student_status}</span></div>
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

  {selfTeacher&&<section className="academy-teacher-desk">
   <div className="academy-section-head"><p>{t.teacherDesk}</p><h3>{selfTeacher.display_name}</h3></div>
   <div className="academy-learning-columns">
    <article className="academy-card">
     <h3>{t.availability}</h3>
     <label>{t.start}<input type="datetime-local" value={slotStart} onChange={e=>setSlotStart(e.target.value)}/></label>
     <div className="editor-two"><label>{t.duration}<input type="number" min="15" max="240" value={slotDuration} onChange={e=>setSlotDuration(e.target.value)}/></label><label>{t.mode}<select value={slotMode} onChange={e=>setSlotMode(e.target.value)}><option value="online">{t.online}</option><option value="offline">{t.offline}</option></select></label></div>
     <button className="academy-primary small" onClick={addSlot}>{t.addSlot}</button>
     <div className="academy-slot-list">{availability.map(a=><div className="personal-row" key={a.id}><span>{dt(a.starts_at)} · {a.delivery_mode}</span><span>{a.status}</span>{a.status==='available'&&<button className="small-link" onClick={()=>removeSlot(a.id)}>{t.removeSlot}</button>}</div>)}</div>
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
     <h3>{t.addResource}</h3>
     {!selectedIsTeacher?<p>{t.students}</p>:<>
      <label>{t.kind}<select value={resourceForm.kind} onChange={e=>setResourceForm({...resourceForm,kind:e.target.value})}><option value="material">{t.material}</option><option value="homework">{t.homework}</option></select></label>
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
