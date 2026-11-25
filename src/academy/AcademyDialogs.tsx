import { useEffect, useRef, useState } from 'react'
import type { Locale } from './types'

type Request =
  | { kind: 'confirm'; message: string; danger?: boolean; resolve: (ok: boolean) => void }
  | { kind: 'text'; message: string; expected?: string; resolve: (value: string | null) => void }

let listener: ((request: Request) => void) | null = null

/** In-app replacement for window.confirm. Falls back to the browser only if no host is mounted. */
export function askConfirm(message: string, options: { danger?: boolean } = {}): Promise<boolean> {
  if (!listener) return Promise.resolve(window.confirm(message))
  const show = listener
  return new Promise(resolve => show({ kind: 'confirm', message, danger: options.danger, resolve }))
}

/** In-app replacement for window.prompt. Resolves null when cancelled. */
export function askText(message: string, options: { expected?: string } = {}): Promise<string | null> {
  if (!listener) return Promise.resolve(window.prompt(message))
  const show = listener
  return new Promise(resolve => show({ kind: 'text', message, expected: options.expected, resolve }))
}

const labels: Record<Locale, { ok: string; cancel: string; typeHere: string }> = {
  en: { ok: 'Confirm', cancel: 'Cancel', typeHere: 'Type the exact text' },
  sv: { ok: 'Bekräfta', cancel: 'Avbryt', typeHere: 'Skriv exakt text' },
  fa: { ok: 'تأیید', cancel: 'انصراف', typeHere: 'متن را دقیقاً بنویسید' },
  de: { ok: 'Bestätigen', cancel: 'Abbrechen', typeHere: 'Genauen Text eingeben' }
}

/** Mount once inside the Academy root. */
export function AcademyDialogHost({ locale }: { locale: Locale }) {
  const [queue, setQueue] = useState<Request[]>([])
  const [value, setValue] = useState('')
  const okRef = useRef<HTMLButtonElement>(null)
  const text = labels[locale]

  useEffect(() => {
    listener = request => setQueue(items => [...items, request])
    return () => {
      listener = null
    }
  }, [])

  const current = queue[0]
  useEffect(() => {
    setValue('')
    if (current) okRef.current?.focus()
  }, [current])

  if (!current) return null
  const finish = (ok: boolean) => {
    if (current.kind === 'confirm') current.resolve(ok)
    else current.resolve(ok ? value : null)
    setQueue(items => items.slice(1))
  }
  const textOk = current.kind === 'confirm' || value.trim().length > 0
  return (
    <div className="academy-modal" role="presentation" onMouseDown={() => finish(false)}>
      <div
        className="academy-modal-inner academy-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={current.message}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') finish(false)
        }}
      >
        <p>{current.message}</p>
        {current.kind === 'text' && (
          <label>
            {current.expected ? `${text.typeHere}: ${current.expected}` : text.typeHere}
            <input value={value} onChange={e => setValue(e.target.value)} autoFocus />
          </label>
        )}
        <div className="academy-confirm-actions">
          <button type="button" onClick={() => finish(false)}>
            {text.cancel}
          </button>
          <button
            type="button"
            ref={okRef}
            className={current.kind === 'confirm' && current.danger ? 'danger' : 'primary'}
            disabled={!textOk}
            onClick={() => finish(true)}
          >
            {text.ok}
          </button>
        </div>
      </div>
    </div>
  )
}
