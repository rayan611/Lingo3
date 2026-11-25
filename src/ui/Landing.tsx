import { useEffect } from 'react'
import { SEEN_KEY } from './landingSeen'
import { INVITE_WELCOME, fillInvite } from '../lib/invite'
import { navigateProduct } from '../lib/productNavigation'
import { useAcademyPreferences } from '../academy/preferences'

const copy = {
  en: {
    title: 'Learn a language. Make it part of your life.',
    intro: 'Personal practice and lessons with a real teacher, together in Lingo3.',
    app: 'Practise at your own pace',
    appBody: 'Build your vocabulary, organize grammar, read and review a little every day.',
    academy: 'Learn with a teacher',
    academyBody:
      'Follow a course with personal feedback, homework and a Learning Space that keeps your progress together.',
    open: 'Enter App',
    visit: 'Explore Academy',
    footer: 'One account. Two connected ways to learn.',
    privacy: 'Privacy'
  },
  fa: {
    title: 'زبان یاد بگیر؛ در زندگی به کار ببر.',
    intro: 'تمرین شخصی و یادگیری با استاد، در کنار هم در لینگو۳.',
    app: 'با سرعت خودت تمرین کن',
    appBody: 'لغت‌های خودت را جمع کن، گرامر را منظم نگه دار، بخوان و هر روز کمی مرور کن.',
    academy: 'با استاد یاد بگیر',
    academyBody: 'با دوره، تکلیف و بازخورد شخصی پیش برو؛ جلسه‌ها و پیشرفتت را در فضای یادگیری کنار هم ببین.',
    open: 'ورود به اپ',
    visit: 'آشنایی با آکادمی',
    footer: 'یک حساب؛ دو مسیر مکمل برای یادگیری.',
    privacy: 'حریم خصوصی'
  },
  sv: {
    title: 'Lär dig ett språk. Använd det i livet.',
    intro: 'Egen träning och lektioner med en riktig lärare, tillsammans i Lingo3.',
    app: 'Öva i din egen takt',
    appBody: 'Bygg ditt ordförråd, samla grammatik, läs och repetera lite varje dag.',
    academy: 'Lär med en lärare',
    academyBody: 'Följ en kurs med personlig feedback, läxor och en egen plats för dina framsteg.',
    open: 'Öppna appen',
    visit: 'Utforska Academy',
    footer: 'Ett konto. Två sätt att lära tillsammans.',
    privacy: 'Integritet'
  },
  de: {
    title: 'Lerne eine Sprache. Nutze sie im Alltag.',
    intro: 'Selbstständig üben und mit einer Lehrkraft lernen — gemeinsam in Lingo3.',
    app: 'Übe in deinem Tempo',
    appBody: 'Sammle Wörter und Grammatik, lies und wiederhole jeden Tag ein wenig.',
    academy: 'Lerne mit einer Lehrkraft',
    academyBody: 'Kurse, persönliche Rückmeldungen, Aufgaben und dein eigener Lernbereich.',
    open: 'App öffnen',
    visit: 'Academy entdecken',
    footer: 'Ein Konto. Zwei verbundene Lernwege.',
    privacy: 'Datenschutz'
  }
}
type Locale = keyof typeof copy
export function Landing({
  onOpen,
  inviter = '',
  userId = null
}: {
  onOpen: () => void
  inviter?: string
  userId?: string | null
}) {
  const { locale, setLocale } = useAcademyPreferences(userId)
  const t = copy[locale]
  useEffect(() => {
    document.title = inviter ? fillInvite(INVITE_WELCOME, { name: inviter }) : 'Lingo3 — App & Academy'
  }, [inviter])
  function open() {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {}
    onOpen()
  }
  return (
    <main className="lingo-front-door" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <header>
        <strong>Lingo3</strong>
        <label>
          <span className="sr-only">Language</span>
          <select
            aria-label="Language"
            value={locale}
            onChange={e => {
              const lang = e.target.value as Locale
              void setLocale(lang)
            }}
          >
            <option value="en">English</option>
            <option value="sv">Svenska</option>
            <option value="de">Deutsch</option>
            <option value="fa">فارسی</option>
          </select>
        </label>
      </header>
      {inviter && <p>{fillInvite(INVITE_WELCOME, { name: inviter })}</p>}
      <section className="front-intro">
        <p className="front-eyebrow">APP + ACADEMY</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </section>
      <section className="front-products" aria-label="Choose Lingo3 App or Lingo3 Academy">
        <article>
          <span className="front-product-name">Lingo3 App</span>
          <h2>{t.app}</h2>
          <p>{t.appBody}</p>
          <button type="button" onClick={open}>
            {t.open} →
          </button>
        </article>
        <article>
          <span className="front-product-name">Lingo3 Academy</span>
          <h2>{t.academy}</h2>
          <p>{t.academyBody}</p>
          <button type="button" onClick={() => navigateProduct('/academy')}>
            {t.visit} →
          </button>
        </article>
      </section>
      <footer>
        <span>{t.footer}</span>
        <a href="/privacy">{t.privacy}</a>
      </footer>
    </main>
  )
}
