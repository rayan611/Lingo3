import './lib/loose-source.mjs'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {teacherBookingBlock,teacherDeletionError} from '../src/academy/teacherDeletion.ts'

assert.equal(teacherDeletionError({code:'23503',message:'violates foreign key constraint'},'en').includes('archived'),true)
assert.match(teacherDeletionError({code:'23503'},'fa'),/سوابق|بایگانی/)
assert.match(teacherDeletionError({code:'42501'},'en'),/administrator/)
assert.equal(teacherDeletionError({code:'UNEXPECTED'},'en'),'Teacher deletion failed.')
assert.equal(teacherDeletionError({message:'[object Object]'},'en'),'Teacher deletion failed.')
assert.equal(teacherDeletionError({code:'42',message:'Request timed out'},'en'),'Teacher deletion failed. Details: Request timed out')
assert.match(teacherBookingBlock(1,'en'),/1 existing booking\./)
assert.match(teacherBookingBlock(2,'fa'),/2 رزرو/)
assert(!teacherBookingBlock(1,'en').includes('[object Object]'))
const source=readFileSync(new URL('../src/academy/Academy.tsx',import.meta.url),'utf8').replace(/\s+/g,'').replace(/[;()]/g,'').replace(/["']/g,'')
const bookingPreflight=source.indexOf("from('academy_bookings').select('id',{count:'exact',head:true}).eq('teacher_id',item.id)".replace(/\s+/g,'').replace(/[;()]/g,'').replace(/["']/g,''))
const deleteCall=source.indexOf("from('academy_teachers').delete().eq('id',item.id)".replace(/\s+/g,'').replace(/[;()]/g,'').replace(/["']/g,''))
assert(bookingPreflight>=0 && deleteCall>bookingPreflight,'Booking preflight must precede destructive delete')
assert(source.includes('setNoticeteacherBookingBlock'),'User must see actionable booking count')
assert(source.includes('setNoticeteacherDeletionError'),'PostgREST errors must be formatted instead of object coercion')
console.log('PASS teacher deletion: FK errors, permissions, no [object Object], booking count and safe preflight order.')
