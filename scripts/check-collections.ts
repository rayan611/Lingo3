/**
 * Collections and the shipped word packs.
 *
 * Two things here cannot be caught by typecheck and would be expensive to
 * find by hand.
 *
 * The packs are data. Nothing in the type system says that A1 and the
 * everyday list do not both contain `red`, that every row carries all eight
 * languages, or that a hundred rows is actually a hundred. Those are the
 * promises the word-lists screen makes to the user — "100 words", "each word
 * is in one pack" — and this is where they are kept.
 *
 * And the active flag changes what is due. A list switched off has to leave
 * the queue AND the count on the tile, or the badge sends you to a review
 * screen with nothing in it. That needs a real database to test, which is
 * what fake-indexeddb is for.
 *
 * Run with: npx tsx scripts/check-collections.ts
 */
import 'fake-indexeddb/auto'
import { db, openForUser, ensureSettings, newId } from '../src/db/db'
import { makeCard } from '../src/fsrs/scheduler'
import { buildQueue, queueCounts } from '../src/fsrs/queue'
import {
  createCollection,
  defaultListId,
  defaultTargetCollection,
  ensureDefaultCollection,
  listCollections,
  moveWord,
  planOf,
  roomIn,
  setCollectionActive,
  deleteCollection,
} from '../src/db/collections'
import { LANG_ORDER, glossFor, wordIn } from '../src/seed/catalogue'
import { buildDeck } from '../src/lib/exportDeck'
import { PACKS, installPack, packStatus, removePack } from '../src/seed/install'
import {
  DEFAULT_COLLECTION_ID,
  PLANS,
  collectionOf,
  type Concept,
  type Lang,
  type Settings,
} from '../src/db/types'

let failures = 0
async function check(label: string, run: () => Promise<unknown> | unknown) {
  try {
    await run()
    console.log(`  [PASS] ${label}`)
  } catch (err) {
    failures++
    console.log(`  [FAIL] ${label} — ${err instanceof Error ? err.message : err}`)
  }
}

function settingsFor(native: Lang, targets: Lang[]): Settings {
  return {
    id: 'singleton',
    nativeLang: native,
    targetLangs: targets,
    activeLangs: targets,
    dailyNewLimit: 500,
    dailyReviewLimit: 500,
    requestRetention: 0.9,
    updatedAt: Date.now(),
  }
}

async function main() {
  console.log('\nThe shipped packs\n')

  await check('every pack holds exactly 100 words', () => {
    for (const pack of PACKS) {
      if (pack.rows.length !== 100) {
        throw new Error(`${pack.id} has ${pack.rows.length}`)
      }
    }
  })

  await check('seed ids are unique across all three packs', () => {
    const seen = new Map<string, string>()
    for (const pack of PACKS) {
      for (const row of pack.rows) {
        const clash = seen.get(row[0])
        if (clash) throw new Error(`${row[0]} is in both ${clash} and ${pack.id}`)
        seen.set(row[0], pack.id)
      }
    }
  })

  await check('every row carries every language', () => {
    for (const pack of PACKS) {
      for (const row of pack.rows) {
        for (const lang of LANG_ORDER) {
          if (!wordIn(row, lang as Lang)) {
            throw new Error(`${pack.id}/${row[0]} has no ${lang}`)
          }
        }
      }
    }
  })

  // This is the promise that matters most: "A1 and the everyday list overlap"
  // was the thing to design away, not to paper over at install time. The
  // install-time seedId check is the safety net; this is the design holding.
  await check('no word appears twice in any language, across all packs', () => {
    const clashes: string[] = []
    for (const lang of LANG_ORDER) {
      const seen = new Map<string, string>()
      for (const pack of PACKS) {
        for (const row of pack.rows) {
          const word = wordIn(row, lang as Lang)
          if (!word) continue
          const key = word.toLocaleLowerCase()
          const previous = seen.get(key)
          if (previous) clashes.push(`${lang}: "${word}" in ${previous} and ${row[0]}`)
          else seen.set(key, row[0])
        }
      }
    }
    if (clashes.length) throw new Error(clashes.join('; '))
  })

  await check('the gloss is the learner own language, not a baked-in English one', () => {
    const row = PACKS.find((p) => p.id === 'a1')!.rows.find((r) => r[0] === 'v.eat')!
    const forPersian = glossFor(row, 'sv', 'fa')
    if (forPersian !== 'خوردن') throw new Error(`Persian learner got "${forPersian}"`)
    const forEnglish = glossFor(row, 'sv', 'en')
    if (forEnglish !== 'to eat') throw new Error(`English learner got "${forEnglish}"`)
    // The native language entry would otherwise gloss itself.
    const native = glossFor(row, 'fa', 'fa')
    if (native !== 'to eat') throw new Error(`the native entry glossed itself: "${native}"`)
  })

  console.log('\nInstalling a pack\n')

  await openForUser('check-collections')
  await ensureSettings()
  await ensureDefaultCollection()
  const settings = settingsFor('fa', ['sv', 'de'])

  await check('installing A1 writes concepts, entries and cards', async () => {
    const result = await installPack(PACKS.find((p) => p.id === 'a1')!, settings)
    if (result.added !== 100) throw new Error(`added ${result.added}`)
    const concepts = await db.concepts.where('seedId').notEqual('').count()
    if (concepts !== 100) throw new Error(`${concepts} concepts carry a seed id`)
    // Native plus two targets.
    const entries = await db.entries.count()
    if (entries !== 300) throw new Error(`${entries} entries, expected 300`)
    // One card per target language, never for the native one.
    const cards = await db.cards.count()
    if (cards !== 200) throw new Error(`${cards} cards, expected 200`)
  })

  await check('installing it again adds nothing', async () => {
    const result = await installPack(PACKS.find((p) => p.id === 'a1')!, settings)
    if (result.added !== 0) throw new Error(`added ${result.added} the second time`)
    if (result.skipped !== 100) throw new Error(`skipped ${result.skipped}`)
  })

  await check('a second pack does not duplicate a word you already have', async () => {
    const before = await db.concepts.count()
    const result = await installPack(PACKS.find((p) => p.id === 'daily')!, settings)
    const after = await db.concepts.count()
    if (after - before !== result.added) {
      throw new Error(`added ${result.added} but the table grew by ${after - before}`)
    }
    // Every headword, in every language, exactly once.
    const entries = await db.entries.toArray()
    const seen = new Set<string>()
    for (const e of entries) {
      const key = `${e.lang}:${e.headword.toLocaleLowerCase()}`
      if (seen.has(key)) throw new Error(`"${e.headword}" (${e.lang}) landed twice`)
      seen.add(key)
    }
  })

  await check('pack status counts what you actually hold', async () => {
    const status = await packStatus()
    if (status.get('a1')!.installed !== 100) throw new Error('A1 should be complete')
    if (status.get('a2')!.installed !== 0) throw new Error('A2 was never enabled')
    if (!status.get('daily')!.listExists) throw new Error('the everyday list is missing')
  })

  console.log('\nLists in the queue\n')

  await check('a list switched off leaves the queue and the counts', async () => {
    const dueBefore = (await queueCounts(settings)).total
    if (dueBefore === 0) throw new Error('nothing was due to begin with')

    const a1 = (await listCollections()).find((c) => c.packId === 'a1')!
    await setCollectionActive(a1.id, false)

    const queue = await buildQueue(settings, 500)
    const fromA1 = queue.filter((item) => collectionOf(item.concept) === a1.id)
    if (fromA1.length) throw new Error(`${fromA1.length} words from a list set aside`)

    const dueAfter = (await queueCounts(settings)).total
    if (dueAfter >= dueBefore) throw new Error('the count did not drop')

    // And nothing about the cards was touched, which is the whole point.
    const ids = (await db.concepts.where('collectionId').equals(a1.id).toArray()).map(
      (c) => c.id,
    )
    const cards = await db.cards.where('conceptId').anyOf(ids).toArray()
    if (cards.some((c) => c.suspended)) {
      throw new Error('switching a list off suspended its cards')
    }

    await setCollectionActive(a1.id, true)
    const restored = (await queueCounts(settings)).total
    if (restored !== dueBefore) throw new Error('turning it back on did not restore it')
  })

  console.log('\nYour own lists\n')

  await check('the free plan stops at three lists of your own', async () => {
    const free = { plan: 'free' as const }
    // The default counts as the first.
    await createCollection('Words at work', free)
    await createCollection('University', free)
    let refused = false
    try {
      await createCollection('One too many', free)
    } catch {
      refused = true
    }
    if (!refused) throw new Error('a fourth list was allowed')
    const mine = (await listCollections()).filter((c) => c.kind === 'user')
    if (mine.length !== PLANS.free.collections) {
      throw new Error(`${mine.length} lists of my own`)
    }
    // Library lists are free, so enabling packs never costs a slot.
    const libraries = (await listCollections()).filter((c) => c.kind === 'library')
    if (libraries.length !== 2) throw new Error('the packs changed the count')
  })

  await check('lifting the limits allows a fourth', async () => {
    const created = await createCollection('Four', { plan: 'full' })
    if (!created.id) throw new Error('no list came back')
    if (planOf({ plan: 'full' }).collections !== PLANS.full.collections) {
      throw new Error('the plan did not resolve')
    }
  })

  await check('moving a word changes its list and nothing else', async () => {
    const work = (await listCollections()).find((c) => c.name === 'Words at work')!
    const concept = (await db.concepts.toArray()).find((c) => !c.deletedAt)!
    const cardsBefore = await db.cards.where('conceptId').equals(concept.id).toArray()
    await moveWord(concept.id, work.id)
    const after = await db.concepts.get(concept.id)
    if (collectionOf(after!) !== work.id) throw new Error('it did not move')
    const cardsAfter = await db.cards.where('conceptId').equals(concept.id).toArray()
    if (JSON.stringify(cardsBefore) !== JSON.stringify(cardsAfter)) {
      throw new Error('a card changed when the word moved')
    }
  })

  await check('removing one of your lists keeps its words', async () => {
    const work = (await listCollections()).find((c) => c.name === 'Words at work')!
    const before = await db.concepts.where('collectionId').equals(work.id).count()
    const moved = await deleteCollection(work.id)
    if (moved !== before) throw new Error(`${moved} moved, ${before} were in it`)
    const stranded = await db.concepts.where('collectionId').equals(work.id).count()
    if (stranded) throw new Error(`${stranded} words left pointing at a deleted list`)
    const home = await db.concepts
      .where('collectionId')
      .equals(DEFAULT_COLLECTION_ID)
      .count()
    if (home < before) throw new Error('they did not arrive in the default list')
  })

  await check('a chosen default list is where new words go', async () => {
    const uni = await createCollection('Evening class', { plan: 'full' })
    const into = await defaultTargetCollection({ plan: 'full', defaultCollectionId: uni.id })
    if (into !== uni.id) throw new Error(`went to ${into}`)
    const none = await defaultTargetCollection({ plan: 'full' })
    if (none !== DEFAULT_COLLECTION_ID) throw new Error('no choice should mean the built-in list')
  })

  await check('a stale or pack default falls back to the built-in list', async () => {
    const all = await listCollections()
    if (defaultListId({ defaultCollectionId: 'gone' }, all) !== DEFAULT_COLLECTION_ID) {
      throw new Error('a removed list was still the default')
    }
    const pack = all.find((c) => c.kind === 'library')
    if (pack && defaultListId({ defaultCollectionId: pack.id }, all) !== DEFAULT_COLLECTION_ID) {
      throw new Error('a pack became the default')
    }
  })

  await check('removing a list sends its words where you say', async () => {
    const all = await listCollections()
    const uni = all.find((c) => c.name === 'Evening class')!
    const gone = await createCollection('Short-lived', { plan: 'full' })
    const concept = (await db.concepts.toArray()).find((c) => !c.deletedAt)!
    await moveWord(concept.id, gone.id)
    await deleteCollection(gone.id, uni.id)
    if (collectionOf((await db.concepts.get(concept.id))!) !== uni.id) {
      throw new Error('the word did not follow the chosen default')
    }
  })

  await check('removing a pack takes its words with it', async () => {
    const removed = await removePack('daily')
    if (removed === 0) throw new Error('nothing was removed')
    const left = await db.concepts
      .where('collectionId')
      .equals((await listCollections()).find((c) => c.packId === 'daily')?.id ?? 'gone')
      .filter((c: Concept) => !c.deletedAt)
      .count()
    if (left) throw new Error(`${left} pack words survived`)
    const status = await packStatus()
    if (status.get('daily')!.listExists) throw new Error('the list is still listed')
  })

  await check('the word cap is counted per list', async () => {
    const room = await roomIn(DEFAULT_COLLECTION_ID, { plan: 'free' })
    if (room.limit !== PLANS.free.wordsPerCollection) throw new Error('wrong limit')
    if (room.used < 0 || room.free > room.limit) throw new Error('the arithmetic is off')
  })

  await check('a word with no list at all still resolves to the default', async () => {
    const id = newId()
    const now = Date.now()
    await db.concepts.add({
      id,
      lemma: 'orphan',
      sourceLang: 'sv',
      pos: 'other',
      category: 'uncategorised',
      createdAt: now,
      updatedAt: now,
    })
    await db.cards.add(makeCard(id, 'sv'))
    const concept = await db.concepts.get(id)
    if (collectionOf(concept!) !== DEFAULT_COLLECTION_ID) {
      throw new Error('an unfiled word did not resolve')
    }
  })

  console.log('\nExporting a list\n')

  await check('the Anki file carries one column per language', async () => {
    const list = (await listCollections()).find((c) => c.packId === 'a1')!
    const deck = await buildDeck(list, settings, 'anki')
    const lines = deck.body.split('\n')
    if (!lines[0].startsWith('#separator:tab')) throw new Error('no separator directive')
    if (!lines.some((l) => l.startsWith('#deck:Lingo3::'))) throw new Error('no deck')
    if (!lines.some((l) => l === '#tags column:7')) throw new Error('tags are not tagged')
    const body = lines.filter((l) => !l.startsWith('#'))
    if (body.length === 0) throw new Error('no cards')
    for (const line of body) {
      const cells = line.split('\t')
      if (cells.length !== 7) throw new Error(`a row has ${cells.length} columns`)
    }
    // Swedish is the primary target, German second — the priority order.
    const row = body.find((l) => l.split('\t')[1] === 'äta')
    if (!row) throw new Error('the primary language is not in column 2')
    if (row.split('\t')[2] !== 'essen') throw new Error('the second language is not in column 3')
  })

  await check('the two-column file stacks the other languages on the back', async () => {
    const list = (await listCollections()).find((c) => c.packId === 'a1')!
    const deck = await buildDeck(list, settings, 'generic')
    if (!deck.body.startsWith('Front,Back')) throw new Error('no header')
    // Quoted, because the back holds newlines — an importer that sees a bare
    // newline there reads one card as two broken ones.
    if (!deck.body.includes('"Swedish: äta\nGerman: essen"')) {
      throw new Error('the languages are not stacked in one quoted field')
    }
  })

  await check('a word with no entry in a language leaves its column empty', async () => {
    const wider = settingsFor('fa', ['sv', 'de', 'ru'])
    const list = (await listCollections()).find((c) => c.packId === 'a1')!
    const deck = await buildDeck(list, wider, 'anki')
    const body = deck.body.split('\n').filter((l) => !l.startsWith('#'))
    // Russian was never a target when the pack was installed, so it has no
    // entries — the column has to be present and empty, not missing.
    for (const line of body) {
      if (line.split('\t').length !== 7) throw new Error('a row lost a column')
    }
  })

  console.log(
    failures === 0
      ? '\nCollections and the packs hold.\n'
      : `\n${failures} check${failures === 1 ? '' : 's'} failed.\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
