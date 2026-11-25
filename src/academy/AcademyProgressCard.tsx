import { useEffect, useState } from 'react'
import { supabase } from '../auth/supabase'
import type { Locale } from './types'

type Counts = { lessons: number; summaries: number; words: number; wordsWeek: number }

const T: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Your progress',
    lessons: 'lessons completed',
    summaries: 'lesson summaries',
    words: 'words from lessons',
    week: 'new words this week',
    empty: 'Your progress appears here after your first lesson.'
  },
  sv: {
    title: 'Dina framsteg',
    lessons: 'genomförda lektioner',
    summaries: 'lektionssammanfattningar',
    words: 'ord från lektioner',
    week: 'nya ord den här veckan',
    empty: 'Dina framsteg visas här efter din första lektion.'
  },
  fa: {
    title: 'پیشرفت شما',
    lessons: 'کلاس برگزارشده',
    summaries: 'خلاصهٔ کلاس',
    words: 'کلمه از کلاس‌ها',
    week: 'کلمهٔ جدید این هفته',
    empty: 'پیشرفت شما پس از اولین کلاس اینجا نمایش داده می‌شود.'
  },
  de: {
    title: 'Ihr Fortschritt',
    lessons: 'abgeschlossene Stunden',
    summaries: 'Stundenzusammenfassungen',
    words: 'Wörter aus den Stunden',
    week: 'neue Wörter diese Woche',
    empty: 'Ihr Fortschritt erscheint nach der ersten Stunde.'
  }
}

/** Numbers the student already earned, counted from real records. Plain wording, no judging. */
export function AcademyProgressCard({ userId, locale }: { userId: string; locale: Locale }) {
  const t = T[locale]
  const [c, setC] = useState<Counts | null>(null)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const count = (table: string, build: (q: any) => any) =>
          build(
            supabase().from(table).select('id', { count: 'exact', head: true }).eq('student_id', userId)
          ).then((r: { count: number | null }) => r.count ?? 0)
        const week = new Date(Date.now() - 7 * 86400000).toISOString()
        const [lessons, summaries, words, wordsWeek] = await Promise.all([
          count('academy_bookings', q => q.eq('status', 'completed')),
          count('academy_session_summaries', q => q),
          count('academy_lesson_words', q => q),
          count('academy_lesson_words', q => q.gte('created_at', week))
        ])
        if (active) setC({ lessons, summaries, words, wordsWeek })
      } catch {
        /* the card stays hidden */
      }
    })()
    return () => {
      active = false
    }
  }, [userId])
  if (!c) return null
  const any = c.lessons + c.summaries + c.words > 0
  return (
    <section className="ac-card academy-progress" aria-label={t.title}>
      <h2>{t.title}</h2>
      {!any ? (
        <p className="ac-muted">{t.empty}</p>
      ) : (
        <div className="ac-stats">
          {(
            [
              ['lessons', c.lessons],
              ['summaries', c.summaries],
              ['words', c.words],
              ['week', c.wordsWeek]
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="ac-stat">
              <strong>{value}</strong>
              <span>{t[key]}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
