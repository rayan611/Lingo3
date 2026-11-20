import {useId,useState} from 'react'
export type AcademyLocale='fa'|'en'|'sv'|'de'
export type HelpText=Record<AcademyLocale,string>
export function AcademyHelp({locale,text}:{locale:AcademyLocale;text:HelpText}){
 const [open,setOpen]=useState(false),id=useId()
 return <span className="academy-help-control"><button className="academy-help-button" type="button" aria-expanded={open} aria-controls={id} aria-label={({fa:'راهنما: ',en:'Help: ',sv:'Hjälp: ',de:'Hilfe: '})[locale]+text[locale]} onClick={()=>setOpen(v=>!v)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false)}}}>i</button>{open&&<span role="note" id={id} className="academy-help-popover">{text[locale]}</span>}</span>
}
export function AcademyFormHelp({locale}:{locale:string}) {
 const lang:AcademyLocale=locale==='fa'||locale==='sv'||locale==='de'?locale:'en'
 return <AcademyHelp locale={lang} text={{fa:'فیلدهای این فرم را تکمیل کنید و برای ثبت از دکمهٔ مربوط استفاده کنید.',en:'Complete the fields in this form and use the appropriate button to submit or save.',sv:'Fyll i formulärets fält och använd knappen för att skicka eller spara.',de:'Füllen Sie die Felder aus und verwenden Sie die passende Schaltfläche zum Senden oder Speichern.'}}/>
}
