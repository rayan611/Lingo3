import { useEffect, useMemo, useState } from 'react'
import {
  GENRES,
  LEVELS,
  buildIndex,
  lemmaOf,
  loadDone,
  loadStories,
  loadVocab,
  lookupWord,
  pickNext,
  saveDone,
  splitText,
  wordCount,
  type GenreId,
  type Level,
  type ReadingStory,
  type VocabEntry,
} from '../reading/library'
import { addRelatedWord } from '../ai/expand'
import { SpeakButton } from './SpeakButton'
import type { Settings } from '../db/types'

/**
 * Stories written ahead of time from the word bank, one level at a time.
 *
 * A story at level B1 uses B1 words and the A1 and A2 words beneath it, so
 * choosing several levels only widens the list. Tapping a word shows its
 * English and German from the bank; the learner decides which ones become
 * their own words, and nothing is added without that tap.
 */
export function ReadingLibrary({ settings }: { settings: Settings }) {
  const [stories, setStories] = useState<ReadingStory[] | null>(null)
  const [vocab, setVocab] = useState<VocabEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [levels, setLevels] = useState<Level[]>(['A1'])
  const [genre, setGenre] = useState<GenreId | null>(null)
  const [done, setDone] = useState<Set<string>>(() => loadDone())
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadStories().then((s) => alive && setStories(s), (e) => alive && setError(String(e.message ?? e)))
    loadVocab().then((v) => alive && setVocab(v), () => undefined)
    return () => {
      alive = false
    }
  }, [])

  const index = useMemo(() => (vocab ? buildIndex(vocab) : null), [vocab])
  const visible = useMemo(
    () => (stories ?? []).filter((s) => levels.includes(s.level) && (!genre || s.genre === genre)),
    [stories, levels, genre],
  )
  const open = stories?.find((s) => s.id === openId) ?? null

  function toggleDone(id: string) {
    setDone((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveDone(next)
      return next
    })
  }

  function toggleLevel(l: Level) {
    setLevels((cur) => (cur.includes(l) ? (cur.length > 1 ? cur.filter((x) => x !== l) : cur) : [...cur, l]))
  }

  function newStory(exclude?: string) {
    const next = pickNext(stories ?? [], levels, done, exclude)
    if (next) setOpenId(next.id)
  }

  if (error) return <p role="alert" className="muted">The library could not be loaded: {error}. Check your connection and try again.</p>
  if (!stories) return <p className="muted">Loading the library…</p>

  if (open) {
    return (
      <Reader
        story={open}
        index={index}
        settings={settings}
        isDone={done.has(open.id)}
        onToggleDone={() => toggleDone(open.id)}
        onBack={() => setOpenId(null)}
        onNext={() => newStory(open.id)}
      />
    )
  }

  return (
    <section className="reading" aria-labelledby="reading-title">
      <h2 id="reading-title">Reading Library</h2>
      <p className="muted small">
        Swedish stories built from the word bank. Pick one level or several: a B1 story also uses A1 and A2 words.
        Tap any word to see English and German.
      </p>
      <div className="tag-row" role="group" aria-label="Level">
        {LEVELS.map((l) => (
          <button key={l} type="button" aria-pressed={levels.includes(l)}
            className={`chip ${levels.includes(l) ? 'chip-on' : ''}`} onClick={() => toggleLevel(l)}>{l}</button>
        ))}
      </div>
      <div className="tag-row" role="group" aria-label="Kind of text">
        <button type="button" aria-pressed={genre === null} className={`chip ${genre === null ? 'chip-on' : ''}`} onClick={() => setGenre(null)}>All</button>
        {GENRES.map((g) => (
          <button key={g.id} type="button" aria-pressed={genre === g.id}
            className={`chip ${genre === g.id ? 'chip-on' : ''}`} onClick={() => setGenre(genre === g.id ? null : g.id)}>{g.label}</button>
        ))}
      </div>
      <div className="row reading-bar">
        <button type="button" className="primary" disabled={visible.length === 0} onClick={() => newStory()}>New story</button>
        <span className="muted small">{visible.filter((s) => done.has(s.id)).length} of {visible.length} read</span>
      </div>
      {visible.length === 0 ? (
        <p className="muted">No stories for this choice yet.</p>
      ) : (
        <ul className="reading-list">
          {visible.map((s) => (
            <li key={s.id} className={done.has(s.id) ? 'is-done' : undefined}>
              <input type="checkbox" checked={done.has(s.id)} onChange={() => toggleDone(s.id)}
                aria-label={`Mark "${s.title.sv}" as read`} />
              <button type="button" className="reading-item" onClick={() => setOpenId(s.id)}>
                <strong lang="sv">{s.title.sv}</strong>
                <span className="muted small">{s.title.en}</span>
                <span className="small">
                  <span className="badge">{s.level}</span>{' '}
                  {GENRES.find((g) => g.id === s.genre)?.label} · {wordCount(s)} words
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Reader({ story, index, settings, isDone, onToggleDone, onBack, onNext }: {
  story: ReadingStory
  index: ReturnType<typeof buildIndex> | null
  settings: Settings
  isDone: boolean
  onToggleDone: () => void
  onBack: () => void
  onNext: () => void
}) {
  const [showEn, setShowEn] = useState(false)
  const [picked, setPicked] = useState<{ word: string; hits: VocabEntry[] | null } | null>(null)
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    window.scrollTo?.({ top: 0 })
    setPicked(null)
    setStatus('')
  }, [story.id])

  function tap(word: string) {
    setStatus('')
    setPicked({ word, hits: index ? lookupWord(index, word) : null })
  }

  async function add(lemma: string) {
    setAdding(true)
    try {
      const result = await addRelatedWord({ lemma, sourceLang: 'sv', category: 'daily', settings })
      setStatus(result.status === 'duplicate' ? 'Already in your words.'
        : result.status === 'queued' ? 'Saved. It will fill in when you are back online.' : 'Added to your words.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  const entry = picked?.hits?.[0] ?? null
  return (
    <article className="reading-reader">
      <button type="button" className="link" onClick={onBack}>← Library</button>
      <h2 lang="sv">{story.title.sv}</h2>
      <p className="muted small">{story.title.en} · <span className="badge">{story.level}</span></p>
      <div className="row">
        <SpeakButton text={story.p.map((p) => p.sv).join(' ')} lang="sv" label="Read this story aloud" rate={settings.speechRate} />
        <button type="button" className={`chip ${showEn ? 'chip-on' : ''}`} aria-pressed={showEn} onClick={() => setShowEn(!showEn)}>
          English
        </button>
      </div>

      {story.p.map((p, i) => (
        <div key={i} className="story-body" lang="sv">
          <p className="story-para">
            {splitText(p.sv).map((seg, j) => seg.word
              ? <button key={j} type="button" className="story-word" onClick={() => tap(seg.text)}>{seg.text}</button>
              : <span key={j}>{seg.text}</span>)}
          </p>
          {showEn && <p className="muted small reading-en" lang="en">{p.en}</p>}
        </div>
      ))}

      {picked && (
        <div className="story-lookup reading-lookup" role="status">
          <div className="row">
            <strong lang="sv">{entry?.sv ?? picked.word}</strong>
            <SpeakButton text={picked.word} lang="sv" rate={settings.speechRate} />
            {entry && <span className="badge">{entry.l === 'X' ? 'own list' : entry.l}</span>}
          </div>
          {entry ? (
            <>
              <span>English: {entry.en}</span>
              <span>Deutsch: {entry.de || 'not in the bank for this level; add the word to get it'}</span>
              {entry.f && entry.f.length > 1 && <span className="muted small" lang="sv">{entry.f.join(' · ')}</span>}
              {entry.x && <span className="muted small" lang="sv">{entry.x[0]}<br />{entry.x[1]}</span>}
            </>
          ) : (
            <span className="muted">{index ? 'Not in the word bank.' : 'Word bank still loading.'}</span>
          )}
          <div className="row">
            <button type="button" className="chip" disabled={adding} onClick={() => void add(entry ? lemmaOf(entry) : picked.word.toLocaleLowerCase())}>
              {adding ? 'adding…' : '+ add to my words'}
            </button>
            <button type="button" className="link" onClick={() => setPicked(null)}>close</button>
          </div>
          {status && <span className="small" role="status">{status}</span>}
        </div>
      )}

      <div className="row reading-bar">
        <button type="button" className={isDone ? '' : 'primary'} onClick={onToggleDone}>{isDone ? '✓ Read (undo)' : 'Mark as read'}</button>
        <button type="button" onClick={onNext}>New story</button>
      </div>
    </article>
  )
}
