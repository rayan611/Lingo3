import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { activeTargets, LANG_NAMES, type Entry, type Settings } from '../db/types'

/** Local vocabulary only: waiting entertainment must not compete with the lookup. */
export function WaitingVocabulary({ settings }: { settings: Settings }) {
  const [words, setWords] = useState<Entry[][]>([])
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)
  const languages = [settings.nativeLang, ...activeTargets(settings)].join(',')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => setVisible(true), 1500)
    async function load() {
      const concepts = await db.concepts.orderBy('createdAt').reverse()
        .filter((c) => !c.deletedAt).limit(30).toArray()
      const entries = await db.entries.where('conceptId').anyOf(concepts.map((c) => c.id)).toArray()
      const order = languages.split(',')
      const groups = concepts.map((c) => entries.filter((e) => e.conceptId === c.id && order.includes(e.lang))
        .sort((a, b) => order.indexOf(a.lang) - order.indexOf(b.lang)))
        .filter((group) => group.some((e) => order.slice(1).includes(e.lang)))
      if (!cancelled) {
        setWords(groups)
        setIndex(groups.length ? Math.floor(Math.random() * groups.length) : 0)
      }
    }
    void load().catch(() => { /* Optional entertainment never interrupts a lookup. */ })
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [languages])

  useEffect(() => {
    if (!visible || closed) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setClosed(true)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [visible, closed])

  const word = words[index % (words.length || 1)]
  if (!visible || closed || !word) return null
  return (
    <aside className="waiting-vocabulary" role="dialog" aria-modal="false" aria-labelledby="waiting-vocabulary-title">
      <div className="waiting-vocabulary-header">
        <h3 id="waiting-vocabulary-title">A word while you wait</h3>
        <button type="button" onClick={() => setClosed(true)} aria-label="Close vocabulary popup">✕</button>
      </div>
      <p className="muted small">From your saved words. Your lookup is still running.</p>
      <div className="waiting-vocabulary-words" aria-live="polite">
        {word.map((entry) => (
          <div key={entry.id}>
            <span className="muted small">{LANG_NAMES[entry.lang]}</span>
            <strong lang={entry.lang} dir="auto">{entry.headword}</strong>
            <span dir="auto">{entry.meaning}</span>
          </div>
        ))}
      </div>
      {words.length > 1 && <button type="button" onClick={() => setIndex((i) => (i + 1) % words.length)}>Next word →</button>}
    </aside>
  )
}
