import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  readAccountSettings,
  readDeviceOverride,
  saveSettings,
  setDeviceOverride,
} from '../db/db'
import {
  LANGS,
  LANG_NAMES,
  LANG_NATIVE_NAMES,
  type DeviceOverridableKey,
  type Lang,
  type Settings,
} from '../db/types'
import { authConfigured } from '../auth/supabase'
import { signOut } from '../auth/useSession'
import { resetSyncCursors, type SyncResult } from '../sync/sync'
import { DEFAULT_THEME, THEMES, THEME_LABELS, type Theme } from '../lib/theme'
import { hasVoiceFor, speak, speechSupported } from '../lib/speak'
import { DeleteAccount } from './DeleteAccount'
import { HowTo, QuickStart } from './HowTo'
import { ImportExport } from './ImportExport'
import { InviteOthers } from './InviteOthers'
import { Profile } from './Profile'
import { AdminPanel, SuggestionBox } from './Suggestions'

interface SettingsPanelProps {
  settings: Settings
  userId: string | null
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
  userId,
  email,
  syncState,
  syncing,
  onSync,
}: SettingsPanelProps) {
  const [name, setName] = useState(settings.displayName ?? '')
  const [saveFeedback, setSaveFeedback] = useState<{ kind: 'saving' | 'saved' | 'error'; text: string } | null>(null)
  /**
   * What this device has pinned for itself, and what the account says
   * underneath it. `settings` is already the resolved view — these two are
   * only needed to show which of the two you are editing.
   */
  const override = useLiveQuery(() => readDeviceOverride(), []) ?? {}
  const account = useLiveQuery(() => readAccountSettings(), [])
  const theme: Theme = settings.theme ?? DEFAULT_THEME

  const pinnedHere = (key: DeviceOverridableKey) => key in override

  async function persistSettings(patch: Partial<Settings>) {
    setSaveFeedback({ kind: 'saving', text: 'Saving…' })
    try {
      await saveSettings(patch)
      setSaveFeedback({ kind: 'saved', text: 'Saved on this device' })
    } catch {
      setSaveFeedback({ kind: 'error', text: 'Could not save this setting. Please try again.' })
    }
  }

  async function persistDeviceOverride(
    key: DeviceOverridableKey,
    value: Settings[DeviceOverridableKey] | null | undefined,
  ) {
    setSaveFeedback({ kind: 'saving', text: 'Saving…' })
    try {
      await setDeviceOverride(key, value)
      setSaveFeedback({ kind: 'saved', text: 'Saved on this device' })
    } catch {
      setSaveFeedback({ kind: 'error', text: 'Could not save this setting. Please try again.' })
    }
  }

  /**
   * Writes a preference where it belongs: to this device if it is pinned
   * here, to the account otherwise. Every control below goes through this,
   * so there is one answer to "where did that go" rather than five.
   */
  async function savePref<K extends DeviceOverridableKey>(
    key: K,
    value: Settings[K] | undefined,
  ) {
    if (pinnedHere(key)) {
      await persistDeviceOverride(key, value === undefined ? null : value)
    } else {
      await persistSettings({ [key]: value } as Partial<Settings>)
    }
  }

  /**
   * Pinning takes the value you can currently see, so turning it on never
   * changes what the app does — it only stops the next sync changing it.
   * Turning it off hands the setting back to the account, which may well
   * change it, and that is the point.
   */
  async function togglePin<K extends DeviceOverridableKey>(
    key: K,
    showing: Settings[K] | undefined,
  ) {
    if (pinnedHere(key)) await persistDeviceOverride(key, undefined)
    else await persistDeviceOverride(key, showing === undefined ? null : showing)
  }
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
    await persistSettings({ activeLangs: next })
  }

  async function move(lang: Lang, dir: -1 | 1) {
    const order = [...settings.targetLangs]
    const i = order.indexOf(lang)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    await persistSettings({ targetLangs: order })
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
      await persistSettings({
        targetLangs: settings.targetLangs.filter((l) => l !== lang),
        activeLangs: settings.activeLangs.filter((l) => l !== lang),
      })
    } else {
      await persistSettings({
        targetLangs: [...settings.targetLangs, lang],
        activeLangs: [...settings.activeLangs, lang],
      })
    }
  }

  const available = LANGS.filter((l) => l !== settings.nativeLang)

  return (
    <div className="stack settings-stack">
      {saveFeedback && (
        <p className={`save-feedback ${saveFeedback.kind}`} role="status" aria-live="polite">
          {saveFeedback.text}
        </p>
      )}
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
                void persistSettings({ displayName: name.trim() || undefined })
              }
            />
          </div>
          <span className="muted small">
            Shown at the top of the screen. Synced, so it follows your account.
          </span>
        </label>

        <label className="field">
          <span className="setting-title">Theme{pinnedHere('theme') && <span className="device-only-badge">(only on this device)</span>}</span>
          <select
            value={theme}
            onChange={(e) => void savePref('theme', e.target.value as Theme)}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {THEME_LABELS[t]}
              </option>
            ))}
          </select>
          <DeviceScope
            pinned={pinnedHere('theme')}
            onToggle={() => void togglePin('theme', theme)}
            accountValue={THEME_LABELS[account?.theme ?? DEFAULT_THEME]}
          />
        </label>
      </div>

      <InviteOthers name={settings.displayName} />

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
              void persistSettings({
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
          <span className="setting-title">Type the answer for{pinnedHere('typedLang') && <span className="device-only-badge">(only on this device)</span>}</span>
          <select
            value={settings.typedLang ?? ''}
            onChange={(e) =>
              void savePref(
                'typedLang',
                e.target.value ? (e.target.value as Lang) : undefined,
              )
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
          <DeviceScope
            pinned={pinnedHere('typedLang')}
            onToggle={() => void togglePin('typedLang', settings.typedLang)}
            accountValue={
              account?.typedLang ? LANG_NAMES[account.typedLang] : 'no typing'
            }
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoAdvance ?? false}
            onChange={(e) => void savePref('autoAdvance', e.target.checked)}
          />
          <span>
            <span className="setting-title">Go to the next word automatically{pinnedHere('autoAdvance') && <span className="device-only-badge">(only on this device)</span>}</span>
            <span className="muted small">
              Once every language due on a card is graded, move on without
              waiting for Next. Quicker on a phone. Off, the card stays up
              until you tap — which is when you read the interval you just
              earned and notice a gender you got wrong.
            </span>
          </span>
        </label>
        <DeviceScope
          pinned={pinnedHere('autoAdvance')}
          onToggle={() => void togglePin('autoAdvance', settings.autoAdvance)}
          accountValue={account?.autoAdvance ? 'on' : 'off'}
        />
      </div>

      {/* Audio sits in its own panel rather than under Recall, because what
          it depends on is the device: the voices are the operating system's,
          and a phone with a good Swedish voice and a laptop without one are
          the same account. Which is why this is the panel where "only on this
          device" earns its keep, rather than the reason to make everything
          device-local — that was the old rule, and it meant a new phone
          started wrong. */}
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
              checked={settings.speakOnReveal ?? false}
              onChange={(e) => void savePref('speakOnReveal', e.target.checked)}
            />
            <span>
              <span className="setting-title">Say the word when the answer appears{pinnedHere('speakOnReveal') && <span className="device-only-badge">(only on this device)</span>}</span>
              <span className="muted small">
                The first language due on the card speaks by itself, so you
                hear it without reaching for the speaker. The speakers stay
                either way — this only decides whether one plays unprompted.
              </span>
            </span>
          </label>
          <DeviceScope
            pinned={pinnedHere('speakOnReveal')}
            onToggle={() => void togglePin('speakOnReveal', settings.speakOnReveal)}
            accountValue={account?.speakOnReveal ? 'on' : 'off'}
          />

          <label className="field">
            <span className="setting-title">Speaking speed{pinnedHere('speechRate') && <span className="device-only-badge">(only on this device)</span>}</span>
            <input
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={settings.speechRate ?? 0.95}
              onChange={(e) =>
                void savePref('speechRate', Number(e.target.value))
              }
            />
            <span className="muted small">
              {(settings.speechRate ?? 0.95).toFixed(2)}× — slower than natural
              on purpose. Hearing where a word breaks and which vowel is long
              is the point here; listening at conversational pace is what
              Reading is for.
            </span>
            <DeviceScope
              pinned={pinnedHere('speechRate')}
              onToggle={() => void togglePin('speechRate', settings.speechRate)}
              accountValue={`${(account?.speechRate ?? 0.95).toFixed(2)}×`}
            />
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
              void persistSettings({ dailyNewLimit: Number(e.target.value) })
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
              void persistSettings({ dailyReviewLimit: Number(e.target.value) })
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
              void persistSettings({ requestRetention: Number(e.target.value) / 100 })
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

      {/* Shut by default and low on the page: it is the longest thing in
          Settings and the thing you need least often, but it is the only
          answer in the app to "what does Recall test do that Review does
          not" once the landing page is behind you. */}
      <details className="panel help">
        <summary>
          <h2>Help &amp; About</h2>
        </summary>
        {/* The short version first, in a language the reader already has:
            someone opening Help is usually stuck now, and six English
            paragraphs are the wrong answer to that. */}
        <QuickStart lang={settings.nativeLang} />
        <h3>All of it, step by step</h3>
        <HowTo />
        <h3>About</h3>
        <p className="muted small">
          Lingo3 is built and run by one person learning Swedish and German in
          Sweden. Your vocabulary is yours: nothing is sold, there are no
          adverts, and Settings → Full backup gives you the lot as a file.
        </p>
        <p className="muted small">
          Something wrong or missing — a bad article, a word that came back
          odd? The suggestion box below reaches a human.
        </p>
      </details>

      <SuggestionBox />

      {/* Renders nothing unless the database says you are an admin — the local
          settings row is synced, so trusting its is_admin would be client
          state deciding what the server already decides. */}
      <AdminPanel />

      {/* Deleting an account is the only irreversible thing in this app, so it
          is last, behind a closed section, and nowhere near anything you press
          often. Signed-in only: there is no account to delete otherwise. */}
      {userId && email && <DeleteAccount userId={userId} email={email} />}

      <p className="muted small legal-line">
        <a href="/privacy" target="_blank" rel="noreferrer">
          Privacy
        </a>
      </p>

      {/* Which build is actually running. Without this there is no way to tell
          from a phone whether the service worker has picked up a new deploy —
          which, after a day lost to a cached login wall, is worth four lines. */}
      <p className="version-line">
        Lingo3 v{__APP_VERSION__} · built {__BUILD_DATE__}
      </p>
    </div>
  )
}

/**
 * The "only on this device" switch that sits under an overridable control.
 *
 * It states what the account says underneath, because the question you
 * actually have when you see a pinned setting is "and what does everything
 * else do?" — and without that line the only way to find out is to unpin it.
 */
function DeviceScope({
  pinned,
  onToggle,
  accountValue,
}: {
  pinned: boolean
  onToggle: () => void
  accountValue: string
}) {
  return (
    <span className="device-scope">
      <label className="check small">
        <input type="checkbox" checked={pinned} onChange={onToggle} />
        <span className="muted small">Only on this device</span>
      </label>
      <span className="muted small">
        {pinned
          ? `Your other devices use ${accountValue}.`
          : 'Follows your account — set it once, and a new device is already set up.'}
      </span>
    </span>
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
  a.download = `lingo3-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
