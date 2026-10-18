/**
 * Checks the parts of the auth/sync change that could silently lose data:
 * per-user database isolation, adoption of pre-sign-in words, and the
 * last-write-wins merge rule.
 *
 * Run with: npx tsx scripts/check-sync.ts
 */
import 'fake-indexeddb/auto'
import {
  adoptLocalData,
  db,
  openForUser,
  getMeta,
  setMeta,
  readAccountSettings,
  readDeviceOverride,
  readSettings,
  saveSettings,
  setDeviceOverride,
  ensureSettings,
} from '../src/db/db'
import type { Concept } from '../src/db/types'
import {
  ExpiringLock,
  advanceCursor,
  withTimeout,
  STALE_LOCK_MS,
  mergeInto,
} from '../src/sync/sync'
import { dropLaterWord, parkWord } from '../src/db/later'

/** What the Later list actually shows — the deleted rows are still in there. */
async function visibleLater() {
  return db.later.filter((row) => !row.deletedAt).toArray()
}

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  // Detail only on failure. It used to print on both, so a passing line read
  // "[PASS] theme is pushed — missing theme in upsert", which is nonsense.
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${!ok && detail ? ` — ${detail}` : ''}`)
}

function concept(id: string, lemma: string, updatedAt = Date.now()): Concept {
  return {
    id,
    lemma,
    sourceLang: 'fa',
    pos: 'noun',
    category: 'daily',
    createdAt: updatedAt,
    updatedAt,
  }
}

async function main() {
  console.log('\n1. Words added before signing in are not lost')
  await openForUser(null)
  await db.concepts.bulkPut([concept('a', 'hund'), concept('b', 'katt')])
  check('two words in the local store', (await db.concepts.count()) === 2)

  await openForUser('user-1')
  const adopted = await adoptLocalData()
  check('adoption reports the words it moved', adopted === 2, `got ${adopted}`)
  check("they are in user-1's store", (await db.concepts.count()) === 2)

  await openForUser(null)
  check('and the local store is now empty', (await db.concepts.count()) === 0)

  console.log('\n2. Two users on one browser stay separate')
  await openForUser('user-1')
  check('user-1 still has their words', (await db.concepts.count()) === 2)
  await openForUser('user-2')
  check('user-2 starts empty', (await db.concepts.count()) === 0)
  await db.concepts.put(concept('c', 'bok'))
  await openForUser('user-1')
  check(
    "user-2's word did not leak into user-1",
    (await db.concepts.get('c')) === undefined,
  )
  check('user-1 count unchanged', (await db.concepts.count()) === 2)

  console.log('\n3. Last-write-wins keeps the newer side')
  const older = 1_000_000
  const newer = 2_000_000
  await db.concepts.put(concept('lww', 'local-newer', newer))

  const olderMerged = await mergeInto(db.concepts, [concept('lww', 'remote-older', older)])
  check(
    'an older remote row is ignored',
    olderMerged === 0 && (await db.concepts.get('lww'))?.lemma === 'local-newer',
  )

  const newerMerged = await mergeInto(db.concepts, [concept('lww', 'remote-newer', newer + 1)])
  check(
    'a newer remote row really replaces the local row',
    newerMerged === 1 && (await db.concepts.get('lww'))?.lemma === 'remote-newer',
  )

  const equalMerged = await mergeInto(db.concepts, [concept('lww', 'same-time-remote', newer + 1)])
  check(
    'equal timestamps do not cause unstable ping-pong',
    equalMerged === 0 && (await db.concepts.get('lww'))?.lemma === 'remote-newer',
  )

  const deletion = { ...concept('lww', 'remote-deletion', newer + 2), deletedAt: newer + 2 }
  const deletionMerged = await mergeInto(db.concepts, [deletion])
  const deletedLocal = await db.concepts.get('lww')
  check(
    'a newer soft deletion propagates as a tombstone',
    deletionMerged === 1 && deletedLocal?.deletedAt === newer + 2,
  )

  console.log('\n4. Reading settings never writes')
  // A live query that writes re-triggers itself. This is what left a fresh
  // database spinning instead of rendering, so it gets a guard.
  await openForUser('user-3')
  const writesBefore = await db.settings.count()
  const first = await readSettings()
  const writesAfter = await db.settings.count()
  check('readSettings returns usable defaults on an empty db', first.targetLangs.length > 0)
  check(
    'and writes nothing',
    writesBefore === 0 && writesAfter === 0,
    `rows before ${writesBefore}, after ${writesAfter}`,
  )
  await ensureSettings()
  check('ensureSettings does create the row', (await db.settings.count()) === 1)
  await ensureSettings()
  check('and is idempotent', (await db.settings.count()) === 1)

  // The load-bearing one for a second device. The defaults row must rank as
  // "never set", or it is newer than the account row it has never seen: the
  // pull skips it under last-write-wins, the push then sends the defaults up,
  // and the device asks for the name again on an account that already has one.
  const fresh = await db.settings.get('singleton')
  check(
    'a never-edited settings row is stamped 0, not now',
    fresh?.updatedAt === 0,
    `updatedAt ${fresh?.updatedAt}`,
  )
  check(
    'so any account row outranks it',
    1 > (fresh?.updatedAt ?? 0),
  )
  await saveSettings({ displayName: 'Rayan' })
  const edited = await db.settings.get('singleton')
  check(
    'and an edited one is stamped, so it still pushes',
    (edited?.updatedAt ?? 0) > 0 && edited?.displayName === 'Rayan',
  )

  console.log('\n4b. Every settings field actually syncs')
  // Static, on purpose: the push and pull are inline in sync.ts around a
  // Supabase client, and the failure worth guarding is not a runtime one —
  // it is adding a field to Settings and forgetting one of the two halves,
  // which types cannot catch because both sides are loose object literals.
  // The field is then silently per-device forever.
  {
    const { readFileSync } = await import('node:fs')
    const syncSrc = readFileSync('src/sync/sync.ts', 'utf8')
    const pushBlock = syncSrc.slice(
      syncSrc.indexOf("from('user_settings').upsert"),
      syncSrc.indexOf("advanceCursor(CURSOR_PUSH"),
    )
    const pullBlock = syncSrc.slice(
      syncSrc.indexOf('const merged: Settings'),
      syncSrc.indexOf('await db.settings.put(merged)'),
    )
    const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
    // Read from the Settings INTERFACE, not from DEFAULT_SETTINGS. The
    // optional fields — displayName, typedLang, autoAdvance — have no
    // default, so keying off the defaults object silently skipped exactly
    // the fields most likely to be forgotten. displayName is the one that
    // decides whether your name follows the account to a second device.
    const typesSrc = readFileSync('src/db/types.ts', 'utf8')
    const iface = typesSrc.slice(
      typesSrc.indexOf('export interface Settings'),
      typesSrc.indexOf('\n}', typesSrc.indexOf('export interface Settings')),
    )
    const fields = [...iface.matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)]
      .map((m) => m[1])
      .filter((k) => k !== 'id' && k !== 'updatedAt')
    check('the Settings interface was parsed', fields.length >= 10, `found ${fields.length}`)
    check('the push and pull blocks were both found', pushBlock.length > 0 && pullBlock.length > 0)
    for (const f of fields) {
      check(`${f} is pushed`, pushBlock.includes(`${snake(f)}:`), `missing ${snake(f)} in upsert`)
      check(`${f} is pulled`, pullBlock.includes(`${f}:`), `missing ${f} in merged`)
    }
  }

  console.log('\n5. Sync cursors survive and reset')
  await setMeta('sync.lastPulledAt', 12345)
  check('cursor reads back', (await getMeta('sync.lastPulledAt')) === 12345)
  await setMeta('sync.lastPulledAt', 0)
  check('cursor resets to zero', (await getMeta('sync.lastPulledAt')) === 0)

  console.log('\n6. A hung sync cannot hold the lock forever')
  // The bug this guards: `running` was only cleared in a `finally`, so a fetch
  // frozen by the OS when the tab was backgrounded held it for the life of the
  // page and every later sync answered 'already running' until a reload.
  const lock = new ExpiringLock(STALE_LOCK_MS)
  const t0 = 1_000_000
  check('a free lock is acquired', lock.acquire(t0))
  check('a held lock refuses a second caller', !lock.acquire(t0 + 1000))
  check(
    'and still refuses just before it goes stale',
    !lock.acquire(t0 + STALE_LOCK_MS - 1),
  )
  check(
    'but a lock older than the stale window is taken over',
    lock.acquire(t0 + STALE_LOCK_MS),
  )
  lock.release()
  check('a released lock is free again', lock.acquire(t0 + STALE_LOCK_MS + 1))

  console.log('\n7. A step that never settles is abandoned')
  const hang = new Promise<number>(() => {})
  let timedOut = ''
  try {
    await withTimeout(hang, 20, 'push')
  } catch (err) {
    timedOut = err instanceof Error ? err.message : String(err)
  }
  check('withTimeout rejects rather than hanging', timedOut === 'push timed out', timedOut)

  const quick = await withTimeout(Promise.resolve(7), 1000, 'pull')
  check('and passes a value straight through when it settles', quick === 7)

  console.log('\n8. Cursors only ever move forward')
  // An abandoned push keeps running and may finish after a later sync has
  // already moved the cursor past its own startedAt. Writing that older value
  // would re-send a window of rows for nothing.
  await setMeta('sync.lastPushedAt', 0)
  await advanceCursor('sync.lastPushedAt', 5000)
  check('a fresh cursor advances', (await getMeta('sync.lastPushedAt')) === 5000)
  await advanceCursor('sync.lastPushedAt', 9000)
  check('a newer value advances it', (await getMeta('sync.lastPushedAt')) === 9000)
  await advanceCursor('sync.lastPushedAt', 3000)
  check(
    'a stale value from an abandoned run leaves it alone',
    (await getMeta('sync.lastPushedAt')) === 9000,
    `got ${await getMeta('sync.lastPushedAt')}`,
  )
  await setMeta('sync.lastPushedAt', 0)
  check(
    'and the reset path can still force it back to zero',
    (await getMeta('sync.lastPushedAt')) === 0,
  )

  console.log('\n9. Settings follow the account, except where a device pins them')
  // The account row is what syncs; an override is what one device keeps for
  // itself. The failure this guards against is the quiet one: a pull writing
  // the account value over a device's own choice, or a push promoting one
  // device's choice to every device.
  await openForUser('user-settings')
  await saveSettings({ speakOnReveal: true, speechRate: 1.1, theme: 'dark' })

  check(
    'a device with no overrides takes the account values',
    (await readSettings()).speakOnReveal === true &&
      (await readSettings()).speechRate === 1.1,
  )

  await setDeviceOverride('speakOnReveal', false)
  check(
    'a pinned setting wins over the account',
    (await readSettings()).speakOnReveal === false,
  )
  check(
    'and the account row itself is untouched',
    (await readAccountSettings()).speakOnReveal === true,
  )
  check(
    'an unpinned setting beside it still follows the account',
    (await readSettings()).speechRate === 1.1,
  )

  // What a pull does: it writes the account row. The override must survive it,
  // because that is exactly the moment the old behaviour would have been lost.
  await saveSettings({ speakOnReveal: true, speechRate: 0.8 })
  check(
    'the pin survives a later account change',
    (await readSettings()).speakOnReveal === false,
  )
  check(
    'while the unpinned one moves with it',
    (await readSettings()).speechRate === 0.8,
  )

  await setDeviceOverride('typedLang', null)
  check(
    'null pins "none on this device" rather than clearing the pin',
    (await readSettings()).typedLang === undefined &&
      'typedLang' in (await readDeviceOverride()),
  )

  await setDeviceOverride('speakOnReveal', undefined)
  check(
    'clearing a pin hands the setting back to the account',
    (await readSettings()).speakOnReveal === true,
  )

  // Overrides live in `meta`, which is per-user and never pushed — so a
  // second account on the same browser does not inherit them.
  await openForUser('user-settings-2')
  check(
    "another user's pins are not visible here",
    Object.keys(await readDeviceOverride()).length === 0,
  )

  console.log('\n10. The parked-word list survives being synced')
  await openForUser('user-later')
  const parked = await parkWord('försenad')
  check('a word is parked', parked)
  check('and it is on the list', (await visibleLater()).length === 1)

  check('parking the same word again is refused', !(await parkWord('Försenad ')))

  // The load-bearing one. A hard delete would leave no row at all, and a row
  // that is missing locally always loses last-write-wins — so the next full
  // resync would hand the word straight back.
  const row = (await db.later.toArray())[0]
  await dropLaterWord(row.id)
  check('removing it takes it off the list', (await visibleLater()).length === 0)
  check(
    'but the row is still there, carrying a deletedAt for the other device',
    (await db.later.count()) === 1 &&
      Boolean((await db.later.get(row.id))?.deletedAt),
  )

  // Writing it down again revives the row rather than making a second one,
  // which would show the same word twice on the list.
  check('writing it down again is allowed', await parkWord('försenad'))
  check(
    'and revives the row rather than adding a second',
    (await db.later.count()) === 1 && (await visibleLater()).length === 1,
  )

  // The sync rule itself: an older remote copy must not overwrite a newer
  // local one, exactly as for concepts and cards.
  const live = (await db.later.toArray())[0]
  await mergeInto(db.later, [
    { ...live, lemma: 'stale', updatedAt: live.updatedAt - 1000 },
  ])
  check(
    'an older remote parked word does not overwrite a newer local one',
    (await db.later.get(live.id))?.lemma === 'försenad',
  )
  await mergeInto(db.later, [
    { ...live, lemma: 'nyare', updatedAt: live.updatedAt + 1000 },
  ])
  check(
    'a newer one does',
    (await db.later.get(live.id))?.lemma === 'nyare',
  )

  console.log(
    failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
