import {useState} from 'react'
export const shareLabels={en:{share:'Share',copy:'Copy link',copied:'Link copied',device:'Share with an app',failed:'Copy the link below'},fa:{share:'اشتراک‌گذاری',copy:'کپی لینک',copied:'لینک کپی شد',device:'اشتراک با برنامه‌های دستگاه',failed:'لینک زیر را کپی کنید'},sv:{share:'Dela',copy:'Kopiera länk',copied:'Länken kopierad',device:'Dela med en app',failed:'Kopiera länken nedan'},de:{share:'Teilen',copy:'Link kopieren',copied:'Link kopiert',device:'Mit einer App teilen',failed:'Link unten kopieren'}}
export function AcademyShare({locale,title,description,path}:{locale:keyof typeof shareLabels;title:string;description:string;path:string}){
 const t=shareLabels[locale],url=new URL(path,window.location.origin).href,body=`${title}\n${description}\n${url}`
 const [notice,setNotice]=useState('')
 const data={title,text:description,url}
 const native=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare(data))
 return <details className="academy-share"><summary>{t.share}</summary><div className="academy-card-actions">
 <button onClick={async()=>{try{await navigator.clipboard.writeText(url);setNotice(t.copied)}catch{setNotice(t.failed)}}}>{t.copy}</button>
 <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`}>Email</a>
 <a target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(body)}`}>WhatsApp</a>
 <a target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title+'\n'+description)}`}>Telegram</a>
 {native&&<button onClick={async()=>{try{await navigator.share(data)}catch(e){if((e as Error).name!=='AbortError')setNotice(t.failed)}}}>{t.device}</button>}
 </div>{notice&&<p role="status">{notice}</p>}{notice===t.failed&&<input aria-label={t.copy} readOnly value={url} onFocus={e=>e.target.select()}/>}</details>
}
