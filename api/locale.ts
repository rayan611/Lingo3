/** Vercel supplies this country header; no IP is stored or sent to another service. */
export default function handler(req:{method?:string;headers:Record<string,string|string[]|undefined>},res:{setHeader:(key:string,value:string)=>void;status:(code:number)=>{json:(body:unknown)=>void}}){
 res.setHeader('Cache-Control','private, no-store')
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'})
 const country=req.headers['x-vercel-ip-country']
 const locale=({IR:'fa',DE:'de',SE:'sv'} as Record<string,string>)[Array.isArray(country)?country[0]:country??'']??'en'
 return res.status(200).json({locale})
}
