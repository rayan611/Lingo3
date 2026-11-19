import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin='https://lingo3.com'
const locales=['en','fa','sv','de']
const names:Record<string,Record<string,string>>={en:{home:'Lingo3 Academy',posts:'Learning articles',courses:'Language courses',teachers:'Language teachers',about:'About Lingo3 Academy',path:'Find your learning path',pricing:'Pricing',resources:'Learning resources',contact:'Contact'},fa:{home:'آکادمی لینگو۳',posts:'مطالب آموزشی',courses:'دوره‌های زبان',teachers:'استادهای زبان',about:'دربارهٔ آکادمی لینگو۳',path:'مسیر یادگیری',pricing:'هزینهٔ دوره‌ها',resources:'منابع آموزشی',contact:'تماس'},sv:{home:'Lingo3 Academy',posts:'Lärartiklar',courses:'Språkkurser',teachers:'Språklärare',about:'Om Lingo3 Academy',path:'Hitta din studieplan',pricing:'Priser',resources:'Lärresurser',contact:'Kontakt'},de:{home:'Lingo3 Academy',posts:'Lernartikel',courses:'Sprachkurse',teachers:'Sprachlehrkräfte',about:'Über Lingo3 Academy',path:'Lernweg finden',pricing:'Preise',resources:'Lernmaterial',contact:'Kontakt'}}
export const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const jsonLd=(x:unknown)=>JSON.stringify(x).replace(/</g,'\\u003c')
async function rows(table:string,query:string){
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY
 if(!base||!key)throw Error('Public database configuration missing')
 const r=await fetch(`${base}/rest/v1/${table}?${query}`,{headers:{apikey:key,authorization:`Bearer ${key}`},signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Public content unavailable');return r.json() as Promise<any[]>
}
export function renderPage(shell:string,data:{title:string;description:string;locale:string;url:string;content:string;alternates:{locale:string;url:string}[];schema?:unknown;noindex?:boolean;image?:string}){
 let html=shell.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[\s\S]*?>/gi,'').replace(/<link\s+rel="(?:canonical|alternate)"[^>]*>/gi,'')
 const title=escapeHtml(data.title),description=escapeHtml(data.description),url=escapeHtml(data.url)
 const head=`<title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta name="robots" content="${data.noindex?'noindex, nofollow':'index, follow'}"><meta property="og:type" content="${data.schema?'article':'website'}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:image" content="${escapeHtml(data.image||origin+'/og-image.png')}"><meta name="twitter:card" content="summary_large_image">${data.alternates.map(a=>`<link rel="alternate" hreflang="${a.locale}" href="${escapeHtml(a.url)}">`).join('')}${data.schema?`<script type="application/ld+json">${jsonLd(data.schema)}</script>`:''}`
 return html.replace('<html lang="en">',`<html lang="${data.locale}" dir="${data.locale==='fa'?'rtl':'ltr'}">`).replace('</head>',head+'</head>').replace('<div id="root"></div>',`<div id="root"><main style="max-width:850px;margin:auto;padding:24px;font-family:system-ui;line-height:1.8"><nav><a href="/academy?lang=${data.locale}">${escapeHtml(names[data.locale].home)}</a> · <a href="/academy/posts?lang=${data.locale}">${escapeHtml(names[data.locale].posts)}</a></nav><h1>${title}</h1>${data.content}</main></div>`)
}
export default async function handler(req:{method?:string;url?:string;query:Record<string,string|string[]|undefined>},res:{setHeader:(k:string,v:string)=>void;status:(s:number)=>{send:(s:string)=>void}}){
 if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).send('Method not allowed')
 const q=(k:string)=>{const v=req.query[k];return Array.isArray(v)?v[0]:v??''},lang=locales.includes(q('lang'))?q('lang'):'en'
 const suffix=q('route').replace(/^\/+|\/+$/g,''),route=suffix?'/' + suffix:''
 try{
 if(q('sitemap')==='1'){
  const urls=new Set<string>([origin+'/'])
  for(const l of locales)for(const r of ['','/posts','/courses','/teachers','/about','/path','/pricing','/resources','/contact'])urls.add(`${origin}/academy${r}?lang=${l}`)
  for(const table of ['academy_post_translations','academy_courses','academy_teachers']){
   for(let offset=0;offset<50000;offset+=1000){
    const query=table==='academy_post_translations'?'select=post_id,locale&status=eq.published&order=post_id,locale':'select=id&status=eq.active&order=id'
    const batch=await rows(table,`${query}&limit=1000&offset=${offset}`)
    for(const x of batch)if(table==='academy_post_translations')urls.add(`${origin}/academy/posts/${x.post_id}?lang=${x.locale}`);else for(const l of locales)urls.add(`${origin}/academy/${table==='academy_courses'?'courses':'teachers'}/${x.id}?lang=${l}`)
    if(batch.length<1000)break
   }
  }
  res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=60');return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...urls].map(u=>`<url><loc>${escapeHtml(u)}</loc></url>`).join('')}</urlset>`)
 }
 let shell:string
 try{shell=await readFile(path.join(process.cwd(),'dist/index.html'),'utf8')}catch{const r=await fetch(origin+'/index.html',{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Shell unavailable');shell=await r.text()}
 const parts=suffix.split('/'),kind=parts[0]||'home',id=parts[1],url=`${origin}/academy${route}?lang=${lang}`
 let title=names[lang][kind]||names[lang].home,description=title,content='',schema:unknown,alternates=locales.map(l=>({locale:l,url:`${origin}/academy${route}?lang=${l}`})),noindex=['my','admin'].includes(kind),status=200,image:string|undefined
 if(id&&['posts','courses','teachers'].includes(kind)){
  if(!/^[0-9a-f-]{36}$/i.test(id)){status=404;noindex=true}else if(kind==='posts'){
   const translations=await rows('academy_post_translations',`select=*&post_id=eq.${id}&status=eq.published`),x=translations.find(x=>x.locale===lang)
   alternates=translations.map(x=>({locale:x.locale,url:`${origin}/academy/posts/${id}?lang=${x.locale}`}))
   if(!x){status=404;noindex=true;content='<p>Translation not published.</p>'}else{
    title=x.title;description=x.description||x.body.slice(0,180);content=`<article>${x.body.split(/\n\s*\n/).map((s:string)=>`<p style="white-space:pre-wrap">${escapeHtml(s)}</p>`).join('')}${x.video_url?`<a href="${escapeHtml(x.video_url)}" rel="noopener noreferrer">YouTube / Instagram</a>`:''}<p>${x.keywords.map(escapeHtml).join(' · ')}</p></article>`
    schema={'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:lang,datePublished:x.published_at,dateModified:x.updated_at,mainEntityOfPage:url,keywords:x.keywords,publisher:{'@type':'Organization',name:'Lingo3 Academy',url:origin+'/academy'},image:origin+'/og-image.png'}
   }
  }else{
   const table=kind==='courses'?'academy_courses':'academy_teachers',fields=kind==='courses'?'id,title_i18n,description_i18n,topics_i18n':'id,display_name,display_name_i18n,intro_i18n,photo_url'
   const x=(await rows(table,`select=${fields}&id=eq.${id}&status=eq.active`))[0]
   if(!x){status=404;noindex=true}else{title=kind==='courses'?(x.title_i18n[lang]||x.title_i18n.en):(x.display_name_i18n?.[lang]||x.display_name);description=(kind==='courses'?x.description_i18n:x.intro_i18n)?.[lang]||'';image=x.photo_url||undefined;content=`<p>${escapeHtml(description)}</p>`;if(x.topics_i18n)content+=`<ul>${(x.topics_i18n[lang]||[]).map((s:string)=>`<li>${escapeHtml(s)}</li>`).join('')}</ul>`}
  }
 }else if(!id&&kind==='posts'){
  const entries=await rows('academy_post_translations',`select=post_id,title,description&locale=eq.${lang}&status=eq.published&order=published_at.desc&limit=100`)
  content=entries.map(x=>`<article><h2><a href="/academy/posts/${x.post_id}?lang=${lang}">${escapeHtml(x.title)}</a></h2><p>${escapeHtml(x.description)}</p></article>`).join('')
 }else if(!id&&['courses','teachers'].includes(kind)){
  const course=kind==='courses',entries=await rows(course?'academy_courses':'academy_teachers',`select=${course?'id,title_i18n,description_i18n':'id,display_name,display_name_i18n,intro_i18n'}&status=eq.active&limit=100`)
  content=entries.map(x=>`<article><h2><a href="/academy/${kind}/${x.id}?lang=${lang}">${escapeHtml(course?(x.title_i18n[lang]||x.title_i18n.en):(x.display_name_i18n?.[lang]||x.display_name))}</a></h2><p>${escapeHtml((course?x.description_i18n:x.intro_i18n)?.[lang]||'')}</p></article>`).join('')
 }else if(!names[lang][kind]&&!noindex){status=404;noindex=true}
 if(!content&&!noindex)content=`<p>${escapeHtml(title)}</p><nav>${['courses','teachers','posts','about','contact'].map(r=>`<p><a href="/academy/${r}?lang=${lang}">${escapeHtml(names[lang][r])}</a></p>`).join('')}</nav>`
 if(noindex)alternates=[]
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control',noindex?'private, no-store':'public, s-maxage=60');res.setHeader('X-Robots-Tag',noindex?'noindex, nofollow':'index, follow')
 return res.status(status).send(renderPage(shell,{title,description,locale:lang,url,content,alternates,schema,noindex,image}))
 }catch{res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','60');return res.status(503).send('Content temporarily unavailable. Please retry.')}
}
