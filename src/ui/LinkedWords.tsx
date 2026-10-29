import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { db, lemmaKey } from '../db/db'
import { addRelatedWord, RELATED_STAGGER_DAYS } from '../ai/expand'
import { aiErrorText } from '../ai/unavailable'
import { formCandidates } from '../lib/highlight'
import {
  LANG_BCP47,
  LINK_LABELS,
  LINK_SYMBOLS,
  RTL_LANGS,
  type Lang,
  type Morphology,
  type Settings,
  type WordLink,
} from '../db/types'
import { ExampleSentence } from './ExampleSentence'
import { SpeakButton } from './SpeakButton'

/**
 * A word's opposites, common synonyms and look-alikes, as one line of small
 * chips: "↔ vit · ≈ jobba · ≠ lån".
 *
 * Deliberately small. It sits in the space left at the end of the word's
 * line on the Review card and the test answer, and takes a line of its own
 * only when there is no room. A tap opens the linked word in a popup; closing
 * it puts you back exactly where you were. Nothing here grades anything.
 */
export function LinkedWords({
  links,
  lang,
  headword,
  form,
  settings,
}: {
  links: WordLink[] | undefined
  lang: Lang
  /** The word the chips belong to, marked in the shared example too. */
  headword: string
  form?: Morphology['form']
  settings: Settings
}) {
  const [open, setOpen] = useState<WordLink | null>(null)
  if (!links?.length) return null

  return (
    <>
      <div className="links" aria-label="Linked words">
        {links.map((link) => (
          <button
            key={`${link.kind}:${link.word}`}
            type="button"
            className={`link-chip kind-${link.kind}`}
            title={`${LINK_LABELS[link.kind]}${link.meaning ? ` — ${link.meaning}` : ''}`}
            onClick={() => setOpen(link)}
          >
            <span className="link-sym" aria-label={LINK_LABELS[link.kind]}>
              {LINK_SYMBOLS[link.kind]}
            </span>
            <span lang={LANG_BCP47[lang]}>{link.word}</span>
          </button>
        ))}
      </div>
      {open && (
        <LinkPopup
          link={open}
          lang={lang}
          forms={[
            ...formCandidates(open.word, lang, undefined),
            ...formCandidates(headword, lang, form),
          ]}
          settings={settings}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}

const HISTORY_FLAG = 'lingo3Link'

/**
 * One linked word: what it means, how it sounds, the sentence with both
 * words, and a way to add it to your words. ✕, a tap outside, Escape or the
 * phone's Back close it.
 *
 * Rendered into <body> so it sits above everything, and it keeps its keys and
 * touches to itself: Review reads Space and 1–4, and Training reads swipes,
 * and none of them should act on a card behind an open popup.
 */
function LinkPopup({
  link,
  lang,
  forms,
  settings,
  onClose,
}: {
  link: WordLink
  lang: Lang
  forms: string[]
  settings: Settings
  onClose: () => void
}) {
  const [known, setKnown] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; failed?: boolean } | null>(null)

  // Is it already one of your words? Compared with and without its article.
  useEffect(() => {
    let cancelled = false
    const bare = (w: string) => {
      const parts = w.trim().split(/\s+/)
      return parts.length > 1 && parts[0].length <= 3 ? parts.slice(1).join(' ') : w
    }
    const keys = new Set([lemmaKey(link.word, lang), lemmaKey(bare(link.word), lang)])
    void db.entries
      .where('lang')
      .equals(lang)
      .filter(
        (e) =>
          keys.has(lemmaKey(e.headword, lang)) || keys.has(lemmaKey(bare(e.headword), lang)),
      )
      .first()
      .then((hit) => {
        if (!cancelled) setKnown(Boolean(hit))
      })
    return () => {
      cancelled = true
    }
  }, [link.word, lang])

  // Back closes the popup, not the screen behind it.
  useEffect(() => {
    // Once: an effect that runs twice (React's development check) must not
    // leave a second entry that Back would have to pop first.
    if (!window.history.state?.[HISTORY_FLAG]) {
      window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_FLAG]: true }, '')
    }
    const onPop = (e: PopStateEvent) => {
      if (!e.state?.[HISTORY_FLAG]) onClose()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function close() {
    if (window.history.state?.[HISTORY_FLAG]) window.history.back()
    else onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      // Keep Space, 1–4 and the arrows away from the screen behind.
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function add() {
    setBusy(true)
    try {
      const r = await addRelatedWord({
        lemma: link.word,
        sourceLang: lang,
        category: 'daily',
        settings,
      })
      setResult({
        text:
          r.status === 'duplicate'
            ? 'Already in your words.'
            : r.status === 'queued'
              ? 'Saved — it will be filled in when the AI answers.'
              : `✓ Added. Its first review is in ${RELATED_STAGGER_DAYS} days.`,
      })
      setKnown(true)
    } catch (err) {
      setResult({ text: aiErrorText(err, 'Adding words'), failed: true })
    } finally {
      setBusy(false)
    }
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return createPortal(
    <div
      className="link-overlay"
      onClick={close}
      onTouchStart={stop}
      onTouchEnd={stop}
    >
      <div
        className="link-popup"
        role="dialog"
        aria-modal="true"
        aria-label={link.word}
        onClick={stop}
      >
        <button type="button" className="link-close" onClick={close} aria-label="Close">
          ✕
        </button>
        <div className={`link-kind kind-${link.kind}`}>
          {LINK_SYMBOLS[link.kind]} {LINK_LABELS[link.kind]}
          {link.register && <span className="badge">{link.register}</span>}
        </div>
        <div className="link-word-row">
          <span
            className={`link-word ${RTL_LANGS.has(lang) ? 'rtl' : ''}`}
            lang={LANG_BCP47[lang]}
          >
            {link.word}
          </span>
          <SpeakButton text={link.word} lang={lang} rate={settings.speechRate} />
        </div>
        {link.meaning && <div className="link-meaning">{link.meaning}</div>}
        {link.note && <div className="note">{link.note}</div>}
        {link.example && (
          <ExampleSentence
            text={link.example}
            lang={lang}
            forms={forms}
            rate={settings.speechRate}
            gloss={
              link.exampleGloss ? (
                <div
                  className={`example-gloss ${RTL_LANGS.has(settings.nativeLang) ? 'rtl' : ''}`}
                  lang={LANG_BCP47[settings.nativeLang]}
                >
                  {link.exampleGloss}
                </div>
              ) : undefined
            }
          />
        )}
        <div className="link-actions">
          {result ? (
            <span className={`related-result ${result.failed ? 'failed' : ''}`}>
              {result.text}
            </span>
          ) : known ? (
            <span className="muted small">✓ Already in your words</span>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={busy || known === null}
              onClick={() => void add()}
            >
              {busy ? 'Adding…' : '+ Add to my words'}
            </button>
          )}
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
