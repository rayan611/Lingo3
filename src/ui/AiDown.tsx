/**
 * Shown when the AI side cannot be reached. The rest of the app keeps
 * working; this only says so, plainly, and offers another go.
 */
export function AiDown({ what, onRetry, busy }: { what: string; onRetry: () => void; busy?: boolean }) {
  return (
    <div className="status warn ai-down" role="status">
      <span>
        {what} isn't available right now. Try again in a little while.
      </span>
      <button type="button" onClick={onRetry} disabled={busy}>
        {busy ? 'Trying…' : 'Try again'}
      </button>
    </div>
  )
}
