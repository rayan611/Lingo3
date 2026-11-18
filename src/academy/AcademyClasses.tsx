import {useEffect,useState} from 'react'
import {supabase} from '../auth/supabase'
type ClassRow={id:string;teacher_id:string;course_id:string;title:string;capacity:number;status:string}
type Session={id:string;class_id:string;starts_at:string;ends_at:string;timezone:string;status:string;meeting_url:string|null;meeting_backup_url:string|null;summary:string|null}
type Person={user_id:string;display_name:string}
type Notice={id:string;body:string;event:string;read_at:string|null;class_id:string}
type Course={id:string;title_i18n:Record<string,string>}
export function AcademyClasses({locale,userId,teacherId,courses,isAdmin=false}:{locale:string;userId:string;teacherId?:string;isAdmin?:boolean;courses:Course[]}){
 const fa=locale==='fa'
 const [classes,setClasses]=useState<ClassRow[]>([]),[sessions,setSessions]=useState<Session[]>([]),[notices,setNotices]=useState<Notice[]>([])
 const [selected,setSelected]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [title,setTitle]=useState(''),[course,setCourse]=useState(''),[capacity,setCapacity]=useState('1')
 const [query,setQuery]=useState(''),[matches,setMatches]=useState<Person[]>([]),[members,setMembers]=useState<{student_id:string}[]>([])
 const [start,setStart]=useState(''),[zone,setZone]=useState(Intl.DateTimeFormat().resolvedOptions().timeZone),[duration,setDuration]=useState('60'),[repeat,setRepeat]=useState('once'),[count,setCount]=useState('1')
 const [preview,setPreview]=useState(false)
 const [openClasses,setOpenClasses]=useState<{id:string;title:string;teacher_name:string;places:number;sessions:{starts_at:string}[]}[]>([])
 const [joinRequests,setJoinRequests]=useState<{id:string;class_id:string;student_id:string;message:string;status:string;expires_at:string}[]>([])
 const [activeSession,setActiveSession]=useState(''),[reason,setReason]=useState(''),[meeting,setMeeting]=useState(''),[backup,setBackup]=useState('')
 const [requests,setRequests]=useState<{id:string;session_id:string;student_id:string;reason:string;status:string}[]>([])
 const current=classes.find(c=>c.id===selected)
 const canManage=Boolean(current&&(isAdmin||teacherId===current.teacher_id))
 useEffect(()=>{
  let active=true
  setClasses([]);setSessions([]);setNotices([])
  Promise.all([supabase().from('academy_classes').select('*').order('created_at',{ascending:false}),supabase().from('academy_class_sessions').select('*').order('starts_at'),supabase().from('academy_notifications').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(50),supabase().from('academy_session_requests').select('*').eq('status','pending'),supabase().rpc('academy_open_classes'),supabase().from('academy_class_requests').select('*').order('created_at',{ascending:false}).limit(100)]).then(results=>{
   if(!active)return
   const failure=results.find(r=>r.error)?.error
   if(failure){setError(failure.message);return}
   setClasses(results[0].data??[]);setSessions(results[1].data??[]);setNotices(results[2].data??[]);setRequests(results[3].data??[]);setOpenClasses(results[4].data??[]);setJoinRequests(results[5].data??[])
  }).catch(e=>{if(active)setError(String(e))})
  return()=>{active=false}
 },[userId,revision])
 useEffect(()=>{
  let active=true;setMembers([]);setMatches([]);setQuery('');setPreview(false)
  if(selected)void Promise.resolve(supabase().from('academy_class_members').select('student_id').eq('class_id',selected).eq('status','active')).then(({data,error})=>{if(active){if(error)setError(error.message);else setMembers(data??[])}})
  return()=>{active=false}
 },[selected,revision])
 async function action(name:string,args:Record<string,unknown>){
  if(busy)return
  setBusy(true);setError('')
  try{const {error,data}=await supabase().rpc(name,args);if(error)throw error;setRevision(n=>n+1);return data}
  catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 async function search(){
  setBusy(true);setError('')
  try{const {data,error}=await supabase().rpc('academy_teacher_find_students',{p_query:query.trim()});if(error)throw error;setMatches(data??[])}catch(e){setError(String(e))}finally{setBusy(false)}
 }
 return <details className="academy-card" aria-busy={busy}>
  <summary>{fa?'کلاس‌ها و برنامهٔ جلسات':'Classes and schedule'}</summary>
  {error&&<p role="alert">{error}</p>}
  <details><summary>{fa?'اعلان‌ها':'Notifications'} ({notices.filter(n=>!n.read_at).length})</summary>{notices.map(n=><div className="academy-card" key={n.id}><p>{n.body}</p><button disabled={busy} onClick={()=>{setSelected(n.class_id);void action('academy_read_notification',{p_id:n.id})}}>{fa?'مشاهدهٔ کلاس':'Open class'}</button></div>)}</details>
  {!teacherId&&<details><summary>{fa?'کلاس‌های گروهی قابل ثبت‌نام':'Available group classes'}</summary>{openClasses.map(c=><article className="academy-card" key={c.id}><strong>{c.title}</strong><p>{c.teacher_name} · {c.places} {fa?'جای خالی':'places available'}</p>{c.sessions?.map(session=><p key={session.starts_at}>{new Date(session.starts_at).toLocaleString(locale)}</p>)}<button disabled={busy||c.places<1||joinRequests.some(r=>r.class_id===c.id&&r.status==='pending'&&new Date(r.expires_at)>new Date())} onClick={()=>void action('academy_request_class',{p_class:c.id,p_message:''})}>{fa?'درخواست ثبت‌نام':'Request enrollment'}</button></article>)}</details>}
  {joinRequests.filter(r=>r.status==='pending'&&new Date(r.expires_at)>new Date()).map(r=><article className="academy-card" key={r.id}><strong>{classes.find(c=>c.id===r.class_id)?.title||openClasses.find(c=>c.id===r.class_id)?.title}</strong><p>{r.message}</p><small>{fa?'مهلت پاسخ':'Response deadline'} {new Date(r.expires_at).toLocaleString(locale)}</small>{r.student_id===userId?<button disabled={busy} onClick={()=>void action('academy_resolve_class_request',{p_request:r.id,p_status:'withdrawn'})}>{fa?'پس‌گرفتن درخواست':'Withdraw request'}</button>:<div className="academy-card-actions"><button disabled={busy} onClick={()=>void action('academy_resolve_class_request',{p_request:r.id,p_status:'accepted'})}>{fa?'پذیرش':'Accept'}</button><button disabled={busy} onClick={()=>void action('academy_resolve_class_request',{p_request:r.id,p_status:'rejected'})}>{fa?'رد':'Reject'}</button></div>}</article>)}
  {teacherId&&<details><summary>{fa?'ساخت کلاس':'Create class'}</summary><form onSubmit={async e=>{e.preventDefault();const id=await action('academy_create_class',{p_teacher:teacherId,p_course:course,p_title:title,p_capacity:Number(capacity)});if(id){setSelected(id);setTitle('')}}}>
   <label>{fa?'عنوان کلاس':'Class title'}<input required value={title} placeholder={fa?'مثلاً گروه سوئدی سه‌شنبه':'e.g. Tuesday Swedish group'} onChange={e=>setTitle(e.target.value)}/></label>
   <label>{fa?'دوره':'Course'}<select required value={course} onChange={e=>setCourse(e.target.value)}><option value="">—</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title_i18n[locale]||c.title_i18n.en}</option>)}</select></label>
   <label>{fa?'ظرفیت':'Capacity'}<input type="number" min="1" max="100" required value={capacity} onChange={e=>setCapacity(e.target.value)}/></label><button disabled={busy}>{fa?'ساخت کلاس':'Create class'}</button>
  </form></details>}
  <label>{fa?'کلاس':'Class'}<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">—</option>{classes.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
  {current&&<><h4>{current.title}</h4>
   {canManage&&<><p>{members.length} / {current.capacity}</p><label>{fa?'نام یا شناسهٔ حساب دانشجو':'Student name or account ID'}<input value={query} placeholder={fa?'حداقل سه حرف از نام':'At least three letters'} onChange={e=>setQuery(e.target.value)}/></label><button disabled={busy||query.trim().length<3} onClick={search}>{fa?'جستجو':'Search'}</button>
    {matches.map(p=><div className="academy-card" key={p.user_id}><strong>{p.display_name}</strong><small dir="ltr"> {p.user_id}</small><button disabled={busy||members.some(m=>m.student_id===p.user_id)} onClick={()=>void action('academy_add_class_member',{p_class:selected,p_student:p.user_id})}>{fa?'افزودن به کلاس':'Add to class'}</button></div>)}
    <form onSubmit={e=>{e.preventDefault();setPreview(true)}}>
     <label>{fa?'اولین جلسه':'First session'}<input required type="datetime-local" value={start} onChange={e=>{setStart(e.target.value);setPreview(false)}}/></label>
     <label>{fa?'منطقهٔ زمانی':'Time zone'}<input required value={zone} placeholder="Europe/Stockholm" onChange={e=>{setZone(e.target.value);setPreview(false)}}/></label>
     <label>{fa?'مدت به دقیقه':'Duration in minutes'}<input required type="number" min="15" max="240" value={duration} onChange={e=>{setDuration(e.target.value);setPreview(false)}}/></label>
     <label>{fa?'تکرار':'Repeat'}<select value={repeat} onChange={e=>{setRepeat(e.target.value);setCount('1');setPreview(false)}}><option value="once">{fa?'یک‌بار':'Once'}</option><option value="daily">{fa?'روزانه':'Daily'}</option><option value="weekly">{fa?'هفتگی':'Weekly'}</option></select></label>
     <label>{fa?'تعداد جلسات':'Session count'}<input required disabled={repeat==='once'} type="number" min="1" max="100" value={count} onChange={e=>{setCount(e.target.value);setPreview(false)}}/></label>
     <button disabled={busy}>{fa?'پیش‌نمایش':'Preview'}</button>
    </form>
    {preview&&<div><p>{zone} · {duration} min</p><ol>{Array.from({length:Math.min(100,Number(count))},(_,i)=>{const d=new Date(start+'Z');d.setUTCDate(d.getUTCDate()+i*(repeat==='weekly'?7:repeat==='daily'?1:0));return <li key={i}>{d.toISOString().slice(0,16).replace('T',' ')}</li>})}</ol><button disabled={busy} onClick={()=>void action('academy_schedule_class',{p_class:selected,p_start:start,p_timezone:zone,p_minutes:Number(duration),p_repeat:repeat,p_count:Number(count)}).then(result=>{if(result)setPreview(false)})}>{fa?'ثبت برنامه':'Save schedule'}</button></div>}
   </>}
   {sessions.filter(s=>s.class_id===selected).map(s=><article className="academy-card" key={s.id}><time dateTime={s.starts_at}>{new Date(s.starts_at).toLocaleString(locale)} — {new Date(s.ends_at).toLocaleTimeString(locale)}</time><small> {s.status}</small>
    {s.status==='confirmed'&&s.meeting_url&&<a href={s.meeting_url} target="_blank" rel="noreferrer">{fa?'ورود به کلاس':'Join meeting'}</a>}
    {s.status==='confirmed'&&s.meeting_backup_url&&<a href={s.meeting_backup_url} target="_blank" rel="noreferrer">{fa?'لینک جایگزین':'Backup meeting'}</a>}
    {s.summary&&<p>{s.summary}</p>}
    <button disabled={busy} onClick={()=>{setActiveSession(s.id);setReason('');setMeeting(s.meeting_url||'');setBackup(s.meeting_backup_url||'')}}>{fa?'مدیریت جلسه':'Session actions'}</button>
    {activeSession===s.id&&<div><label>{fa?'توضیح یا خلاصهٔ جلسه':'Reason or lesson summary'}<textarea value={reason} placeholder={fa?'دلیل درخواست یا موضوع جلسه را بنویسید':'Write the reason or lesson summary'} onChange={e=>setReason(e.target.value)}/></label>
     {s.status==='confirmed'&&new Date(s.starts_at)>new Date()&&<button disabled={busy||!reason.trim()} onClick={()=>void action('academy_session_action',{p_session:s.id,p_action:canManage?'cancel':'request_cancel',p_data:{reason}})}>{canManage?(fa?'لغو جلسه':'Cancel session'):(fa?'درخواست لغو':'Request cancellation')}</button>}
     {canManage&&<><label>{fa?'لینک جلسه':'Meeting link'}<input type="url" placeholder="https://zoom.us/j/..." value={meeting} onChange={e=>setMeeting(e.target.value)}/></label><label>{fa?'لینک جایگزین':'Backup link'}<input type="url" placeholder="https://teams.microsoft.com/..." value={backup} onChange={e=>setBackup(e.target.value)}/></label><button disabled={busy||s.status!=='confirmed'} onClick={()=>void action('academy_session_action',{p_session:s.id,p_action:'meeting',p_data:{url:meeting,backup}})}>{fa?'ذخیرهٔ لینک':'Save links'}</button>
      {new Date(s.ends_at)<=new Date()&&s.status!=='cancelled'&&<><button disabled={busy} onClick={()=>void action('academy_session_action',{p_session:s.id,p_action:'complete',p_data:{summary:reason}})}>{fa?'ثبت پایان و خلاصه':'Complete and save summary'}</button>{members.map(m=><label key={m.student_id}>{m.student_id}<select defaultValue="" disabled={busy} onChange={e=>void action('academy_session_action',{p_session:s.id,p_action:'attendance',p_data:{student_id:m.student_id,status:e.target.value}})}><option value="">—</option><option value="present">{fa?'حاضر':'Present'}</option><option value="absent">{fa?'غایب':'Absent'}</option><option value="excused">{fa?'غیبت موجه':'Excused'}</option></select></label>)}</>}
      {requests.filter(r=>r.session_id===s.id).map(r=><div key={r.id}><p>{r.reason}</p><button disabled={busy} onClick={()=>void action('academy_session_action',{p_session:s.id,p_action:'approve_cancel',p_data:{request_id:r.id}})}>{fa?'قبول لغو':'Approve cancellation'}</button><button disabled={busy} onClick={()=>void action('academy_session_action',{p_session:s.id,p_action:'reject_cancel',p_data:{request_id:r.id}})}>{fa?'رد درخواست':'Reject request'}</button></div>)}
     </>}
    </div>}
   </article>)}
  </>}
 </details>
}
