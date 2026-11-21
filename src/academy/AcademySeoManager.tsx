import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../auth/supabase'
import type {Course,Teacher} from './Academy'
import {localizedName} from './preferences'
import {AcademySeoAudit} from './AcademySeoAudit'

type Locale='en'|'sv'|'fa'|'de'
type Kind='app'|'page'|'course'|'teacher'|'post'
type SeoRow={entity_type:Kind;entity_id:string;locale:Locale;title:string;description:string;target_keywords:string[];image_url:string|null;updated_at:string}
type Article={id:string;title:string}
const pages=['home','courses','teachers','posts','path','about','pricing','resources','contact']
const locales:Locale[]=['fa','en','sv','de']
const name=(fa:string,en:string,locale:Locale)=>locale==='fa'?fa:en
const pageUrl=(type:Kind,id:string,locale:Locale)=>type==='app'?'/':type==='page'?'/academy'+(id==='home'?'':'/'+id)+'?lang='+locale:'/academy/'+({course:'courses',teacher:'teachers',post:'posts'} as Record<string,string>)[type]+'/'+id+'?lang='+locale

export function AcademySeoManager({locale,userId,courses,teachers}:{locale:Locale;userId:string;courses:Course[];teachers:Teacher[]}){
 const [kind,setKind]=useState<Kind>('page'),[entityId,setEntityId]=useState('home'),[language,setLanguage]=useState<Locale>(locale)
 const [records,setRecords]=useState<SeoRow[]>([]),[articles,setArticles]=useState<Article[]>([])
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[keywords,setKeywords]=useState(''),[imageUrl,setImageUrl]=useState('')
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loading,setLoading]=useState(true)
 const options=useMemo(()=>kind==='app'?[{id:'home',label:'Lingo3 homepage'}]:kind==='page'?pages.map(id=>({id,label:id==='home'?'Academy homepage':id})):kind==='course'?courses.map(x=>({id:x.id,label:(x.title_i18n?.[locale]||x.title_i18n?.en||x.id)+' ['+x.status+']'})):kind==='teacher'?teachers.map(x=>({id:x.id,label:localizedName(x,locale)+' ['+x.status+']'})):articles.map(x=>({id:x.id,label:x.title})),[kind,courses,teachers,articles,locale])
 useEffect(()=>{let live=true;async function load(){setLoading(true);const c=supabase();const [seo,posts]=await Promise.all([
  c.from('academy_seo_settings').select('entity_type,entity_id,locale,title,description,target_keywords,image_url,updated_at').limit(3000),
  c.from('academy_posts').select('id,academy_post_translations(title,locale)').limit(200)
 ]);if(!live)return
  if(seo.error)setMessage(seo.error.message)
  else setRecords((seo.data||[]) as SeoRow[])
  if(posts.data)setArticles((posts.data as any[]).map(p=>({id:p.id,title:p.academy_post_translations?.find((x:any)=>x.locale===locale)?.title||p.academy_post_translations?.[0]?.title||p.id})))
  setLoading(false)}
 void load();return()=>{live=false}},[locale])
 useEffect(()=>{if(!options.some(x=>x.id===entityId))setEntityId(options[0]?.id||'')},[options,entityId])
 useEffect(()=>{const existing=records.find(x=>x.entity_type===kind&&x.entity_id===entityId&&x.locale===language);setTitle(existing?.title||'');setDescription(existing?.description||'');setKeywords((existing?.target_keywords||[]).join(', '));setImageUrl(existing?.image_url||'')},[records,kind,entityId,language])
 const duplicate=records.some(x=>x.entity_type!==kind||x.entity_id!==entityId?x.locale===language&&x.title.trim()===title.trim()&&title.trim().length>0:false)
 const warnings=[!title.trim()?'SEO title missing':title.length>65?'Title may be truncated in search':null,!description.trim()?'Description missing':description.length>160?'Description may be truncated in search':description.length<65?'Consider a more descriptive summary':null,duplicate?'Another page uses this SEO title':null].filter(Boolean)
 const url='https://lingo3.com'+pageUrl(kind,entityId,language)
 async function save(e:React.FormEvent){e.preventDefault();if(!entityId)return;setBusy(true);setMessage('');try{
  const safeImage=imageUrl.trim();if(safeImage&&(!safeImage.startsWith('https://')||safeImage.length>1000))throw Error('Image must use an HTTPS URL.')
  const payload={entity_type:kind,entity_id:entityId,locale:language,title:title.trim(),description:description.trim(),target_keywords:keywords.split(/[,،\n]/).map(x=>x.trim()).filter(Boolean).slice(0,20),image_url:safeImage||null,updated_at:new Date().toISOString(),updated_by:userId}
  const {error}=await supabase().from('academy_seo_settings').upsert(payload,{onConflict:'entity_type,entity_id,locale'})
  if(error)throw error
  setRecords(prev=>[...prev.filter(x=>!(x.entity_type===kind&&x.entity_id===entityId&&x.locale===language)),payload as SeoRow])
  setMessage(name('ذخیره شد. تغییرات عمومی ممکن است تا ۶۰ ثانیه کش شود.','Saved. Public changes may be cached for up to 60 seconds.',locale))
 }catch(err){setMessage(err instanceof Error?err.message:String(err))}finally{setBusy(false)}}
 return <section className="academy-card academy-seo-manager">
  <h3>{name('مدیریت سئوی صفحات','SEO Manager',locale)}</h3>
  <p>{name('عنوان و توضیح اختصاصی هر صفحه به زبان انتخابی، تصویر اشتراک‌گذاری، و کلیدواژه‌های هدف را مدیریت کنید. کلیدواژه‌ها متاتگ رتبه‌بندی گوگل نیستند.','Edit localized search titles, descriptions, social images and editorial target phrases. Target phrases are not a Google ranking meta tag.',locale)}</p>
  {loading?<p role="status">…</p>:<form onSubmit={save}>
   <div className="editor-two">
    <label>{name('نوع صفحه','Page type',locale)}<select value={kind} onChange={e=>{setKind(e.target.value as Kind);setEntityId('');setMessage('');if(e.target.value==='app')setLanguage('en')}}><option value="app">Lingo3 app homepage</option><option value="page">Academy pages</option><option value="course">Courses</option><option value="teacher">Teachers</option><option value="post">Learning articles</option></select></label>
    <label>{name('زبان متادیتا','Metadata language',locale)}<select value={language} onChange={e=>{setLanguage(e.target.value as Locale);setMessage('')}}>{(kind==='app'?(['en'] as Locale[]):locales).map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label>
   </div>
   <label>{name('صفحه یا محتوا','Page or content',locale)}<select value={entityId} onChange={e=>{setEntityId(e.target.value);setMessage('')}}>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
   <label>SEO Title <input maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Online Swedish courses | Lingo3 Academy"/></label>
   <small>{title.length}/140</small>
   <label>Meta Description <textarea maxLength={360} value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label>
   <small>{description.length}/360</small>
   <label>{name('کلمات کلیدی هدف (با ویرگول جدا کنید)','Target phrases (comma separated)',locale)}<textarea value={keywords} onChange={e=>setKeywords(e.target.value)} rows={2}/></label>
   <label>{name('تصویر اشتراک‌گذاری (HTTPS)','Social preview image (HTTPS)',locale)}<input type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..."/></label>
   <div className="academy-card" aria-label="Search preview" dir={language==='fa'?'rtl':'ltr'}>
    <small>{url}</small><div style={{color:'#3577c7',fontWeight:600}}>{title||name('عنوان پیش‌فرض صفحه','Default page title',locale)}</div><p>{description||name('توضیح پیش‌فرض صفحه','Default description',locale)}</p>
   </div>
   {warnings.length>0&&<div role="status"><strong>{name('پیشنهادهای بهبود','SEO quality checks',locale)}</strong><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
   <div className="academy-card-actions"><button type="submit" disabled={busy||!entityId}>{busy?'…':name('ذخیره تنظیمات سئو','Save SEO settings',locale)}</button><a href={url} target="_blank" rel="noopener noreferrer">{name('مشاهده صفحه عمومی','View public page',locale)}</a></div>
   {message&&<p role="status" aria-live="polite">{message}</p>}
  </form>}
  <AcademySeoAudit locale={locale} courses={courses} teachers={teachers}/>
  <p><a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">Google Search Console</a> · <a href="https://pagespeed.web.dev/" target="_blank" rel="noopener noreferrer">PageSpeed Insights</a></p>
  <small>{name('داده‌های Search Console فقط پس از اتصال مجاز مالک سایت قابل نمایش هستند.','Search Console data requires the site owner to authorize access.',locale)}</small>
 </section>
}
