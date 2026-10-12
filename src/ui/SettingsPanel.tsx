import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveSettings } from '../db/db'
import { LANGS, LANG_NAMES, LANG_NATIVE_NAMES, type Lang, type Settings } from '../db/types'
import { authConfigured } from '../auth/supabase'
import { signOut } from '../auth/useSession'
import { resetSyncCursors, type SyncResult } from '../sync/sync'
import { THEMES, THEME_LABELS, readTheme, saveTheme, type Theme } from '../lib/theme'
import { hasVoiceFor, speak, speechSupported } from '../lib/speak'
import { ImportExport } from './ImportExport'
import { Profile } from './Profile'
import { AdminPanel, SuggestionBox } from './Suggestions'

interface SettingsPanelProps {
  settings: Settings
  email: string | null
  syncState: SyncResult | null
  syncing: boolean
  onSync: () => void | Promise<void>
}

/**
 * One short phrase per language for the sample button.
 *
 * A real greeting rather than the language's name, because what you are
 * judging is whether the voice sounds like the language — and a single word
 * said in isolation is exactly where a bad voice sounds fine.
 */
const SPEECH_SAMPLES: Partial<Record<Lang, string>> = {
  sv: 'Hej, vad kostar en kaffe?',
  de: 'Guten Tag, wie geht es Ihnen?',
  en: 'Hello, how much is a coffee?',
  fa: 'سلام، حال شما چطور است؟',
  es: 'Hola, ¿cuánto cuesta un café?',
  ru: 'Здравствуйте, как дела?',
}

export function SettingsPanel({
  settings,
  email,
  syncState,
  syncing,
  onSync,
}: SettingsPanelProps) {
  const [theme, setTheme] = useState<Theme>(() => readTheme())
  const [name, setName] = useState(settings.displayName ?? '')
  /**
   * Profile moved in here when the tab bar was cut to six. It is collapsed by
   * default: Settings is where you come to change something, and a page of
   * charts above the controls makes you scroll past it every time.
   */
  const [showProfile, setShowProfile] = useState(false)
  /** Which language the Audio sample speaks — the first one you study. */
  const [previewLang, setPreviewLang] = useState<Lang>(
    settings.targetLangs[0] ?? settings.nativeLang,
  )

  const cardCounts =
    useLiveQuery(async () => {
      const cards = await db.cards.toArray()
      const out: Record<string, number> = {}
      for (const c of cards) out[c.lang] = (out[c.lang] ?? 0) + 1
      return out
    }, []) ?? {}

  async function toggleActive(lang: Lang) {
    const on = settings.activeLangs.includes(lang)
    const next = on
      ? settings.activeLangs.filter((l) => l !== lang)
      : [...settings.activeLangs, lang]
    await saveSettings({ activeLangs: next })
  }

  async function move(lang: Lang, dir: -1 | 1) {
    const order = [...settings.targetLangs]
    const i = order.indexOf(lang)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    await saveSettings({ targetLangs: order })
  }

  /**
   * Three at a time, which is the name of the app and an honest limit rather
   * than a technical one: the schema is per (word x language) and does not
   * care, but four languages stacked on one review card is more than anyone
   * reads, and the interference research is about production anyway.
   */
  const MAX_TARGETS = 3
  const atLimit = settings.targetLangs.length >= MAX_TARGETS

  async function toggleTarget(lang: Lang) {
    const isTarget = settings.targetLangs.includes(lang)
    if (!isTarget && atLimit) return
    if (isTarget) {
      await saveSettings({
        targetLangs: settings.targetLangs.filter((l) => l !== lang),
        activeLangs: settings.activeLangs.filter((l) => l !== lang),
      })
    } else {
      await saveSettings({
        targetLangs: [...settings.targetLangs, lang],
        activeLangs: [...settings.activeLangs, lang],
      })
    }
  }

  const available = LANGS.filter((l) => l !== settings.nativeLang)

  return (
    <div className="stack">
      {/* Account first. Who you are signed in as and whether your words have
          reached the server are the things you open Settings in a hurry to
          check; everything below is a preference you set once. */}
      {authConfigured && (
        <div className="panel">
          <h2>Account</h2>
          <p className="muted small">Signed in as {email ?? 'unknown'}.</p>

          <h3>Sync</h3>
          <p className="muted small">
            Your words are stored on this device and copied to your account
            automatically — a few seconds after you change something, and again
            whenever the app goes to the background. Reviewing never waits for
            the network, and the button below is only here for when you want to
            be certain.
          </p>
          <p className="muted small">
            {syncing
              ? 'Syncing now…'
              : syncState
                ? syncState.error
                  ? `Last attempt failed: ${syncState.error}`
                  : `Last synced ${new Date(syncState.at).toLocaleTimeString()} — ${syncState.pushed} up, ${syncState.pulled} down.`
                : 'Not synced yet this session.'}
          </p>
          <div className="row">
            <button onClick={() => void onSync()} disabled={syncing}>
              Sync now
            </button>
            <button
              onClick={async () => {
                await resetSyncCursors()
                await onSync()
              }}
              disabled={syncing}
              title="Re-read everything from the server, in case something was missed"
            >
              Full resync
            </button>
            <button className="link danger" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>Your progress</h2>
          <button className="link" onClick={() => setShowProfile((v) => !v)}>
            {showProfile ? 'Hide' : 'Show'}
          </button>
        </div>
        {showProfile ? (
          <Profile settings={settings} email={email} />
        ) : (
          <p className="muted small">
            Words learned, your review streak and a breakdown per language.
          </p>
        )}
      </div>

      <div className="panel">
        <h2>You</h2>
        <label className="field">
          <span>Name</span>
          <div className="row">
            <input
              className="field-grow"
              value={name}
              maxLength={40}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() =>
                void saveSettings({ displayName: name.trim() || undefined })
              }
            />
          </div>
          <span className="muted small">
            Shown at the top of the screen. Synced, so it follows your account.
          </span>
        </label>

        <label className="field">
          <span>Theme</span>
          <select
            value={theme}
            onChange={(e) => {
              const next = e.target.value as Theme
              setTheme(next)
              saveTheme(next)
            }}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {THEME_LABELS[t]}
              </option>
            ))}
          </select>
          <span className="muted small">
            Kept on this device rather than synced — which theme suits you
            depends on the screen you are looking at, not on your account.
          </span>
        </label>
      </div>

      <div className="panel">
        <h2>Languages</h2>

        <label className="field">
          <span>Native language</span>
          <select
            value={settings.nativeLang}
            onChange={(e) => {
              const next = e.target.value as Lang
              const previous = settings.nativeLang
              // The language you are leaving becomes something you are
              // learning, rather than vanishing from the app entirely — which
              // is what used to happen, silently.
              const targets = settings.targetLangs.filter((l) => l !== next)
              const actives = settings.activeLangs.filter((l) => l !== next)
              void saveSettings({
                nativeLang: next,
                targetLangs: targets.includes(previous)
                  ? targets
                  : [...targets, previous],
                activeLangs: actives.includes(previous)
                  ? actives
                  : [...actives, previous],
                typedLang:
                  settings.typedLang === next ? undefined : settings.typedLang,
              })
            }}
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]} — {LANG_NATIVE_NAMES[l]}
              </option>
            ))}
          </select>
        </label>

        <h3>Learning</h3>
        <p className="muted small">
          Order sets the stacking order on review cards. Pausing a language keeps
          its progress — it stops appearing, and resumes at the right interval
          when you switch it back on.
        </p>

        <ul className="lang-settings">
          {settings.targetLangs.map((lang, i) => {
            const active = settings.activeLangs.includes(lang)
            return (
              <li key={lang} className={active ? '' : 'paused'}>
                <span className="prio">{i + 1}</span>
                <span className="lang-settings-name">
                  {LANG_NAMES[lang]}
                  <span className="muted small">
                    {' '}
                    {cardCounts[lang] ?? 0} cards
                  </span>
                </span>
                <div className="lang-settings-actions">
                  <button onClick={() => void move(lang, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    onClick={() => void move(lang, 1)}
                    disabled={i === settings.targetLangs.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    className={active ? 'toggle on' : 'toggle'}
                    onClick={() => void toggleActive(lang)}
                  >
                    {active ? 'studying' : 'paused'}
                  </button>
                  <button className="link danger" onClick={() => void toggleTarget(lang)}>
                    remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        {available.some((l) => !settings.targetLangs.includes(l)) && (
          <div className="row">
            <span className="muted small">
              {atLimit ? `${MAX_TARGETS} is the limit — remove one first:` : 'Add:'}
            </span>
            {available
              .filter((l) => !settings.targetLangs.includes(l))
              .map((l) => (
                <button
                  key={l}
                  className="chip"
                  disabled={atLimit}
                  onClick={() => void toggleTarget(l)}
                >
                  + {LANG_NAMES[l]}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Recall</h2>
        <label className="field">
          <span>Type the answer for</span>
          <select
            value={settings.typedLang ?? ''}
            onChange={(e) =>
              void saveSettings({
                typedLang: e.target.value ? (e.target.value as Lang) : undefined,
              })
            }
          >
            <option value="">No typing — just reveal</option>
            {settings.targetLangs.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
          <span className="muted small">
            Recognising a word and producing it are different skills, and
            interference between Swedish and German shows up in production. One
            language only, so a session stays short.
          </span>
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoAdvance ?? false}
            onChange={(e) => void saveSettings({ autoAdvance: e.target.checked })}
          />
          <span>
            Go to the next word automatically
            <span className="muted small">
              Once every language due on a card is graded, move on without
              waiting for Next. Quicker on a phone. Off, the card stays up
              until you tap — which is when you read the interval you just
              earned and notice a gender you got wrong.
            </span>
          </span>
        </label>
      </div>

      {/* Audio sits in its own panel rather than under Recall, because what
          it depends on is the device: the voices are the operating system's,
          and a phone with a good Swedish voice and a laptop without one are
          the same account. Everything here is device-local for that reason. */}
      {speechSupported() && (
        <div className="panel">
          <h2>Audio</h2>
          <p className="muted small">
            Voices come from this device, not from us — nothing is downloaded
            and nothing is sent anywhere. Quality is the operating system's:
            Swedish and German are good on Android, Windows and macOS. On
            iOS the better voice is a download in Settings → Accessibility →
            Spoken Content; until then you get the basic one.
          </p>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.speakOnReveal ?? true}
              onChange={(e) =>
                void saveSettings({ speakOnReveal: e.target.checked })
              }
            />
            <span>
              Say the word when the answer appears
              <span className="muted small">
                The first language due on the card speaks by itself, so you
                hear it without reaching for the speaker. The speakers stay
                either way — this only decides whether one plays unprompted.
              </span>
            </span>
          </label>

          <label className="field">
            <span>Speaking speed</span>
            <input
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={settings.speechRate ?? 0.95}
              onChange={(e) =>
                void saveSettings({ speechRate: Number(e.target.value) })
              }
            />
            <span className="muted small">
              {(settings.speechRate ?? 0.95).toFixed(2)}× — slower than natural
              on purpose. Hearing where a word breaks and which vowel is long
              is the point here; listening at conversational pace is what
              Reading is for.
            </span>
          </label>

          <div className="row">
            <button
              type="button"
              onClick={() =>
                speak(
                  SPEECH_SAMPLES[previewLang] ?? 'Hej',
                  previewLang,
                  { rate: settings.speechRate },
                )
              }
            >
              Hear a sample
            </button>
            <select
              value={previewLang}
              onChange={(e) => setPreviewLang(e.target.value as Lang)}
              aria-label="Sample language"
            >
              {[settings.nativeLang, ...settings.targetLangs].map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
            {!hasVoiceFor(previewLang) && (
              <span className="muted small">
                No {LANG_NAMES[previewLang]} voice on this device — the
                speakers are hidden for that language rather than doing
                nothing when tapped.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Scheduling</h2>
        <label className="field">
          <span>New words per day</span>
          <input
            type="number"
            min={0}
            max={200}
            value={settings.dailyNewLimit}
            onChange={(e) =>
              void saveSettings({ dailyNewLimit: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>Reviews per day</span>
          <input
            type="number"
            min={10}
            max={1000}
            value={settings.dailyReviewLimit}
            onChange={(e) =>
              void saveSettings({ dailyReviewLimit: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>
            Target recall: {Math.round(settings.requestRetention * 100)}%
          </span>
          <input
            type="range"
            min={70}
            max={97}
            value={Math.round(settings.requestRetention * 100)}
            onChange={(e) =>
              void saveSettings({ requestRetention: Number(e.target.value) / 100 })
            }
          />
          <span className="muted small">
            Higher means shorter intervals and more reviews. 90% is the usual
            balance; below 80% you will forget noticeably more.
          </span>
        </label>
      </div>

      <ImportExport settings={settings} />

      <div className="panel">
        <h2>Full backup</h2>
        <p className="muted small">
          Everything, including review history and FSRS state, as JSON. The CSV
          above is for moving words between apps; this is for not losing them.
        </p>
        <button onClick={() => void exportData()}>Export JSON</button>
      </div>

      <SuggestionBox />

      {/* Renders nothing unless the database says you are an admin — the local
          settings row is synced, so trusting its is_admin would be client
          state deciding what the server already decides. */}
      <AdminPanel />

      {/* Which build is actually running. Without this there is no way to tell
          from a phone whether the service worker has picked up a new deploy —
          which, after a day lost to a cached login wall, is worth four lines. */}
      <p className="version-line">
        Lingu3 v{__APP_VERSION__} · built {__BUILD_DATE__}
      </p>
    </div>
  )
}

async function exportData() {
  const [concepts, entries, cards, reviewLog, settings] = await Promise.all([
    db.concepts.toArray(),
    db.entries.toArray(),
    db.cards.toArray(),
    db.reviewLog.toArray(),
    db.settings.toArray(),
  ])
  const blob = new Blob(
    [JSON.stringify({ version: 1, exportedAt: Date.now(), concepts, entries, cards, reviewLog, settings }, null, 2)],
    { type: 'application/json' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lingua-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
