import type { ReactNode } from 'react'
import type { Locale } from './types'

export type CourseCardData = {
  id: string
  title: string
  description: string
  language: string
  level: string
  price: string
  minutes: number
  formats: string[]
  topics: string[]
}

const T: Record<Locale, { open: string; topics: string; min: string }> = {
  en: { open: 'View course', topics: 'What you learn', min: 'min' },
  sv: { open: 'Visa kurs', topics: 'Det här lär du dig', min: 'min' },
  fa: { open: 'مشاهدهٔ دوره', topics: 'چه چیزی یاد می‌گیرید', min: 'دقیقه' },
  de: { open: 'Kurs ansehen', topics: 'Das lernen Sie', min: 'Min.' }
}

/** One course: language and level, title, short description, price and length, and the next step. */
export function AcademyCourseCard({
  locale,
  course,
  onOpen,
  actions,
  compact = false
}: {
  locale: Locale
  course: CourseCardData
  onOpen: () => void
  actions?: ReactNode
  compact?: boolean
}) {
  const t = T[locale]
  return (
    <article className="ac-course">
      <div className="ac-course-top">
        <span className="ac-chip">{course.language}</span>
        <span className="ac-level">{course.level}</span>
      </div>
      <h3>
        <a
          href={'/academy/courses/' + course.id}
          onClick={e => {
            e.preventDefault()
            onOpen()
          }}
        >
          {course.title}
        </a>
      </h3>
      {course.description && <p className="ac-course-desc">{course.description}</p>}
      <div className="ac-course-meta">
        <strong>{course.price}</strong>
        <span>
          {course.minutes} {t.min}
        </span>
        {course.formats.map(f => (
          <span key={f} className="ac-chip ac-chip-soft">
            {f}
          </span>
        ))}
      </div>
      {!compact && course.topics.length > 0 && (
        <details className="ac-course-topics">
          <summary>{t.topics}</summary>
          <ul>
            {course.topics.slice(0, 6).map(topic => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="ac-course-actions">
        <button type="button" className="ac-btn primary" onClick={onOpen}>
          {t.open}
        </button>
        {actions}
      </div>
    </article>
  )
}
