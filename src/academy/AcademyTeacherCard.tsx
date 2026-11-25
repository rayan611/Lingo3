import type { ReactNode } from 'react'
import type { Locale } from './types'

export type TeacherCardData = {
  id: string
  name: string
  photoUrl: string | null
  intro: string
  languages: string[]
  levels: string[]
  /** Lowest published price among the teacher's courses, in SEK, if any. */
  fromPrice: number | null
  courseCount: number
}

const T: Record<Locale, { from: string; courses: string; profile: string; trial: string; sek: string }> = {
  en: { from: 'From', courses: 'courses', profile: 'View profile', trial: 'Request trial', sek: 'SEK' },
  sv: { from: 'Från', courses: 'kurser', profile: 'Visa profil', trial: 'Begär provlektion', sek: 'SEK' },
  fa: { from: 'از', courses: 'دوره', profile: 'مشاهدهٔ پروفایل', trial: 'درخواست کلاس آزمایشی', sek: 'کرون' },
  de: { from: 'Ab', courses: 'Kurse', profile: 'Profil ansehen', trial: 'Probestunde anfragen', sek: 'SEK' }
}

/** One teacher in the directory: who they are, what they teach, and the single next step. */
export function AcademyTeacherCard({
  locale,
  teacher,
  onOpen,
  onTrial,
  extra
}: {
  locale: Locale
  teacher: TeacherCardData
  onOpen: () => void
  onTrial: (() => void) | null
  extra?: ReactNode
}) {
  const t = T[locale]
  return (
    <article className="ac-teacher">
      <button
        type="button"
        className="ac-teacher-top"
        onClick={onOpen}
        aria-label={`${t.profile}: ${teacher.name}`}
      >
        {teacher.photoUrl ? (
          <img src={teacher.photoUrl} alt="" loading="lazy" decoding="async" width={64} height={64} />
        ) : (
          <span className="ac-avatar" aria-hidden="true">
            {teacher.name.slice(0, 1)}
          </span>
        )}
        <span className="ac-teacher-name">
          <strong>{teacher.name}</strong>
          <small>
            {teacher.courseCount > 0 && `${teacher.courseCount} ${t.courses}`}
            {teacher.fromPrice != null && ` · ${t.from} ${teacher.fromPrice} ${t.sek}`}
          </small>
        </span>
      </button>
      {teacher.intro && <p className="ac-teacher-intro">{teacher.intro}</p>}
      <div className="ac-chips">
        {teacher.languages.map(l => (
          <span key={l} className="ac-chip">
            {l}
          </span>
        ))}
        {teacher.levels.map(l => (
          <span key={l} className="ac-chip ac-chip-soft">
            {l}
          </span>
        ))}
      </div>
      {extra}
      <div className="ac-teacher-actions">
        {onTrial && (
          <button type="button" className="ac-btn primary" onClick={onTrial}>
            {t.trial}
          </button>
        )}
        <button type="button" className="ac-btn" onClick={onOpen}>
          {t.profile}
        </button>
      </div>
    </article>
  )
}

/** Grey placeholder cards shown while the lists load, instead of an empty page. */
export function AcademySkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="ac-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="ac-skeleton" key={i}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}
