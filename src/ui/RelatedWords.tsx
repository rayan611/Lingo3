import { useEffect, useState } from 'react'
import { db, lemmaKey } from '../db/db'
import { parkWord } from '../db/later'
import { SpeakButton } from './SpeakButton'
import { addRelatedWord, RELATED_STAGGER_DAYS } from '../ai/expand'
import { aiErrorText } from '../ai/unavailable'
import {
  LANG_BCP47,
  LANG_NAMES,
  LINK_LABELS,
  LINK_SYMBOLS,
  RTL_LANGS,
  linkKindOf,
  type Category,
  type RelatedWord,
  type Settings,
} from '../db/types'

/**
 * Words worth knowing beside this one.
 *
 * Suggestions only — nothing is added without a click. Two reasons, and the
 * second is the real one:
 *
 *   1. a list you did not ask for silently doubling your deck is unpleasant;
 *   2. semantically similar words learned at the same time interfere with each
 *      other, so a word and its register variant should not arrive in the same
 *      review session. Added words wait a few days for their first review.
 *
 * Each one can also be parked on the add-later list, for when now is not the
 * moment to take it on.
 *
 * What is asked for is register rather than synonymy: hallo and tjena mean the
 * same thing, and knowing which to use with your manager is the part a
 * dictionary will not tell you.
 */
export function RelatedWords({
  related,
  settings,
  category,
}: {
  related: RelatedWord[]
  settings: Settings
  category: Category
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<
    Record<string, { text: string; failed?: boolean }>
  >({})
  const [known, setKnown] = useState<Set<string>>(new Set())

  const shown = related.filter(
    (r) => r.lang !== settings.nativeLang && settings.targetLangs.includes(r.lang),
  )

  // Anything already in the list is not a suggestion. Checked against stored
  // headwords too, so a word you added in Swedish is not offered again here.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const hits = new Set<string>()
      for (const r of shown) {
        const key = lemmaKey(r.word, r.lang)
        const match = await db.entries
          .where('lang')
          .equals(r.lang)
          .filter((e) => lemmaKey(e.headword, e.lang) === key)
          .first()
        if (match) hits.add(`${r.lang}:${r.word}`)
      }
      if (!cancelled) setKnown(hits)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [related])

  if (shown.length === 0) return null

  async function later(r: RelatedWord) {
    const id = `${r.lang}:${r.word}`
    const added = await parkWord(r.word)
    setDone((d) => ({
      ...d,
      [id]: { text: added ? 'saved for later' : 'already on the later list' },
    }))
  }

  async function add(r: RelatedWord) {
    const id = `${r.lang}:${r.word}`
    setBusy(id)
    try {
      const result = await addRelatedWord({
        lemma: r.word,
        sourceLang: r.lang,
        category,
        settings,
      })
      setDone((d) => ({
        ...d,
        [id]: {
          text:
            result.status === 'duplicate'
              ? 'already saved'
              : result.status === 'queued'
                ? 'saved — will expand later'
                : `added, first review in ${RELATED_STAGGER_DAYS} days`,
        },
      }))
    } catch (err) {
      setDone((d) => ({
        ...d,
        [id]: {
          text: aiErrorText(err, 'Adding words'),
          failed: true,
        },
      }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="panel related">
      <h3>Linked words</h3>
      <p className="muted small" title={`Added words wait ${RELATED_STAGGER_DAYS} days before their first review.`}>
        ↔ opposite · ≈ similar · ≠ easily confused. They also show beside the word in Review.
      </p>

      <ul className="related-list">
        {shown.map((r) => {
          const id = `${r.lang}:${r.word}`
          const status = done[id]
          const already = known.has(id)
          const kind = linkKindOf(r.kind, r.register)
          return (
            <li key={id}>
              <div className="related-main">
                <span className={`link-sym kind-${kind}`} title={LINK_LABELS[kind]}>
                  {LINK_SYMBOLS[kind]}
                </span>
                <span
                  className={`related-word ${RTL_LANGS.has(r.lang) ? 'rtl' : ''}`}
                  lang={LANG_BCP47[r.lang]}
                >
                  {r.word}
                </span>
                <span className="badge subtle">{LANG_NAMES[r.lang]}</span>
                {r.register && <span className="badge">{r.register}</span>}
                <SpeakButton
                  text={r.word}
                  lang={r.lang}
                  label="Listen"
                  rate={settings.speechRate}
                />
              </div>
              {r.meaning && <div className="related-meaning">{r.meaning}</div>}
              {r.note && <div className="note">{r.note}</div>}
              {r.example && kind !== 'synonym' && (
                <div className="related-example" lang={LANG_BCP47[r.lang]}>
                  {r.example}
                  {r.exampleGloss && (
                    <div
                      className={`example-gloss ${RTL_LANGS.has(settings.nativeLang) ? 'rtl' : ''}`}
                      lang={LANG_BCP47[settings.nativeLang]}
                    >
                      {r.exampleGloss}
                    </div>
                  )}
                </div>
              )}
              <div className="related-action">
                {status ? (
                  <span
                    className={`related-result ${status.failed ? 'failed' : ''}`}
                  >
                    {status.text}
                  </span>
                ) : already ? (
                  <span className="muted small">already in your list</span>
                ) : (
                  <>
                    <button
                      className="chip"
                      disabled={busy !== null}
                      onClick={() => void add(r)}
                    >
                      {busy === id ? 'adding…' : '+ add'}
                    </button>
                    <button
                      type="button"
                      className="link small"
                      disabled={busy !== null}
                      onClick={() => void later(r)}
                    >
                      + add later
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
