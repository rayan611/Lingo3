import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureDisplayFonts } from '../lib/theme'
import { InstallButton } from './InstallButton'

const SEEN_KEY = 'lingua.landingSeen'

/**
 * Where feedback from someone who is not signed in goes.
 *
 * The in-app suggestion box writes to the `suggestions` table, whose RLS
 * policy allows an insert only from an authenticated user — which a visitor
 * on this page is not. Rather than open an anonymous write path to the
 * database, and with it a spam surface and something to moderate, a visitor
 * gets an email address and a signed-in user gets the form.
 */
const CONTACT = 'rayan.rahpou@gmail.com'

/**
 * Has this visitor already been past the front door?
 *
 * Three ways to be past it, and all three skip the landing:
 *
 *  - the app is installed and launched from the home screen, where a
 *    marketing page between the icon and the words would be absurd;
 *  - they have opened it before on this device;
 *  - they are signed in, which is checked by the caller.
 *
 * The flag is device-local on purpose. It is a fact about this browser, not
 * about the account, so it has no business in the synced settings row — and
 * it is the one preference that did NOT move to the account in v3.3.
 */
export function shouldShowLanding(): boolean {
  if (typeof window === 'undefined') return false
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari does not implement display-mode and uses this instead.
    (navigator as { standalone?: boolean }).standalone === true
  if (standalone) return false
  try {
    return window.localStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    // Private mode, or storage blocked. Showing the page once per visit is a
    // better failure than throwing on the way to the app.
    return true
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}


/**
 * The word the hero blooms.
 *
 * A real expansion rather than a mock-up: `dog` genuinely comes back as these
 * three, with these genders. Two of the three carry an article, which is the
 * part a dictionary gives you last and the part you need first — so the hero
 * shows the thing the app is actually for.
 */
const BLOOM = {
  source: 'dog',
  branches: [
    { lang: 'Swedish', word: 'hund', tag: 'en hund', hue: 'sv' },
    { lang: 'German', word: 'Hund', tag: 'der Hund', hue: 'de' },
    { lang: 'Spanish', word: 'perro', tag: 'el perro', hue: 'es' },
  ],
}

/**
 * What the app does for you, one claim per slide.
 *
 * Each slide carries its own drawing rather than an icon from a set: the
 * drawings are the reason this is a deck and not a list, and a shared icon
 * style would make six slides look like one slide shown six times.
 */
const SLIDES: {
  title: string
  body: string
  art: () => JSX.Element
}[] = [
  {
    title: 'Type one word, get the whole word',
    body: 'Gender, plural, verb forms and an example sentence, in every language you study. You never say which language you typed — it works that out and shows you what it read.',
    art: ArtExpand,
  },
  {
    title: 'Hard in German, easy in English?',
    body: 'Those are two different memories, so they are scheduled as two. Only the language actually due is asked for; the others wait their turn.',
    art: ArtClocks,
  },
  {
    title: 'A morning story from your own words',
    body: 'A short text built from the vocabulary you have, with the share you really know measured and shown — not claimed.',
    art: ArtStory,
  },
  {
    title: 'Hear how it sounds',
    body: 'Every word and every text can be spoken, at a speed you set. The voices are your own device’s: nothing is recorded or sent anywhere.',
    art: ArtSound,
  },
  {
    title: 'Thirty words from the board in one paste',
    body: 'Paste a list from class, or import a CSV from Anki, Quizlet or a spreadsheet. Minutes, not an evening.',
    art: ArtPaste,
  },
  {
    title: 'No signal, no problem',
    body: 'Reviewing never touches the network. Add words on the underground and they fill in when you surface.',
    art: ArtOffline,
  },
]

export function Landing({ onOpen }: { onOpen: () => void }) {
  // Shared with the bloom theme: the same request, so one of them warms the
  // cache for the other.
  useEffect(ensureDisplayFonts, [])

  function open() {
    try {
      window.localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* not worth failing the click over */
    }
    onOpen()
  }

  return (
    <div className="lx">
      <div className="lx-sky" aria-hidden="true" />

      <header className="lx-hero">
        <p className="lx-mark">Lingo3</p>
        <h1 className="lx-head">
          Three languages.
          <br />
          Your own words.
        </h1>
        <p className="lx-sub">
          Add the word you met today and it comes back in every language you
          are learning — with the article, the forms, and a sentence you can
          actually say.
        </p>

        <WordBloom />

        <div className="lx-cta">
          <button className="lx-open" onClick={open}>
            Open app
          </button>
          <InstallButton />
        </div>
        <p className="lx-note">
          Free, no adverts. Works offline and installs to your home screen.
        </p>
      </header>

      <Deck />

      <section className="lx-prose" id="about">
        <h2>Why it exists</h2>
        <p>
          Lingo3 was built by one person learning Swedish and German in Sweden,
          for that exact problem: a word you met in class on Tuesday is gone by
          Friday, and the apps that fix that make you learn their word lists
          instead of yours.
        </p>
        <p>
          So the vocabulary is whatever you put in it, every language you study
          runs on its own schedule, and the parts that need a model — expanding
          a word, writing a text — happen when you add something, never while
          you are reviewing. That is why a review works on a train with no
          signal.
        </p>
        <p>
          Six languages so far: Swedish, German, English, Spanish, Russian and
          Persian, in any direction.
        </p>
      </section>

      <section className="lx-prose" id="contact">
        <h2>Say something</h2>
        <p>
          Something broken, something missing, or a word that came back with
          the wrong gender? That is how the list of things to fix gets written.
        </p>
        <p>
          <a className="lx-link" href={`mailto:${CONTACT}?subject=Lingo3`}>
            {CONTACT}
          </a>
        </p>
        <p className="lx-fine">
          Once you are signed in there is a suggestion box in Settings, which
          reaches the same place with less typing.
        </p>
      </section>

      <footer className="lx-foot">
        <button className="lx-open" onClick={open}>
          Open app
        </button>
        <p className="lx-fine">
          <a className="lx-link" href="/privacy">
            Privacy
          </a>
        </p>
      </footer>
    </div>
  )
}

/**
 * The hero: one word blooming into three.
 *
 * This is the page's single orchestrated moment — the connectors draw, then
 * the three chips arrive in turn. It runs once, on load, and not again; a
 * hero that keeps animating is a hero you have to wait for. Under
 * prefers-reduced-motion the whole thing is simply there, already bloomed.
 */
function WordBloom() {
  const [lit, setLit] = useState(() =>
    typeof window === 'undefined' ? true : prefersReducedMotion(),
  )

  useEffect(() => {
    if (lit) return
    const t = window.setTimeout(() => setLit(true), 80)
    return () => window.clearTimeout(t)
  }, [lit])

  return (
    <div className={`lx-bloom${lit ? ' is-lit' : ''}`}>
      <div className="lx-seed">
        <span className="lx-seed-word">{BLOOM.source}</span>
        <span className="lx-seed-caret" aria-hidden="true" />
      </div>

      {/* Decorative: the words either side of it say the same thing. */}
      <svg
        className="lx-wires"
        viewBox="0 0 300 64"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M150 0 C150 34 50 24 50 64" />
        <path d="M150 0 L150 64" />
        <path d="M150 0 C150 34 250 24 250 64" />
      </svg>

      <ul className="lx-branches">
        {BLOOM.branches.map((b, i) => (
          <li key={b.lang} data-hue={b.hue} style={{ '--i': i } as React.CSSProperties}>
            <span className="lx-branch-lang">{b.lang}</span>
            <span className="lx-branch-word">{b.word}</span>
            <span className="lx-branch-tag">{b.tag}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The benefit deck.
 *
 * It advances by itself, because a deck nobody touches is a deck nobody
 * reads — but it stops the moment you interact with it and never starts
 * again, since fighting a carousel for control is worse than a static list.
 * Reduced motion means no auto-advance at all.
 */
function Deck() {
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const touchX = useRef<number | null>(null)
  const count = SLIDES.length

  const go = useCallback(
    (next: number) => {
      setHeld(true)
      setAt(((next % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (held || prefersReducedMotion()) return
    const t = window.setInterval(() => setAt((a) => (a + 1) % count), 5200)
    return () => window.clearInterval(t)
  }, [held, count])

  const current = SLIDES[at]

  return (
    <section
      className="lx-deck"
      aria-roledescription="carousel"
      aria-label="What Lingo3 does"
      onMouseEnter={() => setHeld(true)}
      onFocus={() => setHeld(true)}
      onTouchStart={(e) => {
        setHeld(true)
        touchX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const from = touchX.current
        const to = e.changedTouches[0]?.clientX
        touchX.current = null
        if (from == null || to == null) return
        const dx = to - from
        if (Math.abs(dx) > 44) go(at + (dx < 0 ? 1 : -1))
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(at + 1)
        if (e.key === 'ArrowLeft') go(at - 1)
      }}
      tabIndex={0}
    >
      <div className="lx-slide" key={at}>
        <div className="lx-art">
          <current.art />
        </div>
        <div className="lx-slide-text">
          <h2>{current.title}</h2>
          <p>{current.body}</p>
        </div>
      </div>

      <div className="lx-deck-nav">
        <button
          className="lx-arrow"
          onClick={() => go(at - 1)}
          aria-label="Previous"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <ol className="lx-dots">
          {SLIDES.map((s, i) => (
            <li key={s.title}>
              <button
                className={i === at ? 'is-at' : ''}
                aria-label={s.title}
                aria-current={i === at}
                onClick={() => go(i)}
              />
            </li>
          ))}
        </ol>
        <button className="lx-arrow" onClick={() => go(at + 1)} aria-label="Next">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Slide drawings.
//
// Flat, few shapes, and each one shows the mechanism rather than a mascot:
// three rows fanning out of one, two clocks at different times, a page with a
// measured bar. They use the page's own accent variables so they stay in step
// with the palette.
// ---------------------------------------------------------------------------

function ArtExpand() {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label="One word fanning out into three">
      <rect x="6" y="40" width="38" height="20" rx="7" fill="var(--lx-violet)" />
      <rect x="13" y="47" width="24" height="6" rx="3" fill="#fff" opacity=".85" />
      <path d="M44 50h14c6 0 6-28 12-28h8" stroke="var(--lx-sv)" fill="none" />
      <path d="M44 50h34" stroke="var(--lx-de)" fill="none" />
      <path d="M44 50h14c6 0 6 28 12 28h8" stroke="var(--lx-es)" fill="none" />
      <rect x="78" y="12" width="36" height="20" rx="7" fill="var(--lx-sv)" />
      <rect x="78" y="40" width="36" height="20" rx="7" fill="var(--lx-de)" />
      <rect x="78" y="68" width="36" height="20" rx="7" fill="var(--lx-es)" />
    </svg>
  )
}

function ArtClocks() {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label="Two review clocks set differently">
      <circle cx="38" cy="42" r="26" fill="var(--lx-de-soft)" />
      <circle cx="38" cy="42" r="26" fill="none" stroke="var(--lx-de)" />
      <path d="M38 42V24M38 42l13 8" stroke="var(--lx-de)" fill="none" />
      <circle cx="84" cy="62" r="20" fill="var(--lx-sv-soft)" />
      <circle cx="84" cy="62" r="20" fill="none" stroke="var(--lx-sv)" />
      <path d="M84 62v-13M84 62l-9 6" stroke="var(--lx-sv)" fill="none" />
    </svg>
  )
}

function ArtStory() {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label="A page of text with the known share measured">
      <rect x="20" y="10" width="80" height="80" rx="10" fill="#fff" stroke="var(--lx-line)" />
      <rect x="32" y="26" width="40" height="6" rx="3" fill="var(--lx-violet)" />
      <rect x="32" y="40" width="56" height="5" rx="2.5" fill="var(--lx-ink-faint)" />
      <rect x="32" y="52" width="48" height="5" rx="2.5" fill="var(--lx-ink-faint)" />
      <rect x="32" y="70" width="56" height="9" rx="4.5" fill="var(--lx-line)" />
      <rect x="32" y="70" width="42" height="9" rx="4.5" fill="var(--lx-pink)" />
    </svg>
  )
}

function ArtSound() {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label="A sound wave">
      <rect x="18" y="42" width="8" height="16" rx="4" fill="var(--lx-sv)" />
      <rect x="34" y="30" width="8" height="40" rx="4" fill="var(--lx-violet)" />
      <rect x="50" y="18" width="8" height="64" rx="4" fill="var(--lx-pink)" />
      <rect x="66" y="30" width="8" height="40" rx="4" fill="var(--lx-violet)" />
      <rect x="82" y="38" width="8" height="24" rx="4" fill="var(--lx-sv)" />
      <rect x="98" y="46" width="8" height="8" rx="4" fill="var(--lx-ink-faint)" />
    </svg>
  )
}

function ArtPaste() {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label="A pasted list of words becoming cards">
      <rect x="14" y="16" width="44" height="68" rx="8" fill="#fff" stroke="var(--lx-line)" />
      {[26, 38, 50, 62, 74].map((y) => (
        <rect key={y} x="23" y={y} width="26" height="4" rx="2" fill="var(--lx-ink-faint)" />
      ))}
      <path d="M62 50h12" stroke="var(--lx-ink-faint)" fill="none" />
      <rect x="78" y="22" width="30" height="20" rx="7" fill="var(--lx-pink)" />
      <rect x="78" y="46" width="30" height="20" rx="7" fill="var(--lx-violet)" />
      <rect x="78" y="70" width="30" height="14" rx="7" fill="var(--lx-sv)" />
    </svg>
  )
}

function ArtOffline() {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label="A phone working with no connection">
      {/* The crossed-out signal sits clear of the phone on purpose: drawn any
          closer the slash cuts across the screen and reads as a broken phone
          rather than a working one with no bars. */}
      <rect x="54" y="12" width="40" height="76" rx="10" fill="#fff" stroke="var(--lx-line)" />
      <rect x="64" y="30" width="20" height="6" rx="3" fill="var(--lx-violet)" />
      <rect x="64" y="44" width="14" height="5" rx="2.5" fill="var(--lx-ink-faint)" />
      <rect x="64" y="58" width="20" height="10" rx="5" fill="var(--lx-sv-soft)" />
      <path d="M15 40c6-6 14-6 20 0M21 50c3-3 8-3 11 0" stroke="var(--lx-ink-faint)" fill="none" />
      <path d="M13 34l26 26" stroke="var(--lx-pink)" fill="none" />
    </svg>
  )
}
