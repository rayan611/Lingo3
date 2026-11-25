/**
 * Emails a student when their teacher publishes a lesson (Phase 1).
 *
 * Called by the teacher's browser right after `academy_publish_lesson` succeeds, with the teacher's
 * own session token. The server confirms with that token that the caller really may see the
 * classroom (row-level security), then looks up the student's address with the service key and
 * sends one email through Resend.
 *
 * Fails open and quietly: if RESEND_API_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured the
 * lesson is still published and the student still gets the in-app notice; only the email is skipped.
 * No email is sent twice for one lesson within two minutes.
 */
export const maxDuration = 15

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type Res = { status: (n: number) => Res; json: (v: unknown) => void }

const FROM = process.env.ACADEMY_MAIL_FROM || 'Lingo3 Academy <academy@lingo3.com>'
const recent = new Map<string, number>()

const copy: Record<string, { subject: string; line: string; cta: string }> = {
  en: {
    subject: 'Your teacher published a new lesson',
    line: 'Your lesson summary and new words are ready. The words are already in your Lingo3 review.',
    cta: 'Open Lingo3 Academy'
  },
  sv: {
    subject: 'Din lärare har publicerat en ny lektion',
    line: 'Sammanfattningen och nya ord är klara. Orden finns redan i din Lingo3-repetition.',
    cta: 'Öppna Lingo3 Academy'
  },
  fa: {
    subject: 'استاد شما یک جلسهٔ جدید منتشر کرد',
    line: 'خلاصهٔ کلاس و کلمه‌های جدید آماده است. کلمه‌ها همین حالا در مرور لینگو۳ شما هستند.',
    cta: 'باز کردن لینگو۳ آکادمی'
  },
  de: {
    subject: 'Deine Lehrkraft hat eine neue Stunde veröffentlicht',
    line: 'Zusammenfassung und neue Wörter sind bereit. Die Wörter sind schon in deiner Lingo3-Wiederholung.',
    cta: 'Lingo3 Academy öffnen'
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resend = process.env.RESEND_API_KEY
  if (!base || !anon || !service || !resend)
    return res.status(200).json({ sent: false, reason: 'email not configured' })

  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as {
    space?: string
    locale?: string
  }
  if (!token || !body.space || !/^[0-9a-f-]{36}$/i.test(body.space))
    return res.status(400).json({ error: 'Bad request' })

  try {
    // 1. The caller must be able to read this classroom (their own token, so RLS decides).
    const space = await fetch(
      `${base}/rest/v1/academy_learning_spaces?id=eq.${body.space}&select=student_id,teacher_id`,
      {
        headers: { apikey: anon, authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000)
      }
    )
    const rows = (await space.json()) as { student_id: string }[]
    if (!space.ok || !rows.length) return res.status(403).json({ error: 'Not allowed' })
    const studentId = rows[0].student_id

    // 2. One email per classroom per two minutes.
    const now = Date.now()
    if ((recent.get(body.space) ?? 0) > now - 120_000)
      return res.status(200).json({ sent: false, reason: 'recent' })
    recent.set(body.space, now)

    // 3. The student's address (service key; never returned to the browser).
    const user = await fetch(`${base}/auth/v1/admin/users/${studentId}`, {
      headers: { apikey: service, authorization: `Bearer ${service}` },
      signal: AbortSignal.timeout(6000)
    })
    const email = ((await user.json()) as { email?: string }).email
    if (!user.ok || !email) return res.status(200).json({ sent: false, reason: 'no address' })

    const t = copy[body.locale && copy[body.locale] ? body.locale : 'en']
    const dir = body.locale === 'fa' ? 'rtl' : 'ltr'
    const html = `<div dir="${dir}" style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>${t.subject}</h2><p>${t.line}</p><p><a href="https://lingo3.com/academy/my" style="display:inline-block;padding:12px 20px;background:#5a48d8;color:#fff;border-radius:999px;text-decoration:none">${t.cta}</a></p></div>`
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email], subject: t.subject, html }),
      signal: AbortSignal.timeout(8000)
    })
    return res.status(200).json({ sent: sent.ok })
  } catch {
    return res.status(200).json({ sent: false, reason: 'error' })
  }
}
