/** Human-readable, privacy-safe errors for Supabase/PostgREST teacher deletion. */
export type DeleteLocale='fa'|'en'|'sv'|'de'
type DatabaseError={code?:string;message?:string;details?:string;hint?:string}
export function teacherDeletionError(error:unknown,locale:DeleteLocale):string{
 const fa=locale==='fa'
 const value=(error&&typeof error==='object'?error:{} ) as DatabaseError
 if(value.code==='23503')return fa
  ?'حذف دائمی ممکن نیست؛ این استاد هنوز سابقه کلاس، رزرو یا محتوای آموزشی وابسته دارد. برای حفظ سوابق دانشجویان، رکورد استاد بایگانی می‌ماند و در فهرست عمومی نمایش داده نمی‌شود.'
  :'Permanent deletion is blocked because lessons, bookings or other learning records still refer to this teacher. The profile remains archived and is hidden from the public directory.'
 if(value.code==='42501'||value.code==='PGRST301')return fa?'دسترسی حذف تأیید نشد. با حساب ادمین وارد شوید.':'Deletion permission was denied. Sign in with an administrator account.'
 const detail=typeof value.message==='string'&&value.message.trim()?value.message.trim():error instanceof Error?error.message:''
 const safe=detail&&!/\[object Object\]|^\{.*\}$/.test(detail)?detail:''
 return fa?('حذف استاد انجام نشد.'+(safe?' جزئیات: '+safe:'')):('Teacher deletion failed.'+(safe?' Details: '+safe:''))
}
export function teacherBookingBlock(count:number,locale:DeleteLocale):string{
 if(locale==='fa')return `حذف دائمی انجام نشد: این استاد ${count} رزرو ثبت‌شده دارد. پاک‌کردن رکورد استاد ممکن است سوابق دانشجویان را از بین ببرد. استاد بایگانی است و در صفحات عمومی نمایش داده نمی‌شود.`
 return `Permanent deletion blocked: this teacher has ${count} existing booking${count===1?'':'s'}. Preserving student history requires keeping the archived teacher record; the teacher is not shown publicly.`
}
