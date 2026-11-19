import {useEffect,useState} from 'react'
import {db,dbNameFor} from '../db/db'
import {addGrammarSection,addGrammarRule,updateGrammarRule} from '../db/grammar'
import {supabase} from '../auth/supabase'
import {LANG_NAMES,type Lang} from '../db/types'

type Item={id:string;title:string;body:string}
type Space={id:string;course_id:string;student_display_name:string|null;teacher_id:string|null}
/** Explicit, previewed snapshots only. App/Dexie never mounts in Academy. */
export function AcademyBridge({userId,kind,languages}:{userId:string;kind:'words'|'grammar';languages:Lang[]}){
 const [open,setOpen]=useState(false),[spaces,setSpaces]=useState<Space[]>([]),[spaceId,setSpaceId]=useState('')
 const [lang,setLang]=useState<Lang>(()=>{const q=new URLSearchParams(location.search).get('academyLang') as Lang;return languages.includes(q)?q:languages[0]??'sv'})
 const [items,setItems]=useState<Item[]>([]),[chosen,setChosen]=useState<string[]>([]),[query,setQuery]=useState(''),[preview,setPreview]=useState(''),[confirmed,setConfirmed]=useState(false)
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[incoming,setIncoming]=useState<{id:string;title:string;description:string;url:string|null}|null>(null)
 const resourceId=kind==='grammar'?new URLSearchParams(location.search).get('academyResource'):null
 useEffect(()=>{setIncoming(null);if(!resourceId)return;let active=true;void supabase().from('academy_resources').select('id,title,description,url,kind').eq('id',resourceId).eq('kind','grammar').single().then(r=>{if(!active)return;if(r.error)setNotice(r.error.message);else setIncoming(r.data)});return()=>{active=false}},[resourceId,userId])
 useEffect(()=>{
  setItems([]);setChosen([]);setPreview('');setConfirmed(false);setSpaces([]);setSpaceId('');if(!open){setLoading(false);return}setLoading(true);let active=true;const database=db
  async function load(){
   const [ls,cs]=await Promise.all([supabase().from('academy_learning_spaces').select('id,course_id,student_display_name,teacher_id').eq('student_id',userId).order('created_at',{ascending:false}),supabase().from('academy_courses').select('id,title_i18n,subject_code')])
   if(!active)return;if(database!==db||database.name!==dbNameFor(userId))throw Error('Account changed. Please reopen the App.');if(ls.error)throw ls.error;if(cs.error)throw cs.error
   const course=new Map((cs.data??[]).map(c=>[c.id,c]));const own=(ls.data??[]).filter(s=>s.teacher_id)
   setSpaces(own);setSpaceId(own[0]?.id??'');setNotice('')
   setCourseNames(Object.fromEntries(own.map(s=>[s.id,course.get(s.course_id)?.title_i18n?.en??s.course_id])))
   let rows:Item[]=[]
   if(kind==='grammar')rows=(await database.grammarRules.where('lang').equals(lang).filter(r=>!r.deletedAt).toArray()).map(r=>({id:r.id,title:r.title,body:r.title+'\n'+r.explanation+'\n'+r.examples.map(e=>e.sentence+' — '+e.translation).join('\n')}))
   else {const concepts=await database.concepts.filter(c=>!c.deletedAt).primaryKeys();const alive=new Set(concepts);rows=(await database.entries.where('lang').equals(lang).toArray()).filter(e=>alive.has(e.conceptId)).map(e=>({id:e.id,title:e.headword,body:e.headword+' — '+e.meaning+(e.example?'\n'+e.example:'')}))}
   if(active&&database===db){setItems(rows);setChosen([]);setPreview('');setConfirmed(false)}
  }
  void load().catch(e=>{if(active)setNotice(String(e.message??e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}
 },[open,lang,kind,userId])
 const [courseNames,setCourseNames]=useState<Record<string,string>>({})
 function buildPreview(ids:string[]){setChosen(ids);setPreview(items.filter(i=>ids.includes(i.id)).map(i=>i.body).join('\n\n'));setConfirmed(false)}
 async function share(){
  if(loading||!spaceId||!preview.trim()||preview.length>20000||!confirmed||busy)return;setBusy(true)
  try{const {error}=await supabase().from('academy_notes').insert({learning_space_id:spaceId,author_id:userId,visibility:'shared',body:LANG_NAMES[lang]+' · '+(kind==='words'?'Selected vocabulary':'Selected grammar')+'\n\n'+preview.trim()});if(error)throw error;setNotice('Shared with this classroom. Your private App originals stay unchanged.');setConfirmed(false)}catch(e){setNotice(String(e instanceof Error?e.message:e))}finally{setBusy(false)}
 }
 async function importGrammar(){
  if(!incoming||busy)return;setBusy(true);const database=db;const source='academy-resource:'+incoming.id
  try{
   if(database.name!==dbNameFor(userId))throw Error('Account changed. Please reopen the App.')
   await database.transaction('rw',database.grammarRules,database.grammarSections,async()=>{
    if(await database.grammarRules.filter(r=>!r.deletedAt&&r.tags.includes(source)).first())throw Error('This resource is already in your grammar notebook.')
    if(db!==database)throw Error('Account changed')
    let section=await database.grammarSections.where('lang').equals(lang).filter(s=>!s.deletedAt&&s.title==='Academy').first()
    if(!section)section=await addGrammarSection(lang,'Academy')
    const rule=await addGrammarRule(lang,section.id,incoming.title,(incoming.description??'')+(incoming.url?'\n'+incoming.url:'' )||incoming.title)
    await updateGrammarRule(rule.id,{tags:[source]})
   });setNotice('Added a personal copy. Further teacher edits will not overwrite your notebook.');setIncoming(null)
  }catch(e){setNotice(String(e instanceof Error?e.message:e))}finally{setBusy(false)}
 }
 return <section className="panel academy-bridge"><h3>App ↔ Academy</h3><p className="muted small">Share only selected items with your teacher. Class progress is teacher-recorded; App review progress stays separate.</p>
  {incoming&&<div><strong>{incoming.title}</strong><p style={{whiteSpace:'pre-wrap'}}>{incoming.description}</p><label>Notebook language<select value={lang} onChange={e=>setLang(e.target.value as Lang)}>{languages.map(l=><option key={l} value={l}>{LANG_NAMES[l]}</option>)}</select></label><button disabled={busy} onClick={()=>void importGrammar()}>Add this Academy resource to my grammar</button><button onClick={()=>setIncoming(null)}>Dismiss</button></div>}
  <button aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Close sharing':'Share selected '+kind+' with my teacher'}</button>
  {open&&<fieldset disabled={busy||loading} style={{border:0,padding:0}}><label>Language<select value={lang} onChange={e=>setLang(e.target.value as Lang)}>{languages.map(l=><option key={l} value={l}>{LANG_NAMES[l]}</option>)}</select></label><label>Classroom<select value={spaceId} onChange={e=>{setSpaceId(e.target.value);setConfirmed(false)}}><option value="">Choose a classroom</option>{spaces.map(s=><option key={s.id} value={s.id}>{courseNames[s.id]}</option>)}</select></label><label>Find items<input placeholder="Search words or grammar titles" value={query} onChange={e=>setQuery(e.target.value)}/></label><div style={{maxHeight:220,overflow:'auto'}}>{items.filter(i=>i.title.toLowerCase().includes(query.toLowerCase())).slice(0,100).map(i=><label className="check" key={i.id}><input type="checkbox" checked={chosen.includes(i.id)} onChange={e=>buildPreview(e.target.checked?[...chosen,i.id]:chosen.filter(x=>x!==i.id))}/>{i.title}</label>)}</div><label>Preview — only this text is shared<textarea placeholder="Choose items above, then review the exact text before sharing" value={preview} onChange={e=>{setPreview(e.target.value);setConfirmed(false)}} rows={5}/></label><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I want to share this preview with the selected classroom.</label><p className="small">{preview.length} / 20000 characters. Search narrows the first 100 choices.</p><button disabled={!confirmed||!spaceId||!preview.trim()||preview.length>20000} onClick={()=>void share()}>Share preview</button>{!spaces.length&&<p>No linked classroom yet. Ask your Academy admin to activate your enrollment.</p>}</fieldset>}
  {notice&&<p role="status">{notice}</p>}
 </section>
}
