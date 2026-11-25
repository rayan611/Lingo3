import { useEffect, useState } from 'react'
import { supabase } from '../auth/supabase'
import type { Locale } from './types'

type Review = {
  id: string
  rating: number
  body: string
  teacher_response: string | null
  created_at: string
}

const T: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Reviews',
    none: 'No reviews yet.',
    write: 'Write a review',
    rating: 'Rating',
    body: 'Your experience',
    send: 'Send review',
    thanks: 'Thank you. Your review is published.',
    need: 'You can review a teacher after a completed lesson with them.',
    signIn: 'Sign in to write a review.',
    reply: 'Teacher reply',
    sendReply: 'Send reply',
    stars: 'out of 5'
  },
  sv: {
    title: 'Omdömen',
    none: 'Inga omdömen än.',
    write: 'Skriv ett omdöme',
    rating: 'Betyg',
    body: 'Din upplevelse',
    send: 'Skicka omdöme',
    thanks: 'Tack. Ditt omdöme är publicerat.',
    need: 'Du kan ge ett omdöme efter en genomförd lektion med läraren.',
    signIn: 'Logga in för att skriva ett omdöme.',
    reply: 'Lärarens svar',
    sendReply: 'Skicka svar',
    stars: 'av 5'
  },
  fa: {
    title: 'نظرها',
    none: 'هنوز نظری ثبت نشده است.',
    write: 'نوشتن نظر',
    rating: 'امتیاز',
    body: 'تجربهٔ شما',
    send: 'ارسال نظر',
    thanks: 'سپاس. نظر شما منتشر شد.',
    need: 'پس از یک کلاس انجام‌شده با این استاد می‌توانید نظر بدهید.',
    signIn: 'برای نوشتن نظر وارد شوید.',
    reply: 'پاسخ استاد',
    sendReply: 'ارسال پاسخ',
    stars: 'از ۵'
  },
  de: {
    title: 'Bewertungen',
    none: 'Noch keine Bewertungen.',
    write: 'Bewertung schreiben',
    rating: 'Bewertung',
    body: 'Ihre Erfahrung',
    send: 'Bewertung senden',
    thanks: 'Danke. Ihre Bewertung ist veröffentlicht.',
    need: 'Sie können nach einer abgeschlossenen Stunde bewerten.',
    signIn: 'Zum Bewerten bitte anmelden.',
    reply: 'Antwort der Lehrkraft',
    sendReply: 'Antwort senden',
    stars: 'von 5'
  }
}

/** Public reviews of one teacher. Hidden entirely while an admin has reviews switched off. */
export function AcademyReviews({
  teacherId,
  userId,
  locale,
  isTeacherOwner
}: {
  teacherId: string
  userId: string | null
  locale: Locale
  isTeacherOwner: boolean
}) {
  const t = T[locale]
  const [on, setOn] = useState(false)
  const [rows, setRows] = useState<Review[]>([])
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState('')
  const [replying, setReplying] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const flag = await supabase().rpc('academy_reviews_on')
        if (!active || flag.error || flag.data !== true) return
        const { data } = await supabase()
          .from('academy_reviews')
          .select('id,rating,body,teacher_response,created_at')
          .eq('teacher_id', teacherId)
          .is('hidden_reason', null)
          .order('created_at', { ascending: false })
          .limit(30)
        if (!active) return
        setRows((data ?? []) as Review[])
        setOn(true)
      } catch {
        /* reviews simply do not show */
      }
    })()
    return () => {
      active = false
    }
  }, [teacherId, tick])

  if (!on) return null
  const average = rows.length ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : 0

  async function submit() {
    setNotice('')
    const { error } = await supabase().rpc('academy_review_action', {
      p_action: 'submit',
      p_teacher: teacherId,
      p_rating: rating,
      p_body: body
    })
    if (error) setNotice(t.need)
    else {
      setNotice(t.thanks)
      setBody('')
      setTick(n => n + 1)
    }
  }
  async function reply(id: string) {
    const text = (replying[id] ?? '').trim()
    if (!text) return
    const { error } = await supabase().rpc('academy_review_action', {
      p_action: 'reply',
      p_review: id,
      p_body: text
    })
    if (!error) setTick(n => n + 1)
  }

  return (
    <section className="academy-card ac-reviews" aria-label={t.title}>
      <h2>
        {t.title}
        {rows.length > 0 && (
          <small>
            {' '}
            · {average.toFixed(1)} {t.stars} ({rows.length})
          </small>
        )}
      </h2>
      {rows.length === 0 && <p className="ac-muted">{t.none}</p>}
      {rows.map(r => (
        <article key={r.id} className="ac-review">
          <strong aria-label={`${r.rating} ${t.stars}`}>
            {'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}
          </strong>
          <p>{r.body}</p>
          {r.teacher_response && (
            <p className="ac-review-reply">
              <strong>{t.reply}:</strong> {r.teacher_response}
            </p>
          )}
          {isTeacherOwner && !r.teacher_response && (
            <div className="ac-review-form">
              <input
                value={replying[r.id] ?? ''}
                onChange={e => setReplying(s => ({ ...s, [r.id]: e.target.value }))}
                placeholder={t.reply}
                maxLength={2000}
              />
              <button type="button" className="ac-btn" onClick={() => void reply(r.id)}>
                {t.sendReply}
              </button>
            </div>
          )}
        </article>
      ))}
      {userId && !isTeacherOwner && (
        <div className="ac-review-form">
          <h3>{t.write}</h3>
          <div className="ac-filter-chips" role="radiogroup" aria-label={t.rating}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                className={'ac-chip-btn' + (rating === n ? ' on' : '')}
                onClick={() => setRating(n)}
              >
                {n} ★
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={t.body}
            maxLength={5000}
          />
          <button
            type="button"
            className="ac-btn primary"
            disabled={!body.trim()}
            onClick={() => void submit()}
          >
            {t.send}
          </button>
        </div>
      )}
      {!userId && <p className="ac-muted">{t.signIn}</p>}
      {notice && <p className="ac-muted">{notice}</p>}
    </section>
  )
}
