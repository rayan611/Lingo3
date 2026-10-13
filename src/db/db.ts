import Dexie, { type Table } from 'dexie'
import {
  DEFAULT_SETTINGS,
  DEVICE_OVERRIDABLE,
  effectiveSettings,
  type Card,
  type DeviceOverridableKey,
  type DeviceOverride,
  type Concept,
  type Entry,
  type PendingExpansion,
  type ReviewLogRow,
  type Settings,
  type Story,
} from './types'

/** Sync cursors and other bookkeeping. One row per key. */
export interface MetaRow {
  key: string
  value: string | number | null
}

/**
 * Local-first store. The app only ever reads and writes here; the remote is a
 * background push/pull on top. Every mutable row carries `updatedAt`, which is
 * what last-write-wins sync resolves on.
 *
 * One database per signed-in user. Two people sharing a laptop get genuinely
 * separate stores rather than a shared one filtered by id — which is both
 * simpler and impossible to get wrong by forgetting a `where` clause.
 */
export class Lingo3DB extends Dexie {
  concepts!: Table<Concept, string>
  entries!: Table<Entry, string>
  cards!: Table<Card, string>
  reviewLog!: Table<ReviewLogRow, string>
  pending!: Table<PendingExpansion, string>
  stories!: Table<Story, string>
  settings!: Table<Settings, string>
  meta!: Table<MetaRow, string>

  constructor(dbName: string) {
    super(dbName)
    this.version(1).stores({
      concepts: 'id, lemma, sourceLang, pos, category, updatedAt, deletedAt',
      entries: 'id, conceptId, lang, headword, updatedAt, [conceptId+lang]',
      // `[lang+due]` is the index the review queue runs on.
      cards: 'id, conceptId, lang, due, state, updatedAt, [lang+due]',
      reviewLog: 'id, cardId, conceptId, lang, reviewedAt',
      pending: 'id, conceptId, createdAt',
      settings: 'id',
      meta: 'key',
    })

    // v2: `createdAt` on concepts. Both word lists sort by it, and IndexedDB
    // refuses to sort on a key it has no index for — so every screen that
    // listed words threw. Dexie migrates existing databases in place; no data
    // is touched, only the index is added.
    this.version(2).stores({
      concepts:
        'id, lemma, sourceLang, pos, category, createdAt, updatedAt, deletedAt',
    })

    // v3: topics as multi-valued tags. `*tags` is a multiEntry index, so
    // `where('tags').equals('restaurant')` matches a concept that carries it
    // among several — which is the whole reason for moving off a single
    // category field.
    //
    // `category` is kept rather than migrated away: dropping it would strand
    // every word added before now, and both are read when filtering.
    this.version(3)
      .stores({
        concepts:
          'id, lemma, sourceLang, pos, category, createdAt, updatedAt, deletedAt, *tags',
      })
      .upgrade(async (tx) => {
        await tx
          .table('concepts')
          .toCollection()
          .modify((c: Concept) => {
            if (c.tags && c.tags.length > 0) return
            c.tags =
              c.category && c.category !== 'uncategorised' ? [c.category] : []
          })
      })

    // v4: saved texts. A new store, so nothing existing is touched.
    // `createdAt` is indexed because the list sorts on it — the same thing
    // that broke every word list once already.
    this.version(4).stores({
      stories: 'id, lang, createdAt, updatedAt, deletedAt',
    })
  }
}

/**
 * Database name for a user, or the local-only store when signed out.
 *
 * The `lingua-` prefix is deliberately NOT renamed with the app. An IndexedDB
 * name is an address, not a label: changing it would point every existing
 * installation at an empty database and strand everything added offline and
 * not yet synced. Nobody ever sees this string.
 */
function dbNameFor(userId: string | null): string {
  return userId ? `lingua-${userId}` : 'lingua-local'
}

// `let` plus a live export binding: modules that `import { db }` always see the
// current database, so switching user does not require threading a handle
// through every call site.
export let db: Lingo3DB = new Lingo3DB(dbNameFor(null))
let currentDbName = db.name

/**
 * Point the app at a user's database. Returns true when the database actually
 * changed, which is the signal for the UI to remount so no stale query results
 * survive the switch.
 */
export async function openForUser(userId: string | null): Promise<boolean> {
  const next = dbNameFor(userId)
  if (next === currentDbName) return false
  try {
    db.close()
  } catch {
    /* already closed */
  }
  db = new Lingo3DB(next)
  currentDbName = next
  await db.open()
  return true
}

/**
 * Moves anything added before signing in into the signed-in user's store, then
 * empties the local one. Without this, words added on first run would vanish
 * the moment an account is created.
 */
export async function adoptLocalData(): Promise<number> {
  const local = new Lingo3DB(dbNameFor(null))
  try {
    await local.open()
    const [concepts, entries, cards, reviewLog, pending] = await Promise.all([
      local.concepts.toArray(),
      local.entries.toArray(),
      local.cards.toArray(),
      local.reviewLog.toArray(),
      local.pending.toArray(),
    ])
    if (concepts.length === 0) return 0

    await db.transaction(
      'rw',
      db.concepts, db.entries, db.cards, db.reviewLog, db.pending,
      async () => {
        // bulkPut, not bulkAdd: re-running this must not explode on rows that
        // already made it across.
        await db.concepts.bulkPut(concepts)
        await db.entries.bulkPut(entries)
        await db.cards.bulkPut(cards)
        await db.reviewLog.bulkPut(reviewLog)
        await db.pending.bulkPut(pending)
      },
    )

    await local.transaction(
      'rw',
      local.concepts, local.entries, local.cards, local.reviewLog, local.pending,
      async () => {
        await Promise.all([
          local.concepts.clear(),
          local.entries.clear(),
          local.cards.clear(),
          local.reviewLog.clear(),
          local.pending.clear(),
        ])
      },
    )
    return concepts.length
  } finally {
    local.close()
  }
}

export async function getMeta(key: string): Promise<string | number | null> {
  const row = await db.meta.get(key)
  return row?.value ?? null
}

export async function setMeta(key: string, value: string | number | null) {
  await db.meta.put({ key, value })
}

/**
 * Creates the settings row if it is missing. Call this once at boot — never
 * from inside a live query.
 *
 * It used to be one function that read and wrote. Used as a live query, the
 * write re-triggered the very query that performed it, so the app spun on a
 * fresh database instead of rendering. Reads and writes are separated now so
 * that cannot happen again.
 */
export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get('singleton')
  if (existing) return existing
  const fresh = { ...DEFAULT_SETTINGS, updatedAt: Date.now() }
  await db.settings.put(fresh)
  return fresh
}

/**
 * The account row as it stands, with no device pins applied.
 *
 * This is what the sync push sends and what Settings shows you as "your
 * account setting". Screens want `readSettings` instead.
 */
export async function readAccountSettings(): Promise<Settings> {
  const existing = await db.settings.get('singleton')
  return existing ?? { ...DEFAULT_SETTINGS, updatedAt: 0 }
}

/**
 * Pure read — safe inside a live query. Returns the settings *in force*: the
 * account row with this device's overrides laid over it.
 *
 * The overrides live in `meta`, which is per-user, never synced and already a
 * Dexie table — so changing one re-runs every live query that reads settings,
 * which localStorage would not have done.
 */
export async function readSettings(): Promise<Settings> {
  const [account, override] = await Promise.all([
    readAccountSettings(),
    readDeviceOverride(),
  ])
  return effectiveSettings(account, override)
}

const DEVICE_OVERRIDE_KEY = 'deviceSettings'

export async function readDeviceOverride(): Promise<DeviceOverride> {
  const raw = await getMeta(DEVICE_OVERRIDE_KEY)
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: DeviceOverride = {}
    for (const key of DEVICE_OVERRIDABLE) {
      if (key in (parsed as Record<string, unknown>)) {
        ;(out as Record<string, unknown>)[key] = (parsed as Record<string, unknown>)[key]
      }
    }
    return out
  } catch {
    // A corrupt blob should cost this device its pins, not its settings.
    return {}
  }
}

/**
 * Pin one setting to this device, or hand it back to the account with
 * `undefined`. Pass `null` to pin "none here" — see DeviceOverride.
 */
export async function setDeviceOverride(
  key: DeviceOverridableKey,
  value: Settings[DeviceOverridableKey] | null | undefined,
): Promise<void> {
  const current = await readDeviceOverride()
  const next: Record<string, unknown> = { ...current }
  if (value === undefined) delete next[key]
  else next[key] = value
  await setMeta(DEVICE_OVERRIDE_KEY, JSON.stringify(next))
}

/** @deprecated use ensureSettings at boot, readSettings in queries. */
export const getSettings = ensureSettings

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await ensureSettings()
  await db.settings.put({ ...current, ...patch, updatedAt: Date.now() })
}

/** Deterministic composite key, so the same row can't be inserted twice. */
export const compositeId = (conceptId: string, lang: string) =>
  `${conceptId}:${lang}`

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Normalised key for duplicate detection. Case- and diacritic-insensitive so
 * "Hund", "hund" and a stray accent all collapse to one concept — this is what
 * stops you paying the API twice for the same word.
 */
export function lemmaKey(lemma: string, lang: string): string {
  const base = lemma
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return `${lang}:${base}`
}
