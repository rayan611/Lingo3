import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { listCollections } from '../db/collections'
import { matchesTopic } from '../fsrs/queue'
import { PARTS_OF_SPEECH, collectionOf, type Concept, type Settings } from '../db/types'
import { WordCard } from './WordCard'
import { IconHome } from './icons'

type Sort = 'added' | 'unseen' | 'oldest' | 'hardest' | 'alpha'

const SORT_LABELS: Record<Sort, string> = {
  added: 'Newest first',
  unseen: 'Not reviewed first',
  oldest: 'Oldest first',
  hardest: 'Hardest first',
  alpha: 'A–Z',
}

/**
 * When each word was last on screen here, on this device.
 *
 * localStorage and not Dexie: it is a reading aid, not study data — it must
 * not sync, and above all it must never come near FSRS (see below). Losing it
 * costs nothing but the order of "Not reviewed first".
 */
const SEEN_KEY = 'lingo3.reviewSeen'

function readSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function markSeen(conceptId: string) {
  try {
    const seen = readSeen()
    seen[conceptId] = Date.now()
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {
    // Private mode or full storage: the order just stays as it was.
  }
}

/**
 * Simple shows each language's word and meaning; Advanced adds the example
 * sentences, the forms (conjugations, plurals) and notes. A reading
 * preference for this device, so it lives beside the seen list and does not
 * sync.
 */
type Mode = 'simple' | 'advanced'
const MODE_KEY = 'lingo3.reviewMode'

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'advanced' ? 'advanced' : 'simple'
  } catch {
    return 'simple'
  }
}

function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // Private mode or full storage: the choice lasts until the screen closes.
  }
}

/** The Type picker carries both topics and parts of speech, prefixed apart. */
function matchesKind(concept: Concept, kind: string): boolean {
  if (kind === 'all') return true
  if (kind.startsWith('pos:')) return concept.pos === kind.slice(4)
  return matchesTopic(concept, kind.slice(4))
}

/**
 * Review: step through words without being asked anything.
 *
 * The hard rule here is that nothing in this screen touches FSRS state. No
 * grades, no review log, no card writes. If browsing counted as a review,
 * every interval would quietly inflate and the scheduler would stop meaning
 * anything — which is the same failure as one card carrying three languages'
 * answers, just arriving from the other direction.
 *
 * Full screen, like the recall test: the header and tiles are hidden, a thin
 * bar holds Home and the three pickers, and the word with every language fits
 * one phone screen. The Previous / Next bar is fixed to the foot of the
 * screen, so Next is under the thumb in the same place on every word however
 * short or long the card is. The word's list, type and topics sit below the
 * card — tap the native word to get there.
 *
 * The native-language gloss of the example is shown here. It is hidden during
 * a test, where it would hand you the answer; here, reading it is the point.
 */
export function Training({
  settings,
  onExit,
}: {
  settings: Settings
  onExit: () => void
}) {
  const [list, setList] = useState('all')
  const [kind, setKind] = useState('all')
  const [sort, setSort] = useState<Sort>('added')
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>(readMode)
  const chooseMode = (m: Mode) => {
    setMode(m)
    saveMode(m)
  }

  const collections = useLiveQuery(() => listCollections(), [], [])

  /** Topics and parts of speech actually in use, for the Type picker. */
  const kinds = useLiveQuery(
    async () => {
      const all = await db.concepts.toArray()
      const topics = new Set<string>()
      const pos = new Set<string>()
      for (const c of all) {
        if (c.deletedAt) continue
        if (c.category) topics.add(c.category)
        for (const t of c.tags ?? []) topics.add(t)
        if (c.pos) pos.add(c.pos)
      }
      return {
        topics: [...topics].sort(),
        pos: PARTS_OF_SPEECH.filter((p) => pos.has(p)),
      }
    },
    [],
    { topics: [] as string[], pos: [] as string[] },
  )

  /**
   * Difficulty comes straight off the FSRS cards that already exist — reading
   * it costs nothing and needs no new field. A word's difficulty is the worst
   * among its active languages, which is the one that will keep pulling it
   * forward in the queue anyway.
   */
  const words = useLiveQuery(
    async () => {
      const concepts = await db.concepts.orderBy('createdAt').reverse().toArray()
      const live = concepts.filter(
        (c) =>
          !c.deletedAt &&
          (list === 'all' || collectionOf(c) === list) &&
          matchesKind(c, kind),
      )
      if (sort !== 'hardest') return { list: live, difficulty: new Map<string, number>() }

      const cards = await db.cards
        .where('lang')
        .anyOf(settings.activeLangs as string[])
        .toArray()
      const difficulty = new Map<string, number>()
      for (const card of cards) {
        if (card.suspended) continue
        difficulty.set(
          card.conceptId,
          Math.max(difficulty.get(card.conceptId) ?? 0, card.difficulty),
        )
      }
      return { list: live, difficulty }
    },
    [list, kind, sort, settings.activeLangs],
    { list: [] as Concept[], difficulty: new Map<string, number>() },
  )

  /**
   * Read once per choice of filter and order, not on every render: the word
   * on screen is marked seen as you arrive, and re-sorting on that would move
   * the next word out from under the Next button.
   */
  const seen = useMemo(() => readSeen(), [list, kind, sort])

  const ordered = useMemo(() => {
    const out = [...words.list]
    if (sort === 'oldest') out.reverse()
    else if (sort === 'alpha')
      out.sort((a, b) => a.lemma.localeCompare(b.lemma))
    else if (sort === 'hardest')
      out.sort(
        (a, b) =>
          (words.difficulty.get(b.id) ?? 0) - (words.difficulty.get(a.id) ?? 0),
      )
    // Never seen first (newest first among them, as they already are), then
    // the ones seen longest ago. A stable sort keeps the rest in place.
    else if (sort === 'unseen')
      out.sort((a, b) => (seen[a.id] ?? 0) - (seen[b.id] ?? 0))
    return out
  }, [words, sort, seen])

  /** The word on screen, so a change to the list cannot swap it (below). */
  const shown = useRef<{ id: string; filterKey: string } | null>(null)

  // Changing the filter should not leave you pointing past the end of the list.
  useEffect(() => {
    setIndex(0)
    shown.current = null
  }, [list, kind, sort])

  // A word added while you read — from a linked word's popup, or on another
  // device — lands in the list and would shift everything after it, putting a
  // different word under you. Stay on the word you were reading.
  // A new filter or order does start again from the top (see above).
  const filterKey = `${list}|${kind}|${sort}`
  let at = Math.min(index, Math.max(0, ordered.length - 1))
  if (shown.current?.filterKey === filterKey && ordered[at]?.id !== shown.current.id) {
    const pinned = shown.current.id
    const same = ordered.findIndex((c) => c.id === pinned)
    if (same >= 0) at = same
  }
  useEffect(() => {
    if (at !== index) setIndex(at)
  }, [at, index])
  const current = ordered[at]
  shown.current = current ? { id: current.id, filterKey } : null
  const last = ordered.length - 1
  // Moving on is the one change that must move the word under you: the
  // remembered word moves with it, or the check above would put you back.
  const goTo = (target: number) => {
    const to = Math.max(0, Math.min(target, last))
    const word = ordered[to]
    shown.current = word ? { id: word.id, filterKey } : null
    setIndex(to)
  }
  const next = () => goTo(at + 1)
  const prev = () => goTo(at - 1)
  // The key handler is attached once per list; it reads the current moves.
  const moves = useRef({ next, prev })
  moves.current = { next, prev }

  const currentId = current?.id
  useEffect(() => {
    if (currentId) markSeen(currentId)
    // A new word starts at the top: the previous one may have been left
    // scrolled down to its settings.
    window.scrollTo({ top: 0 })
  }, [currentId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault()
        moves.current.next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moves.current.prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ordered.length])

  /** Swipe left for the next word, right for the previous one. */
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = t ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    const t = e.changedTouches[0]
    touch.current = null
    if (!start || !t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) next()
    else prev()
  }

  const listName =
    list === 'all' ? 'All lists' : collections.find((c) => c.id === list)?.name ?? 'All lists'
  const kindName = kind === 'all' ? 'All types' : kind.slice(4)
  const filtered = list !== 'all' || kind !== 'all'

  const bar = (
    <div className="flash-bar">
      <button
        type="button"
        className="flash-back"
        onClick={onExit}
        aria-label="Home"
        title="Home"
      >
        <IconHome />
      </button>
      <Pick label="List" value={listName}>
        <select
          value={list}
          onChange={(e) => setList(e.target.value)}
          aria-label="Which list"
        >
          <option value="all">All lists</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Pick>
      <Pick label="Type" value={kindName}>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Which topic or part of speech"
        >
          <option value="all">All types</option>
          {kinds.topics.length > 0 && (
            <optgroup label="Topics">
              {kinds.topics.map((t) => (
                <option key={t} value={`tag:${t}`}>
                  {t}
                </option>
              ))}
            </optgroup>
          )}
          {kinds.pos.length > 0 && (
            <optgroup label="Part of speech">
              {kinds.pos.map((p) => (
                <option key={p} value={`pos:${p}`}>
                  {p}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Pick>
      <Pick label="Order" value={SORT_LABELS[sort]}>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Order"
        >
          {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </Pick>
    </div>
  )

  if (ordered.length === 0) {
    return (
      <div className="flash">
        {bar}
        <div className="panel">
          <p className="muted">
            {filtered
              ? 'No words match this list and type.'
              : 'No words yet. Add some on the Add tab.'}
          </p>
          {filtered && (
            <button
              onClick={() => {
                setList('all')
                setKind('all')
              }}
            >
              Show all words
            </button>
          )}
        </div>
      </div>
    )
  }

  // Fixed to the foot of the screen, so Next stays under the thumb in the same
  // place on every word — and still in view when you scroll down to the
  // word's settings.
  const nav = (
    <div className="flash-nav">
      <button onClick={prev} disabled={at === 0} aria-label="Previous word">
        ←
      </button>
      <span className="muted small">
        {Math.min(at + 1, ordered.length)} / {ordered.length}
      </span>
      <button
        className="primary"
        onClick={next}
        disabled={at >= last}
        aria-label="Next word"
      >
        Next →
      </button>
    </div>
  )

  return (
    <div
      className={`flash flash-${mode}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {bar}
      <div className="flash-mode" role="group" aria-label="How much to show">
        {(['simple', 'advanced'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? 'on' : ''}
            aria-pressed={mode === m}
            onClick={() => chooseMode(m)}
          >
            {m === 'simple' ? 'Simple' : 'Advanced'}
          </button>
        ))}
      </div>
      {current && (
        <WordCard conceptId={current.id} settings={settings} flash between={nav} />
      )}
      <p className="muted small flash-note">
        Reading only — nothing here changes your review schedule.
      </p>
    </div>
  )
}

/**
 * A small picker: its name above, the choice below, and the real select laid
 * invisibly over the whole thing, so a tap anywhere opens the native list and
 * a long name still ends in a proper ellipsis.
 */
function Pick({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) {
  return (
    <label className="flash-pick">
      <span className="flash-pick-label">{label}</span>
      <span className="flash-pick-value" aria-hidden="true">
        <span className="flash-pick-text">{value}</span>
        <span className="flash-pick-caret">▾</span>
      </span>
      {children}
    </label>
  )
}
