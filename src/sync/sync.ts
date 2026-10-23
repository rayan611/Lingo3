import { db, getMeta, setMeta } from '../db/db'
import { supabase } from '../auth/supabase'
import { DEFAULT_SETTINGS, type Card, type Collection, type CollectionKind, type Concept, type Entry, type Lang, type LaterWord, type PlanName, type ReviewLogRow, type Settings, type Story } from '../db/types'

/**
 * Last-write-wins sync against Supabase.
 *
 * The app never reads from here — it reads Dexie. This runs in the background
 * and reconciles. Three shapes of data, three strategies:
 *
 *   review log  append-only; rows are inserted and never updated, so it is the
 *               one table that physically cannot conflict
 *   everything  last-write-wins on `updated_at`; for a single person across
 *   else        two devices this is correct often enough that the cases it
 *               loses are ones you would not notice
 *
 * Deletes are soft (`deleted_at`), because a row removed on one device has to
 * be representable as a change the other device can receive.
 */

/**
 * The pull cursor is a SERVER timestamp: the newest `synced_at` this device
 * has seen. It replaced `sync.lastPulledAt`, which was this device's own
 * clock compared against `updated_at` stamped by the other device's clock — a
 * phone running a few minutes slow wrote rows dated before the laptop's
 * cursor, and the laptop never pulled them. A new key, so every device does
 * one full re-read when it first runs this code; merges are idempotent.
 */
const CURSOR_PULL = 'sync.lastPulledSyncedAt'
const CURSOR_PUSH = 'sync.lastPushedAt'
const CURSOR_LOG = 'sync.lastLogPushedAt'

export interface SyncResult {
  pushed: number
  pulled: number
  at: number
  error?: string
}

const iso = (ms: number) => new Date(ms).toISOString()
const ms = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0)

// --- row mapping -----------------------------------------------------------
// Postgres is snake_case, the client is camelCase. Keeping the translation in
// one place means a schema change breaks here loudly rather than in five
// scattered call sites.

type Row = Record<string, unknown>

const collectionOut = (c: Collection, userId: string): Row => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  kind: c.kind,
  pack_id: c.packId ?? null,
  sort_order: c.sortOrder,
  active: c.active,
  in_export: c.inExport,
  created_at: iso(c.createdAt),
  updated_at: iso(c.updatedAt),
  deleted_at: c.deletedAt ? iso(c.deletedAt) : null,
})

const collectionIn = (r: Row): Collection => ({
  id: r.id as string,
  name: (r.name as string) ?? '',
  kind: (r.kind as CollectionKind) ?? 'user',
  packId: (r.pack_id as string) ?? undefined,
  sortOrder: Number(r.sort_order ?? 0),
  // Both default to true rather than to false: a row written by a build that
  // did not have the column yet should leave the list being studied, not
  // silently take every word in it out of the queue.
  active: r.active == null ? true : Boolean(r.active),
  inExport: r.in_export == null ? true : Boolean(r.in_export),
  createdAt: ms(r.created_at as string),
  updatedAt: ms(r.updated_at as string),
  deletedAt: r.deleted_at ? ms(r.deleted_at as string) : undefined,
})

const conceptOut = (c: Concept, userId: string): Row => ({
  id: c.id,
  user_id: userId,
  lemma: c.lemma,
  source_lang: c.sourceLang,
  pos: c.pos,
  category: c.category,
  tags: c.tags ?? [],
  notes: c.notes ?? null,
  collection_id: c.collectionId ?? null,
  seed_id: c.seedId ?? null,
  created_at: iso(c.createdAt),
  updated_at: iso(c.updatedAt),
  deleted_at: c.deletedAt ? iso(c.deletedAt) : null,
})

const conceptIn = (r: Row): Concept => ({
  id: r.id as string,
  lemma: r.lemma as string,
  sourceLang: r.source_lang as Lang,
  pos: r.pos as Concept['pos'],
  category: r.category as Concept['category'],
  // Postgres gives back an empty array rather than null; an empty tag list and
  // no tag list mean the same thing here, so both normalise to undefined.
  tags: Array.isArray(r.tags) && r.tags.length ? (r.tags as string[]) : undefined,
  notes: (r.notes as string) ?? undefined,
  // Left undefined rather than defaulted here: `collectionOf()` resolves it,
  // and writing the default id into the row would quietly claim the word was
  // filed deliberately when it was only ever filed by omission.
  collectionId: (r.collection_id as string) ?? undefined,
  seedId: (r.seed_id as string) ?? undefined,
  createdAt: ms(r.created_at as string),
  updatedAt: ms(r.updated_at as string),
  deletedAt: r.deleted_at ? ms(r.deleted_at as string) : undefined,
})

const entryOut = (e: Entry, userId: string): Row => ({
  id: e.id,
  user_id: userId,
  concept_id: e.conceptId,
  lang: e.lang,
  headword: e.headword,
  meaning: e.meaning,
  morphology: e.morphology ?? null,
  example: e.example ?? null,
  example_gloss: e.exampleGloss ?? null,
  notes: e.notes ?? null,
  updated_at: iso(e.updatedAt),
})

const entryIn = (r: Row): Entry => ({
  id: r.id as string,
  conceptId: r.concept_id as string,
  lang: r.lang as Lang,
  headword: r.headword as string,
  meaning: r.meaning as string,
  morphology: (r.morphology as Entry['morphology']) ?? undefined,
  example: (r.example as string) ?? undefined,
  exampleGloss: (r.example_gloss as string) ?? undefined,
  notes: (r.notes as string) ?? undefined,
  updatedAt: ms(r.updated_at as string),
})

const cardOut = (c: Card, userId: string): Row => ({
  id: c.id,
  user_id: userId,
  concept_id: c.conceptId,
  lang: c.lang,
  due: iso(c.due),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsedDays,
  scheduled_days: c.scheduledDays,
  learning_steps: c.learningSteps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  last_review: c.lastReview ? iso(c.lastReview) : null,
  suspended: c.suspended ?? false,
  updated_at: iso(c.updatedAt),
})

const cardIn = (r: Row): Card => ({
  id: r.id as string,
  conceptId: r.concept_id as string,
  lang: r.lang as Lang,
  due: ms(r.due as string),
  stability: Number(r.stability),
  difficulty: Number(r.difficulty),
  elapsedDays: Number(r.elapsed_days),
  scheduledDays: Number(r.scheduled_days),
  learningSteps: Number(r.learning_steps),
  reps: Number(r.reps),
  lapses: Number(r.lapses),
  state: Number(r.state),
  lastReview: r.last_review ? ms(r.last_review as string) : undefined,
  suspended: Boolean(r.suspended),
  updatedAt: ms(r.updated_at as string),
})

const storyOut = (s: Story, userId: string): Row => ({
  id: s.id,
  user_id: userId,
  title: s.title,
  body: s.body,
  lang: s.lang,
  genre: s.genre,
  topics: s.topics ?? [],
  word_count: s.wordCount,
  known_count: s.knownCount,
  unknown_words: s.unknownWords ?? [],
  glossary: s.glossary ?? null,
  created_at: iso(s.createdAt),
  updated_at: iso(s.updatedAt),
  deleted_at: s.deletedAt ? iso(s.deletedAt) : null,
})

const storyIn = (r: Row): Story => ({
  id: r.id as string,
  title: (r.title as string) ?? '',
  body: (r.body as string) ?? '',
  lang: r.lang as Lang,
  genre: (r.genre as string) ?? 'fun',
  topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
  wordCount: Number(r.word_count ?? 0),
  knownCount: Number(r.known_count ?? 0),
  unknownWords: Array.isArray(r.unknown_words) ? (r.unknown_words as string[]) : [],
  glossary: (r.glossary as Story['glossary']) ?? undefined,
  createdAt: ms(r.created_at as string),
  updatedAt: ms(r.updated_at as string),
  deletedAt: r.deleted_at ? ms(r.deleted_at as string) : undefined,
})

/**
 * The parked-word list. Three columns and a soft delete — it is a line of
 * text with a date, and the only reason it is here at all is that the phone
 * is where words get written down and the laptop is where they get added.
 */
const laterOut = (l: LaterWord, userId: string): Row => ({
  id: l.id,
  user_id: userId,
  lemma: l.lemma,
  created_at: iso(l.createdAt),
  updated_at: iso(l.updatedAt),
  deleted_at: l.deletedAt ? iso(l.deletedAt) : null,
})

const laterIn = (r: Row): LaterWord => ({
  id: r.id as string,
  lemma: r.lemma as string,
  createdAt: ms(r.created_at as string),
  updatedAt: ms(r.updated_at as string),
  deletedAt: r.deleted_at ? ms(r.deleted_at as string) : undefined,
})

const logOut = (l: ReviewLogRow, userId: string): Row => ({
  id: l.id,
  user_id: userId,
  card_id: l.cardId,
  concept_id: l.conceptId,
  lang: l.lang,
  grade: l.grade,
  state: l.state,
  due: iso(l.due),
  stability: l.stability,
  difficulty: l.difficulty,
  elapsed_days: l.elapsedDays,
  last_elapsed_days: l.lastElapsedDays,
  scheduled_days: l.scheduledDays,
  reviewed_at: iso(l.reviewedAt),
})

/**
 * Is this error "that table or column does not exist on the server"?
 *
 * Beta and production share one database and one Supabase schema, and the
 * schema is migrated separately from the deploy. So there is a window — maybe
 * minutes, maybe a weekend — where the client knows about `collections` and
 * the server does not, and in that window every sync would fail on the first
 * push and no words, cards or reviews would reach the server at all. A
 * feature that is not finished rolling out must not be able to take sync down
 * with it.
 *
 * PostgREST answers 42P01 for an unknown relation and PGRST204/PGRST205 for a
 * column or table missing from its schema cache; the message is matched too,
 * because the code is not always populated on an older gateway.
 */
export function isMissingSchema(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  if (code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205') {
    return true
  }
  const message = (error.message ?? '').toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
}

// --- sync ------------------------------------------------------------------

/**
 * How long a sync may hold the lock before the next attempt is allowed to
 * ignore it. Longer than STEP_TIMEOUT_MS so the timeout normally wins; this is
 * only reached when the timer itself never fired.
 */
export const STALE_LOCK_MS = 60_000

/** How long a single push or pull may take before it is abandoned. */
export const STEP_TIMEOUT_MS = 45_000

/**
 * A mutex that cannot be held forever.
 *
 * Kept as its own object rather than two module-level booleans so the
 * staleness rule can be exercised by a check with fake timestamps, instead of
 * a test that waits a real minute.
 */
export class ExpiringLock {
  private held = false
  private since = 0

  constructor(private readonly staleAfterMs: number) {}

  /** True if the lock was taken; false if someone else legitimately holds it. */
  acquire(now = Date.now()): boolean {
    if (this.held && now - this.since < this.staleAfterMs) return false
    this.held = true
    this.since = now
    return true
  }

  release(): void {
    this.held = false
  }

  isHeld(now = Date.now()): boolean {
    return this.held && now - this.since < this.staleAfterMs
  }
}

const lock = new ExpiringLock(STALE_LOCK_MS)

/**
 * Bounds a promise that may never settle.
 *
 * The lock below is released in a `finally`, which makes it exception-safe but
 * not hang-safe: Supabase's fetch has no default timeout, and a request issued
 * as the tab is backgrounded on a phone can be frozen mid-flight and neither
 * resolve nor reject. Without this the lock would be held for the rest of the
 * page's life and every later sync would answer `already running`.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms)
    }),
  ])
}

/**
 * Moves a cursor forward, never back.
 *
 * A step that timed out is abandoned but keeps executing, and may finish after
 * a later sync has already advanced the cursor past its own `startedAt`.
 * Writing that older value would re-send a window of rows on the next push —
 * harmless, since every write is an idempotent upsert, but pointless.
 */
export async function advanceCursor(key: string, to: number): Promise<void> {
  const current = Number(await getMeta(key)) || 0
  if (to > current) await setMeta(key, to)
}

export async function sync(userId: string): Promise<SyncResult> {
  const at = Date.now()
  if (!navigator.onLine) return { pushed: 0, pulled: 0, at, error: 'offline' }
  // One at a time. Two overlapping syncs would race on the cursors and could
  // skip a window of changes permanently. The lock expires, though: a held
  // lock older than STALE_LOCK_MS belongs to a run that is never coming back.
  if (!lock.acquire(at)) {
    return { pushed: 0, pulled: 0, at, error: 'already running' }
  }

  // Aborting is what actually stops the request; the timeout only stops us
  // waiting for it. Both, because a frozen tab fires neither.
  const controller = new AbortController()
  const abort = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS * 2)

  try {
    const pushed = await withTimeout(
      push(userId, controller.signal),
      STEP_TIMEOUT_MS,
      'push',
    )
    const pulled = await withTimeout(
      pull(userId, controller.signal),
      STEP_TIMEOUT_MS,
      'pull',
    )
    return { pushed, pulled, at: Date.now() }
  } catch (err) {
    controller.abort()
    return {
      pushed: 0,
      pulled: 0,
      at: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(abort)
    lock.release()
  }
}

/** Whether a sync is in flight right now — for the UI and for the checks. */
export function syncLockHeld(): boolean {
  return lock.isHeld()
}

async function push(userId: string, signal: AbortSignal): Promise<number> {
  const sb = supabase()
  const since = Number(await getMeta(CURSOR_PUSH)) || 0
  // One second of overlap: clocks and transaction boundaries mean a row
  // written in the same millisecond as the cursor can otherwise be missed.
  const from = Math.max(0, since - 1000)
  const startedAt = Date.now()
  let count = 0

  // Collections before concepts: a word arriving on another device before the
  // list it belongs to would render under nothing until the next pull.
  const collections = await db.collections.filter((c) => c.updatedAt > from).toArray()
  if (collections.length) {
    const { error } = await sb
      .from('collections')
      .upsert(collections.map((c) => collectionOut(c, userId)))
      .abortSignal(signal)
    // Not fatal while the migration is still rolling out — see isMissingSchema.
    if (error && !isMissingSchema(error)) {
      throw new Error(`collections: ${error.message}`)
    }
    if (!error) count += collections.length
  }

  const concepts = await db.concepts.filter((c) => c.updatedAt > from).toArray()
  if (concepts.length) {
    const rows = concepts.map((c) => conceptOut(c, userId))
    const { error } = await sb.from('concepts').upsert(rows).abortSignal(signal)
    if (error) {
      // The columns are new. If the server has not got them yet, send the
      // words without them rather than losing the words: a vocabulary that
      // syncs minus its filing is strictly better than one that does not sync.
      if (!isMissingSchema(error)) throw new Error(`concepts: ${error.message}`)
      const stripped = rows.map(({ collection_id: _c, seed_id: _s, ...rest }) => rest)
      const retry = await sb.from('concepts').upsert(stripped).abortSignal(signal)
      if (retry.error) throw new Error(`concepts: ${retry.error.message}`)
    }
    count += concepts.length
  }

  const entries = await db.entries.filter((e) => e.updatedAt > from).toArray()
  if (entries.length) {
    const { error } = await sb
      .from('entries')
      .upsert(entries.map((e) => entryOut(e, userId)))
      .abortSignal(signal)
    if (error) throw new Error(`entries: ${error.message}`)
    count += entries.length
  }

  const cards = await db.cards.filter((c) => c.updatedAt > from).toArray()
  if (cards.length) {
    const { error } = await sb
      .from('cards')
      .upsert(cards.map((c) => cardOut(c, userId)))
      .abortSignal(signal)
    if (error) throw new Error(`cards: ${error.message}`)
    count += cards.length
  }

  const stories = await db.stories.filter((s) => s.updatedAt > from).toArray()
  if (stories.length) {
    const { error } = await sb
      .from('stories')
      .upsert(stories.map((s) => storyOut(s, userId)))
      .abortSignal(signal)
    if (error) throw new Error(`stories: ${error.message}`)
    count += stories.length
  }

  const later = await db.later.filter((l) => l.updatedAt > from).toArray()
  if (later.length) {
    const { error } = await sb
      .from('later_words')
      .upsert(later.map((l) => laterOut(l, userId)))
      .abortSignal(signal)
    if (error) throw new Error(`later_words: ${error.message}`)
    count += later.length
  }

  // Append-only: push by reviewedAt, ignore duplicates rather than updating.
  const logSince = Number(await getMeta(CURSOR_LOG)) || 0
  const logs = await db.reviewLog
    .filter((l) => l.reviewedAt > Math.max(0, logSince - 1000))
    .toArray()
  if (logs.length) {
    const { error } = await sb
      .from('review_log')
      .upsert(logs.map((l) => logOut(l, userId)), { ignoreDuplicates: true })
      .abortSignal(signal)
    if (error) throw new Error(`review_log: ${error.message}`)
    count += logs.length
  }
  await advanceCursor(CURSOR_LOG, startedAt)

  const settings = await db.settings.get('singleton')
  if (settings && settings.updatedAt > from) {
    const settingsRow: Row = {
      user_id: userId,
      display_name: settings.displayName ?? null,
      // The preferences that follow the account. `settings` here is the raw
      // row from Dexie, never the resolved view — a device's own override
      // must not be promoted to the account by the next sync.
      theme: settings.theme ?? null,
      typed_lang: settings.typedLang ?? null,
      auto_advance: settings.autoAdvance ?? null,
      speak_on_reveal: settings.speakOnReveal ?? null,
      speech_rate: settings.speechRate ?? null,
      translate_from: settings.translateFrom ?? null,
      translate_to: settings.translateTo ?? null,
      native_lang: settings.nativeLang,
      target_langs: settings.targetLangs,
      active_langs: settings.activeLangs,
      plan: settings.plan ?? null,
      daily_new_limit: settings.dailyNewLimit,
      daily_review_limit: settings.dailyReviewLimit,
      request_retention: settings.requestRetention,
      updated_at: iso(settings.updatedAt),
    }
    const { error } = await sb
      .from('user_settings')
      .upsert(settingsRow)
      .abortSignal(signal)
    if (error) {
      // `plan` is new; same rule as the concept columns above.
      if (!isMissingSchema(error)) throw new Error(`settings: ${error.message}`)
      const { plan: _plan, ...rest } = settingsRow
      const retry = await sb.from('user_settings').upsert(rest).abortSignal(signal)
      if (retry.error) throw new Error(`settings: ${retry.error.message}`)
    }
    count += 1
  }

  // Only advance the cursor once everything landed, so a mid-push failure
  // retries the whole window instead of losing part of it.
  await advanceCursor(CURSOR_PUSH, startedAt)
  return count
}

/** Rows per request. PostgREST's default `max-rows` is 1000; asking for no
 * more than that is what makes "a short page means the end" true. */
export const PULL_PAGE_SIZE = 1000

/**
 * How far back each pull re-reads past the stored cursor. `synced_at` is
 * stamped when a row is written, not when its transaction commits, so a row
 * can become visible slightly after a newer one. Re-reading a minute costs a
 * handful of rows that `mergeInto` then ignores.
 */
export const PULL_OVERLAP_MS = 60_000

/**
 * Reads every row changed since `since`, a page at a time.
 *
 * Unpaged, a query silently stops at PostgREST's row cap: the first sync on a
 * new device would get 1000 of someone's 3000 cards, advance the cursor, and
 * never ask for the rest. Pages are keyed on `synced_at` (>= the last one
 * seen, so rows sharing the boundary timestamp are not skipped) rather than on
 * offsets, which shift when a row is written mid-pull.
 *
 * `fetchPage` returns rows ordered by `synced_at` ascending. The raw string is
 * passed back as the next lower bound because it keeps Postgres' microseconds;
 * a round trip through Date would truncate them and could skip a row.
 */
export async function pullPaged(
  fetchPage: (from: string, limit: number) => Promise<Row[]>,
  since: number,
  pageSize = PULL_PAGE_SIZE,
): Promise<{ rows: Row[]; newest: number }> {
  const byId = new Map<string, Row>()
  let from = iso(Math.max(0, since - PULL_OVERLAP_MS))
  let newest = 0
  for (;;) {
    const page = await fetchPage(from, pageSize)
    for (const row of page) {
      byId.set(row.id as string, row)
      newest = Math.max(newest, ms(row.synced_at as string))
    }
    if (page.length < pageSize) break
    const last = page[page.length - 1].synced_at as string
    // A full page that never got past its own lower bound would loop forever.
    // It takes a whole page of rows written in the same microsecond.
    if (last === from) throw new Error('pull: a page of rows share one timestamp')
    from = last
  }
  return { rows: [...byId.values()], newest }
}

async function pull(userId: string, signal: AbortSignal): Promise<number> {
  const sb = supabase()
  const since = Number(await getMeta(CURSOR_PULL)) || 0
  let newest = 0
  let count = 0

  const read = async (
    table: string,
    optional = false,
  ): Promise<Row[]> => {
    const result = await pullPaged(async (from, limit) => {
      const { data, error } = await sb
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .gte('synced_at', from)
        .order('synced_at', { ascending: true })
        .limit(limit)
        .abortSignal(signal)
      if (error) {
        // A table this build knows about and the server does not yet. Reading
        // nothing is right: there cannot be rows in a table that is not there.
        if (optional && isMissingSchema(error)) return []
        throw new Error(`${table}: ${error.message}`)
      }
      return (data ?? []) as Row[]
    }, since)
    newest = Math.max(newest, result.newest)
    return result.rows
  }

  count += await mergeInto(
    db.collections,
    (await read('collections', true)).map(collectionIn),
  )
  count += await mergeInto(db.concepts, (await read('concepts')).map(conceptIn))
  count += await mergeInto(db.entries, (await read('entries')).map(entryIn))
  count += await mergeInto(db.cards, (await read('cards')).map(cardIn))
  count += await mergeInto(db.stories, (await read('stories')).map(storyIn))
  count += await mergeInto(db.later, (await read('later_words')).map(laterIn))

  const { data: remoteSettings, error: settingsErr } = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .abortSignal(signal)
    .maybeSingle()
  if (settingsErr) throw new Error(`settings: ${settingsErr.message}`)
  if (remoteSettings) {
    const local = await db.settings.get('singleton')
    const remoteAt = ms(remoteSettings.updated_at as string)
    if (!local || remoteAt > local.updatedAt) {
      const merged: Settings = {
        ...DEFAULT_SETTINGS,
        ...local,
        id: 'singleton',
        displayName: (remoteSettings.display_name as string) ?? undefined,
        theme: (remoteSettings.theme as Settings['theme']) ?? undefined,
        typedLang: (remoteSettings.typed_lang as Lang) ?? undefined,
        autoAdvance: (remoteSettings.auto_advance as boolean) ?? undefined,
        speakOnReveal: (remoteSettings.speak_on_reveal as boolean) ?? undefined,
        speechRate:
          remoteSettings.speech_rate == null
            ? undefined
            : Number(remoteSettings.speech_rate),
        translateFrom: (remoteSettings.translate_from as string) ?? undefined,
        translateTo: (remoteSettings.translate_to as string[]) ?? undefined,
        nativeLang: remoteSettings.native_lang as Lang,
        targetLangs: remoteSettings.target_langs as Lang[],
        activeLangs: remoteSettings.active_langs as Lang[],
        plan: (remoteSettings.plan as PlanName) ?? undefined,
        dailyNewLimit: Number(remoteSettings.daily_new_limit),
        dailyReviewLimit: Number(remoteSettings.daily_review_limit),
        requestRetention: Number(remoteSettings.request_retention),
        updatedAt: remoteAt,
      }
      await db.settings.put(merged)
      count += 1
    }
  }

  // Only ever a server time, and only when something came back: falling back
  // to this device's clock is exactly the bug the cursor exists to avoid.
  if (newest > 0) await advanceCursor(CURSOR_PULL, newest)
  return count
}

/**
 * Writes remote rows that are newer than what we hold. The comparison is the
 * whole of last-write-wins: a row the other device changed later wins, a row
 * we changed later is left alone and goes out on the next push.
 */
export async function mergeInto<T extends { id: string; updatedAt: number }>(
  table: { bulkGet: (ids: string[]) => Promise<(T | undefined)[]>; bulkPut: (rows: T[]) => Promise<unknown> },
  remote: T[],
): Promise<number> {
  if (remote.length === 0) return 0
  const locals = await table.bulkGet(remote.map((r) => r.id))
  const winners = remote.filter((r, i) => {
    const local = locals[i]
    return !local || r.updatedAt > local.updatedAt
  })
  if (winners.length) await table.bulkPut(winners)
  return winners.length
}

/** Clears cursors so the next sync re-reads everything. For "resync" in the UI. */
export async function resetSyncCursors() {
  await Promise.all([
    setMeta(CURSOR_PULL, 0),
    setMeta(CURSOR_PUSH, 0),
    setMeta(CURSOR_LOG, 0),
  ])
}
