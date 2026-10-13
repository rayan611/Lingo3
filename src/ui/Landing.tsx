import { InstallButton } from './InstallButton'
import { Logo } from './Logo'

const SEEN_KEY = 'lingua.landingSeen'

/**
 * Where feedback from someone who is not signed in goes.
 *
 * The in-app suggestion box writes to the `suggestions` table, whose RLS
 * policy allows an insert only from an authenticated user — which a visitor
 * on this page is not. Rather than open an anonymous write path to the
 * database, and with it a spam surface and something to moderate, a visitor
 * gets an email address and a signed-in user gets the form. One decision, and
 * it is the cheap one.
 */
const CONTACT = 'mrp611@gmail.com'

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

/**
 * What the app does, in the order a session actually goes.
 *
 * Taken from the six tabs rather than invented, so this page cannot drift
 * into describing an app that does not exist. Each line says what you get,
 * not what it is built from — nobody arriving here cares that it is FSRS.
 */
const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Add a word, get the whole word',
    body: 'Type it in any of your languages and it comes back expanded in all of them — gender, verb forms, plural, and an example sentence. You do not say which language you typed; it works that out and shows you what it read.',
  },
  {
    title: 'Review that knows each language apart',
    body: 'A word you find hard in German and easy in English is two different memories, and they are scheduled as two. Only the language actually due is asked for; the others sit underneath with a countdown.',
  },
  {
    title: 'Reading built from your own vocabulary',
    body: 'A short text each morning, made from the words you have — with the proportion you actually know measured and shown, not claimed. Words whose review is due this week come first.',
  },
  {
    title: 'Hear it',
    body: 'Every word and every text can be spoken, at a speed you set. The voices are your device’s own: nothing is recorded, downloaded or sent anywhere.',
  },
  {
    title: 'Works with no signal',
    body: 'Reviewing never touches the network. Add words on the underground and they fill in when you surface. Install it and it behaves like any other app on the home screen.',
  },
  {
    title: 'Your words, in bulk',
    body: 'Paste a list from class or import a CSV from Anki, Quizlet or a spreadsheet, with a column mapper. Thirty words from the board is minutes, not an evening.',
  },
]

export function Landing({ onOpen }: { onOpen: () => void }) {
  function open() {
    try {
      window.localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* not worth failing the click over */
    }
    onOpen()
  }

  return (
    <div className="landing">
      <header className="landing-hero">
        <div className="landing-mark">
          <Logo size={64} />
        </div>
        <h1>Lingo3</h1>
        <p className="landing-pitch">
          Learn up to three languages at once from your own words — the ones
          you actually met today, not a stock list.
        </p>
        <p className="landing-pitch">
          Each language is scheduled separately, so the one you find hard comes
          back sooner and the one you know stays out of your way. It works
          offline.
        </p>
        <div className="landing-actions">
          <button className="primary big" onClick={open}>
            Open app
          </button>
          <InstallButton />
        </div>
        <p className="muted small landing-note">
          Free. Your words are stored on your device and synced to your account.
        </p>
      </header>

      <section className="landing-section" id="what-it-does">
        <h2>What it does</h2>
        <ul className="landing-features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section" id="about">
        <h2>About</h2>
        <p>
          Lingo3 was built by one person learning Swedish and German in Sweden,
          for that problem: a word met in class on Tuesday is gone by Friday,
          and the apps that fix that make you learn their word lists rather
          than yours.
        </p>
        <p>
          So the vocabulary is whatever you put in it, every language you study
          is tracked on its own schedule, and the parts that need a model — the
          expansion of a word, the generation of a text — happen when you add
          something, never while you are reviewing. That is why a review works
          on a train with no signal.
        </p>
        <p>
          It is not a business and there is nothing to buy. Six languages are
          supported so far: Swedish, German, English, Spanish, Russian and
          Persian, in any direction.
        </p>
      </section>

      <section className="landing-section" id="contact">
        <h2>Contact</h2>
        <p>
          Something wrong, something missing, or a word that came back with the
          wrong gender? Say so — that is how the list of things to fix gets
          written.
        </p>
        <p>
          <a href={`mailto:${CONTACT}?subject=Lingo3`}>{CONTACT}</a>
        </p>
        <p className="muted small">
          Once you are signed in there is a suggestion box in Settings, which
          reaches the same place with less typing.
        </p>
      </section>

      <footer className="landing-foot">
        <button className="primary big" onClick={open}>
          Open app
        </button>
      </footer>
    </div>
  )
}
