import { useEffect, useState } from 'react'
import { supabase } from '../auth/supabase'
import { navigateProduct } from '../lib/productNavigation'
import type { Locale } from './types'

type Latest = { covered: string | null; next_focus: string | null; created_at: string }

const T: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Today',
    next: 'Next class',
    none: 'No class booked yet.',
    latest: 'From your last lesson',
    homework: 'Homework',
    words: 'new words from your lessons',
    practise: 'Practise these words',
    empty: 'Your teacher’s lesson summaries and words will appear here.'
  },
  sv: {
    title: 'Idag',
    next: 'Nästa lektion',
    none: 'Ingen lektion bokad än.',
    latest: 'Från senaste lektionen',
    homework: 'Läxa',
    words: 'nya ord från dina lektioner',
    practise: 'Öva dessa ord',
    empty: 'Lärarens sammanfattningar och ord visas här.'
  },
  fa: {
    title: 'امروز',
    next: 'کلاس بعدی',
    none: 'هنوز کلاسی رزرو نشده است.',
    latest: 'از آخرین جلسه',
    homework: 'تکلیف',
    words: 'کلمهٔ جدید از کلاس‌های شما',
    practise: 'مرور این کلمه‌ها',
    empty: 'خلاصه و کلمه‌های استاد اینجا نمایش داده می‌شوند.'
  },
  de: {
    title: 'Heute',
    next: 'Nächste Stunde',
    none: 'Noch keine Stunde gebucht.',
    latest: 'Aus der letzten Stunde',
    homework: 'Hausaufgabe',
    words: 'neue Wörter aus deinen Stunden',
    practise: 'Diese Wörter üben',
    empty: 'Zusammenfassungen und Wörter deiner Lehrkraft erscheinen hier.'
  }
}

/** Student "Today": next class, latest lesson summary, homework and new lesson words. */
export function AcademyTodayCard({
  userId,
  locale,
  nextClass
}: {
  userId: string
  locale: Locale
  nextClass: string
}) {
  const t = T[locale]
  const [latest, setLatest] = useState<Latest | null>(null)
  const [words, setWords] = useState(0)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const since = new Date(Date.now() - 14 * 86400000).toISOString()
        const [s, w] = await Promise.all([
          supabase()
            .from('academy_session_summaries')
            .select('covered,next_focus,created_at')
            .eq('student_id', userId)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase()
            .from('academy_lesson_words')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', userId)
            .gte('created_at', since)
        ])
        if (!active) return
        setLatest((s.data?.[0] as Latest | undefined) ?? null)
        setWords(w.count ?? 0)
      } catch {
        /* the card simply stays empty */
      }
    })()
    return () => {
      active = false
    }
  }, [userId])

  return (
    <section className="ac-card academy-today" aria-label={t.title}>
      <h2>{t.title}</h2>
      <p>
        <strong>{t.next}:</strong> {nextClass || t.none}
      </p>
      {latest ? (
        <>
          <p>
            <strong>{t.latest}:</strong> {latest.covered}
          </p>
          {latest.next_focus && (
            <p>
              <strong>{t.homework}:</strong> {latest.next_focus}
            </p>
          )}
        </>
      ) : (
        <p className="ac-muted">{t.empty}</p>
      )}
      {words > 0 && (
        <p>
          <strong>{words}</strong> {t.words}
        </p>
      )}
      {words > 0 && (
        <button type="button" className="ac-btn primary" onClick={() => navigateProduct('/recall')}>
          {t.practise}
        </button>
      )}
    </section>
  )
}
