import { deleteWord, removeFromReview } from '../lib/wordActions'

/**
 * The two small buttons at the edge of a test or review card: take the word
 * out of review (kept, resumable from My words) or delete it outright.
 * `onDone` runs after either, so the screen can move past the word.
 */
export function CardActions({
  conceptId,
  onDone,
}: {
  conceptId: string
  onDone?: () => void
}) {
  return (
    <div className="card-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="card-action"
        title="Take it out of review but keep its history — resume it in My words"
        onClick={async () => {
          await removeFromReview(conceptId)
          onDone?.()
        }}
      >
        Remove from review
      </button>
      <button
        type="button"
        className="card-action danger"
        title="Delete this word"
        onClick={async () => {
          if (!confirm('Delete this word and its review history?')) return
          await deleteWord(conceptId)
          onDone?.()
        }}
      >
        Delete
      </button>
    </div>
  )
}
