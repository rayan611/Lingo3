import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { activeCollectionIds, inActiveCollection } from '../db/collections'
import { LANG_NAMES, type Entry, type Lang, type Settings } from '../db/types'
import { waitingReviewCandidates } from '../lib/waitingReview'

// Survives popup unmounts, so a new lookup picks different concepts.
const shown = new Map<string, number>()
let exposure = 0
function remember(id: string) {
  shown.delete(id)
  shown.set(id, ++exposure)
  if (shown.size > 500) shown.delete(shown.keys().next().value!)
}
type ReviewWord = { id: string; entries: Entry[]; native: Entry }

/** Passive practice only: never changes FSRS dates or records a graded review. */
export function WaitingVocabulary({ settings }: { settings: Settings }) {
  const [words, setWords] = useState<ReviewWord[]>([])
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)
  // Keep the configured positions: a paused #1 must not silently promote #3.
  const languages = settings.targetLangs.slice(0, 2)
    .filter((lang) => settings.activeLangs.includes(lang)).join(',')
  const nativeLang = settings.nativeLang

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => setVisible(true), 1500)
    async function load() {
      const targets = languages.split(',').filter(Boolean) as Lang[]
      if (!targets.length) return
      const [cards, activeLists] = await Promise.all([
        db.cards.where('lang').anyOf(targets).toArray(), activeCollectionIds(),
      ])
      const ranked = waitingReviewCandidates(cards, Date.now(), shown)
      if (!ranked.length) return
      const concepts = await db.concepts.bulkGet(ranked)
      const eligible = concepts.filter((c) => c && !c.deletedAt && inActiveCollection(c, activeLists))
      const ids = eligible.map((c) => c!.id)
      const entries = await db.entries.where('conceptId').anyOf(ids).toArray()
      const groups = new Map<string, Entry[]>()
      for (const entry of entries) {
        const group = groups.get(entry.conceptId) ?? []
        group.push(entry)
        groups.set(entry.conceptId, group)
      }
      const review: ReviewWord[] = []
      for (const id of ids) {
        const group = groups.get(id) ?? []
        const native = group.find((e) => e.lang === nativeLang && e.headword.trim())
        // The native entry is a known translation in the CURRENT native language.
        // Stored glosses may have been generated before that setting changed.
        const rows = targets.flatMap((lang) => group.filter((e) => e.lang === lang && e.headword.trim()))
        if (native && rows.length) review.push({ id, entries: rows, native })
        if (review.length === 30) break
      }
      if (!cancelled) { setWords(review); setIndex(0) }
    }
    void load().catch(() => { /* Optional practice never interrupts a lookup. */ })
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [languages, nativeLang])

  const word = words[index % (words.length || 1)]
  useEffect(() => {
    if (visible && !closed && word) remember(word.id)
  }, [visible, closed, word])

  useEffect(() => {
    if (!visible || closed) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setClosed(true) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [visible, closed])

  if (!visible || closed || !word) return null
  return (
    <aside className="waiting-vocabulary" role="dialog" aria-modal="false" aria-labelledby="waiting-vocabulary-title">
      <div className="waiting-vocabulary-header">
        <h3 id="waiting-vocabulary-title">Review some words while the app is thinking</h3>
        <button type="button" onClick={() => setClosed(true)} aria-label="Close vocabulary popup">✕</button>
      </div>
      <div className="waiting-vocabulary-words" aria-live="polite">
        {word.entries.map((entry, position) => (
          <div key={entry.id} className={`waiting-vocabulary-language waiting-vocabulary-language-${position + 1}`}>
            <span className="waiting-vocabulary-label">{LANG_NAMES[entry.lang]}</span>
            <strong lang={entry.lang} dir="auto">{entry.headword}</strong>
            <span className="waiting-vocabulary-meaning" lang={nativeLang} dir="auto">{word.native.headword}</span>
          </div>
        ))}
      </div>
      {words.length > 1 && <button className="waiting-vocabulary-next" type="button" onClick={() => setIndex((i) => (i + 1) % words.length)}>Next word →</button>}
    </aside>
  )
}
