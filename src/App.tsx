import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  adoptLocalData,
  db,
  ensureSettings,
  openForUser,
  readSettings,
  saveSettings,
} from './db/db'
import { queueCounts } from './fsrs/queue'
import { processPending } from './ai/expand'
import { LANG_NAMES, activeTargets, type Settings } from './db/types'
import { authConfigured } from './auth/supabase'
import { useSession } from './auth/useSession'
import { ResetPassword } from './auth/ResetPassword'
import { SignIn } from './auth/SignIn'
import { sync, type SyncResult } from './sync/sync'

/**
 * Sync outcomes that are not failures and must not raise a banner. `offline`
 * is the expected state on a train; `already running` just means two triggers
 * overlapped — the five-minute interval firing while a debounced write-sync is
 * still in flight — and the work is being done by the run that holds the lock.
 */
const BENIGN_SYNC_ERRORS = new Set(['offline', 'already running'])
import { AddWord } from './ui/AddWord'
import { Review } from './ui/Review'
import { Browse } from './ui/Browse'
import { Training } from './ui/Training'
import { StoryMode } from './ui/StoryMode'
import { SettingsPanel } from './ui/SettingsPanel'
import {
  IconAdd,
  IconReading,
  IconReview,
  IconSettings,
  IconTraining,
  IconWords,
} from './ui/icons'
import { InstallButton } from './ui/InstallButton'
import { NamePrompt } from './ui/NamePrompt'
import { Logo } from './ui/Logo'
import { Landing, shouldShowLanding } from './ui/Landing'
import { Privacy } from './ui/Privacy'
import { DEFAULT_THEME, applyTheme, cacheTheme, readTheme } from './lib/theme'

/**
 * Profile is not here: it lives inside Settings now. Seven tabs did not fit a
 * phone without a sideways scroll that hid whichever tab you wanted, and of
 * the seven, Profile was the one you open monthly rather than daily.
 */
type Tab = 'add' | 'training' | 'read' | 'review' | 'browse' | 'settings'

export function App() {
  const { session, userId, email, recovery, endRecovery } = useSession()

  /**
   * The privacy policy, at /privacy.
   *
   * A branch rather than a route: the service worker sends every path to
   * index.html, so this is how a second page exists at all here. It is checked
   * before the session is, because both app stores need a URL that shows the
   * policy to anyone who opens it, signed in or not — and because a policy
   * behind a login is not a policy anyone can read.
   */
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /**
   * Before first paint, so a dark-theme user does not get a white flash.
   *
   * The theme follows the account now, and the account lives in Dexie, which
   * is not open yet at this point. So localStorage keeps the last theme this
   * device actually used, purely as a boot cache: it is right on every launch
   * after the first, and corrected a few hundred milliseconds in if the
   * account disagrees.
   */
  useEffect(() => {
    applyTheme(readTheme())
  }, [])

  const [dbReady, setDbReady] = useState(false)
  const [dbKey, setDbKey] = useState('local')
  // Read once, not on every render: it must not flip to the landing page
  // underneath someone who is already using the app.
  const [showLanding, setShowLanding] = useState(shouldShowLanding)

  // Point Dexie at this user's store before rendering anything that queries it.
  useEffect(() => {
    if (session === undefined) return
    let cancelled = false
    ;(async () => {
      await openForUser(userId)
      if (userId) {
        // Anything added before signing in belongs to this account now.
        await adoptLocalData().catch(() => 0)
      }
      // Create the settings row here, once, rather than from a live query.
      const current = await ensureSettings()
      // One-time lift of the device's existing theme into the account, for
      // anyone who chose one before themes followed the account. Done once,
      // only when the account has no theme of its own, so it cannot keep
      // overwriting a choice made on another device.
      //
      // A cached 'system' is not lifted: it is indistinguishable from never
      // having chosen, and lifting it would pin the old default onto accounts
      // that should simply get the new one.
      if (current.theme === undefined) {
        const cached = readTheme()
        if (cached !== 'system' && cached !== DEFAULT_THEME) {
          await saveSettings({ theme: cached })
        }
      }
      if (!cancelled) {
        setDbKey(userId ?? 'local')
        setDbReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, userId])

  if (path.replace(/\/+$/, '') === '/privacy') {
    return (
      <Privacy
        onBack={() => {
          window.history.pushState({}, '', '/')
          setPath('/')
        }}
      />
    )
  }

  if (session === undefined) {
    return <div className="boot">Checking your session…</div>
  }

  // The front door, for a first visit in a browser. Someone already signed in
  // has plainly been here before, so they go straight through.
  if (showLanding && !session) {
    return <Landing onOpen={() => setShowLanding(false)} />
  }

  if (authConfigured && !session) {
    return <SignIn />
  }

  // A reset link signs you in, so this has to stand in front of the app —
  // otherwise the app just opens and the person never gets to set the
  // password they came here to set.
  if (recovery) {
    return <ResetPassword email={email} onDone={endRecovery} />
  }

  if (!dbReady) {
    return <div className="boot">Opening your words…</div>
  }

  return <Workspace key={dbKey} userId={userId} email={email} />
}

function Workspace({
  userId,
  email,
}: {
  userId: string | null
  email: string | null
}) {
  const [tab, setTab] = useState<Tab>('add')
  const [online, setOnline] = useState(navigator.onLine)
  const [syncState, setSyncState] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)
  const syncTimer = useRef<number | null>(null)
  const debounceTimer = useRef<number | null>(null)

  const settings = useLiveQuery(() => readSettings(), [])
  const counts = useLiveQuery(
    async () => (settings ? queueCounts(settings) : null),
    [settings],
  )
  useLiveQuery(() => db.cards.count(), [])

  /**
   * Apply the theme that is actually in force — the account's, or this
   * device's if it has pinned one — and leave it in the boot cache so the
   * next launch paints it immediately. Runs on every change, which is also
   * what makes a theme chosen on the laptop arrive on the phone.
   */
  const theme = settings?.theme
  useEffect(() => {
    cacheTheme(theme ?? DEFAULT_THEME)
  }, [theme])

  /**
   * The most recent local write, used to sync shortly after you change
   * something rather than up to five minutes later. Both tables index
   * `updatedAt`, so this is one key lookup each and it re-fires on any write.
   */
  const lastWrite =
    useLiveQuery(async () => {
      const [concept, card] = await Promise.all([
        db.concepts.orderBy('updatedAt').last(),
        db.cards.orderBy('updatedAt').last(),
      ])
      return Math.max(concept?.updatedAt ?? 0, card?.updatedAt ?? 0)
    }, []) ?? 0

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const runSync = useCallback(async () => {
    if (!userId || !navigator.onLine) return
    setSyncing(true)
    const result = await sync(userId)
    setSyncState(result)
    setSyncing(false)
  }, [userId])

  // Sync on load, when the connection returns, and every few minutes. Reviewing
  // never waits on it — the app reads local data regardless.
  useEffect(() => {
    if (!userId) return
    void runSync()
    syncTimer.current = window.setInterval(() => void runSync(), 5 * 60_000)
    return () => {
      if (syncTimer.current) window.clearInterval(syncTimer.current)
    }
  }, [userId, runSync])

  useEffect(() => {
    if (online) void runSync()
  }, [online, runSync])

  /**
   * Sync when the app goes to the background.
   *
   * Not on exit: `beforeunload` frequently never fires on iOS, and a PWA that
   * is backgrounded and then killed by the system never sees it at all.
   * `visibilitychange` to hidden does fire — switching apps, locking the
   * phone, closing the tab — which is the moment that actually matters.
   */
  useEffect(() => {
    if (!userId) return
    const onHide = () => {
      if (document.visibilityState === 'hidden') void runSync()
    }
    document.addEventListener('visibilitychange', onHide)
    // A belt-and-braces second trigger for desktop browsers, where it is
    // reliable. Harmless where it is not: sync is idempotent.
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [userId, runSync])

  /**
   * And a few seconds after a local change, so a word added on the phone is on
   * the laptop by the time you get there. Debounced, because grading a card
   * writes once per language and a review session would otherwise be one sync
   * per keystroke.
   *
   * Safe to do often: sync is last-write-wins on `updatedAt` and the review
   * log is append-only, so running it more only shrinks the window in which
   * two devices can disagree.
   */
  useEffect(() => {
    if (!userId || lastWrite === 0) return
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current)
    debounceTimer.current = window.setTimeout(() => void runSync(), 6000)
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current)
    }
  }, [userId, lastWrite, runSync])

  useEffect(() => {
    if (!settings || !online) return
    void processPending(settings)
  }, [settings, online])

  if (!settings) return <div className="boot">Loading…</div>

  const due = counts?.total ?? 0

  return (
    <div className="app">
      {/* Two zones: who you are in this app, and what you are studying.
          The greeting sits with the mark rather than in a column of its own —
          centred, it read as a third unrelated thing and was the first to be
          squeezed out on a phone. Beside the name it is one phrase. */}
      <header className="topbar">
        <div className="brand-block">
          <Logo />
          <span className="brand">Lingo3</span>
          {settings.displayName && (
            <span className="brand-greeting">Hej {settings.displayName}</span>
          )}
        </div>
        <div className="topbar-meta">
          <span className="brand-sub">{learningLine(settings)}</span>
          {!online && <span className="badge offline">offline</span>}
          {syncing && <span className="badge subtle">syncing…</span>}
          {syncState?.error && !BENIGN_SYNC_ERRORS.has(syncState.error) && (
            <span className="badge warn-badge">sync failed</span>
          )}
          <InstallButton />
        </div>
      </header>

      {authConfigured && !settings.displayName && <NamePrompt />}

      {/* Ordered the way a session actually goes: add words, train them,
          read them, then review. The tab was called Test and is called Review
          now — "test" names what the screen does to you, "review" names what
          you are doing, and it is the word the rest of the app, the id, the
          route and review_log already use. Only the label moved; renaming the
          storage layer to match a label is how a sync bug gets shipped for
          nothing. */}
      <nav className="tabs">
        <TabButton id="add" tab={tab} set={setTab} icon={<IconAdd />}>
          Add
        </TabButton>
        <TabButton id="training" tab={tab} set={setTab} icon={<IconTraining />}>
          Training
        </TabButton>
        <TabButton id="read" tab={tab} set={setTab} icon={<IconReading />}>
          Reading
        </TabButton>
        <TabButton id="review" tab={tab} set={setTab} badge={due} icon={<IconReview />}>
          Review
        </TabButton>
        <TabButton id="browse" tab={tab} set={setTab} icon={<IconWords />}>
          Words
        </TabButton>
        <TabButton id="settings" tab={tab} set={setTab} icon={<IconSettings />}>
          Settings
        </TabButton>
      </nav>

      {syncState?.error && !BENIGN_SYNC_ERRORS.has(syncState.error) && (
        <div className="sync-banner">
          <div>
            <strong>Sync didn't work.</strong>{' '}
            <span className="muted">
              Your words are safe on this device — this only affects the copy on
              the server.
            </span>
            <pre className="sync-banner-detail">{syncState.error}</pre>
          </div>
          <div className="row">
            <button onClick={() => void runSync()} disabled={syncing}>
              Try again
            </button>
            <button
              className="link"
              onClick={() => void navigator.clipboard?.writeText(syncState.error ?? '')}
            >
              Copy error
            </button>
          </div>
        </div>
      )}

      <main className="content">
        {tab === 'review' && (
          <ReviewTab settings={settings} onExit={() => setTab('add')} />
        )}
        {tab === 'training' && <Training settings={settings} />}
        {tab === 'read' && <StoryMode settings={settings} />}
        {tab === 'add' && <AddWord settings={settings} />}
        {tab === 'browse' && <Browse settings={settings} />}
        {tab === 'settings' && (
          <SettingsPanel
            settings={settings}
            userId={userId}
            email={email}
            syncState={syncState}
            syncing={syncing}
            onSync={runSync}
          />
        )}
      </main>
    </div>
  )
}

/**
 * "Learning Swedish, German and English" — but on a phone three full language
 * names wrap badly, so below a narrow width it is the codes instead.
 */
function learningLine(settings: Settings): string {
  const active = activeTargets(settings)
  if (active.length === 0) return 'no active language'
  const narrow =
    typeof window !== 'undefined' && window.innerWidth < 420 && active.length > 2
  const names = active.map((l) => (narrow ? l.toUpperCase() : LANG_NAMES[l]))
  const list =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names[0]
  return `Learning ${list}`
}

function ReviewTab({
  settings,
  onExit,
}: {
  settings: Settings
  onExit: () => void
}) {
  const [session, setSession] = useState(0)
  return (
    <Review
      key={session}
      settings={settings}
      onExit={() => {
        setSession((s) => s + 1)
        onExit()
      }}
    />
  )
}

function TabButton({
  id,
  tab,
  set,
  badge,
  icon,
  children,
}: {
  id: Tab
  tab: Tab
  set: (t: Tab) => void
  badge?: number
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      /* tab-<id> carries nothing but the hue. Six tabs in one accent colour
         read as one undifferentiated strip; a colour per tab is the cheapest
         way to make the one you want findable without moving anything. */
      className={`tab tab-${id} ${tab === id ? 'active' : ''}`}
      onClick={() => set(id)}
      aria-current={tab === id ? 'page' : undefined}
    >
      <span className="tab-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="tab-label">{children}</span>
      {badge !== undefined && badge > 0 && <span className="tab-badge">{badge}</span>}
    </button>
  )
}
