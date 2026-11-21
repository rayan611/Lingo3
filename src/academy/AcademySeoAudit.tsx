import {useState} from 'react'
import type {Course,Teacher} from './Academy'

type Locale='en'|'sv'|'fa'|'de'
type Finding={url:string;issues:string[];title:string}
const locales:Locale[]=['en','sv','fa','de']
const sectionPaths=['','/courses','/teachers','/posts','/about','/path','/pricing','/resources','/contact']
const translated=(map:Record<string,string>|undefined,lang:string)=>Boolean(map?.[lang]?.trim())

/** Read-only, client-side crawl audit. Never fetches user workspaces or unpublished content. */
export function AcademySeoAudit({locale,courses,teachers}:{locale:Locale;courses:Course[];teachers:Teacher[]}){
 const [findings,setFindings]=useState<Finding[]>([])
 const [running,setRunning]=useState(false),[lastError,setLastError]=useState(''),[checked,setChecked]=useState(false)
 async function run(){
  setRunning(true);setLastError('');setChecked(false)
  const urls=new Set<string>(['/'])
  for(const lang of locales){
   for(const section of sectionPaths)urls.add('/academy'+section+'?lang='+lang)
   for(const course of courses.filter(c=>c.status==='active'&&translated(c.title_i18n,lang)&&translated(c.description_i18n,lang)))
    urls.add('/academy/courses/'+course.id+'?lang='+lang)
   for(const teacher of teachers.filter(t=>t.status==='active'&&translated(t.intro_i18n,lang)))
    urls.add('/academy/teachers/'+teacher.id+'?lang='+lang)
  }
  // Only public, localized pages. Article URLs are taken from the public sitemap.
  try{
   const sitemap=await fetch('/sitemap.xml',{credentials:'omit',cache:'no-store'})
   if(sitemap.ok){const xml=new DOMParser().parseFromString(await sitemap.text(),'application/xml')
    for(const node of Array.from(xml.getElementsByTagName('loc'))){const raw=node.textContent||'';try{const parsed=new URL(raw);if(parsed.protocol==='https:'&&['lingo3.com','www.lingo3.com'].includes(parsed.hostname)&&parsed.pathname.startsWith('/academy/posts/'))urls.add(parsed.pathname+parsed.search)}catch{/* invalid sitemap URL */}}
   }
  }catch{/* report remaining public routes even if sitemap fetch fails */}
  const results:Finding[]=[],all=[...urls].slice(0,150)
  let cursor=0
  try{
   async function worker(){while(cursor<all.length){const current=all[cursor++],issues:string[]=[];let title=''
    try{
     const response=await fetch(current,{credentials:'omit',cache:'no-store',headers:{Accept:'text/html'}})
     if(!response.ok){issues.push('HTTP '+response.status);results.push({url:current,issues,title});continue}
     const document=new DOMParser().parseFromString(await response.text(),'text/html')
     const titleEls=document.querySelectorAll('head title')
     title=titleEls[0]?.textContent?.trim()||''
     if(titleEls.length!==1||!title)issues.push('Missing/duplicate title')
     if(title.length>65)issues.push('Long title')
     const description=document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()||''
     if(!description)issues.push('Missing description')
     if(description.length>160)issues.push('Long description')
     if(document.querySelectorAll('link[rel="canonical"]').length!==1)issues.push('Missing/duplicate canonical')
     if(document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'))issues.push('Noindex')
     if(!document.querySelector('script[type="application/ld+json"]'))issues.push('Missing structured data')
     if(!document.querySelector('main h1'))issues.push('Missing H1')
     if(current.startsWith('/academy/')&&!document.querySelector('link[hreflang]'))issues.push('Missing hreflang')
    }catch(error){issues.push('Fetch error: '+String(error))}
    results.push({url:current,issues,title})
   }}
   await Promise.all(Array.from({length:Math.min(4,all.length)},()=>worker()))
   const titles=new Map<string,number>()
   for(const x of results)if(x.title)titles.set(x.title,(titles.get(x.title)||0)+1)
   for(const x of results)if(x.title&&(titles.get(x.title)||0)>1)x.issues.push('Duplicate title across audited URLs')
   results.sort((a,b)=>b.issues.length-a.issues.length||a.url.localeCompare(b.url))
   setFindings(results);setChecked(true)
  }catch(error){setLastError(String(error))}finally{setRunning(false)}
 }
 const fa=locale==='fa'
 const errors=findings.filter(x=>x.issues.length)
 return <section className="academy-card academy-seo-audit">
  <h3>{fa?'بررسی عمومی سئوی سایت':'Public SEO audit'}</h3>
  <p>{fa?'این بررسی فقط صفحات عمومی منتشرشده را می‌خواند و وضعیت عنوان، توضیحات، کنونیکال، هدر، داده ساختاریافته و زبان‌ها را نشان می‌دهد. داده خصوصی بررسی نمی‌شود.':'Checks public pages for titles, descriptions, canonical links, headings, structured data and locales. Private data is never crawled.'}</p>
  <button type="button" disabled={running} onClick={()=>void run()}>{running?'Checking…':fa?'اجرای بررسی صفحات عمومی':'Run public SEO audit'}</button>
  {lastError&&<p role="alert">{lastError}</p>}
  {checked&&<div role="status"><strong>{findings.length} {fa?'صفحه بررسی شد':'pages checked'} · {errors.length} {fa?'صفحه دارای هشدار':'pages with warnings'}</strong>
   {errors.length===0?<p>{fa?'هشدار آشکاری در بررسی صفحات دیده نشد.':'No findings in the checked pages.'}</p>:<details><summary>{fa?'مشاهده مشکلات به تفکیک صفحه':'View findings by page'}</summary><div className="academy-scroll-list">{errors.map(x=><article key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.url}</a><ul>{x.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></article>)}</div></details>}
  </div>}
  <small>{fa?'این تست جایگزین Search Console یا اندازه‌گیری واقعی Core Web Vitals نیست.':'This does not replace Search Console or real-user Core Web Vitals measurement.'}</small>
 </section>
}
