import { useEffect } from 'react'
import { SEEN_KEY } from './landingSeen'
import { INVITE_WELCOME, fillInvite } from '../lib/invite'
import { navigateProduct } from '../lib/productNavigation'

/**
 * Shared front door for the two Lingo3 products.
 *
 * Lingo3 App = self-study vocabulary/grammar/review workspace.
 * Lingo3 Academy = human-led courses/teachers/Learning Space.
 *
 * Keep this component light. The detailed public marketing page lives in
 * /showcase.html inside the iframe below. Do not duplicate that page here.
 * Product/route map: docs/LINGO3_APP_ACADEMY_GUIDE.md
 */
export function Landing({ onOpen, inviter = '' }: { onOpen: () => void; inviter?: string }) {
  useEffect(() => {
    if (inviter) document.title = fillInvite(INVITE_WELCOME, { name: inviter })
  }, [inviter])

  function open() {
    try {
      window.localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Storage can be blocked in private mode; opening the App must still work.
    }
    onOpen()
  }

  useEffect(() => {
    const onShowcaseMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.app !== 'Lingo3') return

      if (event.data?.type === 'showcase-open') {
        open()
        return
      }

      if (event.data?.type === 'showcase-academy') {
        navigateProduct('/academy')
        return
      }

      if (event.data?.type === 'showcase-height' && Number.isFinite(event.data.height)) {
        const frame = document.getElementById('lingo-showcase') as HTMLIFrameElement | null
        if (!frame) return
        const nextHeight = Math.max(600, Math.ceil(event.data.height))
        const currentHeight = frame.getBoundingClientRect().height
        // Avoid a parent/iframe resize feedback loop for one-pixel rounding changes.
        if (Math.abs(currentHeight - nextHeight) > 2) frame.style.height = nextHeight + 'px'
      }
    }

    window.addEventListener('message', onShowcaseMessage)
    return () => window.removeEventListener('message', onShowcaseMessage)
  }, [onOpen])

  return (
    <main style={{ minHeight: '100vh', background: '#0c1021', color: 'white' }}>
      {inviter && (
        <p style={{ margin: 0, padding: '12px 20px', textAlign: 'center', color: 'white', background: '#302447' }}>
          💌 {fillInvite(INVITE_WELCOME, { name: inviter })}
        </p>
      )}

      <section
        aria-label="Choose Lingo3 App or Lingo3 Academy"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '20px 20px 8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 14,
        }}
      >
        <button
          type="button"
          onClick={open}
          style={{
            minHeight: 118,
            textAlign: 'left',
            padding: 20,
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,.22)',
            background: 'linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.05))',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          <strong style={{ display: 'block', fontSize: 21, marginBottom: 6 }}>Lingo3 App</strong>
          <span style={{ color: '#d7d5e7' }}>Vocabulary, grammar, review and self-practice.</span>
          <span style={{ display: 'block', marginTop: 12, fontWeight: 800, color: '#8ee8ff' }}>Enter App →</span>
        </button>

        <button
          type="button"
          onClick={() => navigateProduct('/academy')}
          style={{
            minHeight: 118,
            padding: 20,
            borderRadius: 20,
            border: '1px solid rgba(181,156,255,.65)',
            background: 'linear-gradient(135deg,rgba(167,139,250,.24),rgba(56,189,248,.12))',
            color: 'white',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <strong style={{ display: 'block', fontSize: 21, marginBottom: 6 }}>Lingo3 Academy</strong>
          <span style={{ color: '#d7d5e7' }}>Human trainers, courses, booking, learning space and resources.</span>
          <span style={{ display: 'block', marginTop: 12, fontWeight: 800, color: '#d7caff' }}>Enter Academy →</span>
        </button>
      </section>

      <iframe
        id="lingo-showcase"
        title="Lingo3 — discover and enter"
        src="/showcase.html"
        style={{ display: 'block', width: '100%', height: 'calc(100vh - 150px)', minHeight: 700, border: 0 }}
      />
    </main>
  )
}
