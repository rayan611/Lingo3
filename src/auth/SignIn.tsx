import { useState } from 'react'
import {
  consumeAuthLinkError,
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
} from './useSession'
import { PasswordField } from './PasswordField'
import { Captcha, captchaEnabled } from './Captcha'

type Mode = 'in' | 'up' | 'forgot'

type AuthLocale = 'en' | 'sv' | 'de' | 'fa'

const academyAuthCopy: Record<AuthLocale, Record<string,string>> = {
  en:{back:'Back to Academy',tagline:'Use the same Lingo3 account for your courses, teachers and Academy personal space.',blurb:'Sign in once to keep your courses, bookings, Learning Space, messages and teacher work connected.',p1:'One account, both products.',p2:'Your Academy learning stays private.',p3:'Continue across phone and computer.',signIn:'Sign in',create:'Create an account',reset:'Reset your password',resetHelp:'Enter the email address you signed up with and we will send a password reset link.',email:'Email',password:'Password',forgot:'{context === 'academy' ? academyT.forgot : 'Forgot your password?'}',working:'Working…',checking:'Checking you are human…',sendReset:'Send reset link',or:'or',google:'{context === 'academy' ? academyT.google : 'Continue with Google'}',noAccount:'{context === 'academy' ? academyT.noAccount : 'No account yet? Create one'}',already:'{context === 'academy' ? academyT.already : 'Already have an account? Sign in'}',backSignIn:'{context === 'academy' ? academyT.backSignIn : 'Back to sign in'}',resetNotice:'If that address has an account, a reset link is on its way. Check spam if it does not arrive.',createdNotice:context === 'academy' ? academyT.createdNotice : 'Account created. Check your email for a confirmation link, then sign in.'},
  sv:{back:'Tillbaka till Academy',tagline:'Använd samma Lingo3-konto för dina kurser, lärare och personliga Academy-yta.',blurb:'Logga in en gång för att hålla kurser, bokningar, Learning Space, meddelanden och lärararbete samlat.',p1:'Ett konto för båda produkterna.',p2:'Ditt Academy-lärande förblir privat.',p3:'Fortsätt på mobil och dator.',signIn:'Logga in',create:'Skapa konto',reset:'Återställ lösenord',resetHelp:'Ange e-postadressen du registrerade dig med så skickar vi en återställningslänk.',email:'E-post',password:'Lösenord',forgot:'Glömt lösenordet?',working:'Arbetar…',checking:'Kontrollerar att du är människa…',sendReset:'Skicka återställningslänk',or:'eller',google:'Fortsätt med Google',noAccount:'Inget konto ännu? Skapa ett',already:'Har du redan ett konto? Logga in',backSignIn:'Tillbaka till inloggning',resetNotice:'Om adressen har ett konto är en återställningslänk på väg. Kontrollera skräppost om den inte kommer.',createdNotice:'Kontot skapades. Kontrollera e-posten för en bekräftelselänk och logga sedan in.'},
  de:{back:'Zurück zur Academy',tagline:'Nutze dasselbe Lingo3-Konto für deine Kurse, Lehrkräfte und deinen persönlichen Academy-Bereich.',blurb:'Melde dich einmal an, damit Kurse, Buchungen, Learning Space, Nachrichten und Lehrkraft-Arbeit verbunden bleiben.',p1:'Ein Konto für beide Produkte.',p2:'Dein Academy-Lernen bleibt privat.',p3:'Auf Handy und Computer weitermachen.',signIn:'Anmelden',create:'Konto erstellen',reset:'Passwort zurücksetzen',resetHelp:'Gib die E-Mail-Adresse deines Kontos ein. Wir senden dir einen Link zum Zurücksetzen.',email:'E-Mail',password:'Passwort',forgot:'Passwort vergessen?',working:'Wird verarbeitet…',checking:'Wir prüfen, ob du ein Mensch bist…',sendReset:'Reset-Link senden',or:'oder',google:'Mit Google fortfahren',noAccount:'Noch kein Konto? Konto erstellen',already:'Schon ein Konto? Anmelden',backSignIn:'Zurück zur Anmeldung',resetNotice:'Wenn für diese Adresse ein Konto existiert, ist ein Reset-Link unterwegs. Prüfe auch den Spam-Ordner.',createdNotice:'Konto erstellt. Prüfe deine E-Mail für den Bestätigungslink und melde dich danach an.'},
  fa:{back:'بازگشت به آکادمی',tagline:'برای دوره‌ها، مدرس‌ها و فضای شخصی آکادمی از همان حساب Lingo3 استفاده کن.',blurb:'یک‌بار وارد شو تا دوره‌ها، رزروها، فضای یادگیری، پیام‌ها و فعالیت مدرس به همان حساب متصل بماند.',p1:'یک حساب برای هر دو بخش.',p2:'اطلاعات آموزشی آکادمی خصوصی می‌ماند.',p3:'بین موبایل و کامپیوتر ادامه بده.',signIn:'ورود',create:'ساخت حساب',reset:'بازیابی رمز عبور',resetHelp:'ایمیلی را که با آن ثبت‌نام کرده‌ای وارد کن تا لینک بازیابی برایت ارسال شود.',email:'ایمیل',password:'رمز عبور',forgot:'رمز عبور را فراموش کرده‌ای؟',working:'در حال انجام…',checking:'در حال بررسی انسان بودن…',sendReset:'ارسال لینک بازیابی',or:'یا',google:'ادامه با Google',noAccount:'حساب نداری؟ یکی بساز',already:'حساب داری؟ وارد شو',backSignIn:'بازگشت به ورود',resetNotice:'اگر برای این ایمیل حسابی وجود داشته باشد، لینک بازیابی ارسال شده است. پوشه Spam را هم بررسی کن.',createdNotice:'حساب ساخته شد. ایمیل تأیید را باز کن و بعد وارد شو.'}
}


export function SignIn({ context = 'app', onBack, locale = 'en' }: { context?: 'app' | 'academy'; onBack?: () => void; locale?: AuthLocale } = {}) {
  const academyT = academyAuthCopy[locale]
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // Read once, on the first render after landing: if a reset link brought
  // them here and failed, that is the first thing they need to know.
  const [error, setError] = useState<string | null>(() => consumeAuthLinkError())
  const [notice, setNotice] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Bumped after every attempt: a token is good for one try only.
  const [captchaReset, setCaptchaReset] = useState(0)
  const waitingForCaptcha = captchaEnabled && !captchaToken

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || waitingForCaptcha) return
    const token = captchaToken ?? undefined
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email.trim(), token)
        // Deliberately the same answer whether or not that address has an
        // account. "No such user" would turn this box into a way of finding
        // out who has one.
        setNotice(
          context === 'academy' ? academyT.resetNotice : 'If that address has an account, a reset link is on its way. It is good for one hour — check spam if it does not arrive.',
        )
      } else if (mode === 'in') {
        await signIn(email.trim(), password, token)
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, token)
        if (needsConfirmation) {
          setNotice(
            'Account created. Check your email for a confirmation link, then sign in.',
          )
          setMode('in')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      if (captchaEnabled) setCaptchaReset((n) => n + 1)
    }
  }

  return (
    <div className="app">
      <div className="signin">
        <header className="signin-intro">
          <p>
            {context === 'academy' && onBack
              ? <button type="button" className="link" onClick={onBack}>{academyT.back}</button>
              : <a className="link" href={context === 'academy' ? '/academy' : '/showcase.html'}>{context === 'academy' ? 'Back to Academy' : 'Home / Showcase'}</a>}
          </p>
          <h1 className="signin-brand">{context === 'academy' ? 'Lingo3 Academy' : 'Lingo3'}</h1>
          <p className="signin-tagline">
            {context === 'academy' ? academyT.tagline : 'A place to make your own learning material and study up to three languages at once.'}
          </p>
          {context === 'academy' ? <>
            <p className="signin-blurb">{academyT.blurb}</p>
            <ul className="signin-points"><li>{academyT.p1}</li><li>{academyT.p2}</li><li>{academyT.p3}</li></ul>
          </> : <>
            <p className="signin-blurb">
              Add a word once in your own language. It comes back with the meaning,
              gender and verb forms in every language you are learning, side by
              side, and then returns for review exactly when you are about to
              forget it.
            </p>
            <ul className="signin-points">
              <li><strong>Three languages, one card.</strong> Each language is scheduled on its own, so the one you find hard does not drag the easy ones with it.</li>
              <li><strong>Works offline.</strong> Reviewing never needs a connection — only adding new words does.</li>
              <li><strong>Your words, everywhere.</strong> Add on your computer, review on your phone.</li>
            </ul>
          </>}
        </header>

        <form className="panel" onSubmit={submit}>
          <h2>
            {mode === 'in'
              ? (context === 'academy' ? academyT.signIn : 'Sign in')
              : mode === 'up'
                ? (context === 'academy' ? academyT.create : 'Create an account')
                : (context === 'academy' ? academyT.reset : 'Reset your password')}
          </h2>

          {mode === 'forgot' && (
            <p className="muted small">
              {context === 'academy' ? academyT.resetHelp : 'Give the address you signed up with and we will send a link that lets you set a new password.'}
            </p>
          )}

          <label className="field">
            <span>{context === 'academy' ? academyT.email : 'Email'}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              disabled={busy}
            />
          </label>

          {/* No password field when resetting: asking for the thing you have
              just said you cannot remember is the classic version of this
              form, and it is nonsense. */}
          {mode !== 'forgot' && (
            <PasswordField
              label={context === 'academy' ? academyT.password : 'Password'}
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              // 8 for new accounts, like a reset; sign-in keeps 6 so older
              // accounts with a 6-character password can still get in.
              minLength={mode === 'up' ? 8 : 6}
              disabled={busy}
            />
          )}

          {mode === 'in' && (
            <div className="signin-forgot">
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                  setNotice(null)
                }}
              >
                Forgot your password?
              </button>
            </div>
          )}

          <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />

          <button className="primary big" type="submit" disabled={busy || waitingForCaptcha}>
            {busy
              ? (context === 'academy' ? academyT.working : 'Working…')
              : waitingForCaptcha
                ? (context === 'academy' ? academyT.checking : 'Checking you are human…')
              : mode === 'in'
                ? (context === 'academy' ? academyT.signIn : 'Sign in')
                : mode === 'up'
                  ? (context === 'academy' ? academyT.create : 'Create account')
                  : (context === 'academy' ? academyT.sendReset : 'Send reset link')}
          </button>

          {/* Not offered while resetting a password: the whole point of that
              screen is an account that has one, and Google accounts do not. */}
          {mode !== 'forgot' && (
            <>
              <div className="signin-or">
                <span>{context === 'academy' ? academyT.or : 'or'}</span>
              </div>
              <button
                type="button"
                className="big google"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setNotice(null)
                  // No `busy` reset on success: the page is leaving.
                  signInWithGoogle(context === 'academy' ? '/academy' : '/').catch((err) => {
                    setBusy(false)
                    setError(err instanceof Error ? err.message : String(err))
                  })
                  setBusy(true)
                }}
              >
                <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {error && <div className="status error">{error}</div>}
          {notice && <div className="status ok">{notice}</div>}

          <div className="signin-switch">
            {mode === 'in' && (
              <button type="button" className="link" onClick={() => setMode('up')}>
                No account yet? Create one
              </button>
            )}
            {mode === 'up' && (
              <button type="button" className="link" onClick={() => setMode('in')}>
                Already have an account? Sign in
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode('in')
                  setError(null)
                  setNotice(null)
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
