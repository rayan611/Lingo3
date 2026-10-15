import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { LaterWord } from '../db/types'

/** Same word twice is one entry — case and surrounding space ignored. */
function key(lemma: string): string {
  return lemma.trim().toLocaleLowerCase()
}

/**
 * Parks a word for later. Returns false when it is already on the list, so
 * the caller can say so rather than silently doing nothing.
 */
export async function parkWord(lemma: string): Promise<boolean> {
  const text = lemma.trim()
  if (!text) return false
  const existing = await db.later.toArray()
  if (existing.some((row) => key(row.lemma) === key(text))) return false
  await db.later.add({
    id: crypto.randomUUID(),
    lemma: text,
    createdAt: Date.now(),
  })
  return true
}

/**
 * Words written down but not yet added.
 *
 * The obstacle this exists for is a class that moves faster than the app: you
 * hear a word, you have fifteen seconds, and expanding it properly needs a
 * model call and a look at the preview. Parking it costs one tap and no
 * network, and the list is what you work through afterwards.
 *
 * Three actions per row, and the colours are the same ones the Add form uses
 * so they mean the same thing in both places: blue checks, green adds, red
 * throws away. Check and Add both fill the box above rather than acting in
 * place — the preview, the collision dialog and the tag editor all live up
 * there, and a second copy of them inside a list row would be a second place
 * for the same decision to be made.
 *
 * Collapsed by default once it has more than a handful in it: a long list of
 * things you have not done, open every time you reach the screen, is a
 * reproach rather than a tool.
 */
export function LaterList({
  busy,
  onUse,
}: {
  busy: boolean
  onUse: (row: LaterWord, which: 'check' | 'add') => void
}) {
  const rows = useLiveQuery(() => db.later.orderBy('createdAt').toArray(), [], [])

  if (rows.length === 0) return null

  return (
    <details className="panel later" open={rows.length <= 5}>
      <summary>
        <h3>Words to add later</h3>
        <span className="badge">{rows.length}</span>
      </summary>

      <p className="muted small">
        Written down, not looked up yet. Check fills the box above with the
        word so you can see what the model makes of it; Add puts it straight
        in. Either way it leaves this list once it is really saved.
      </p>

      <ul className="later-list">
        {rows.map((row) => (
          <li key={row.id}>
            <span className="later-word">{row.lemma}</span>
            <span className="later-actions">
              <button
                type="button"
                className="chip inspect"
                disabled={busy}
                onClick={() => onUse(row, 'check')}
              >
                Check
              </button>
              <button
                type="button"
                className="chip go"
                disabled={busy}
                onClick={() => onUse(row, 'add')}
              >
                Add
              </button>
              <button
                type="button"
                className="chip drop"
                disabled={busy}
                aria-label={`Remove ${row.lemma}`}
                onClick={() => void db.later.delete(row.id)}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
