/**
 * The model could not be reached: offline, the server could not reach the
 * provider, or the provider is down. Not the same as a bad request — the
 * person did nothing wrong, and the same request may well work in a minute.
 *
 * The UI shows a calm "isn't available right now" with a Try again button for
 * this, instead of a raw error.
 */
export class AiUnavailableError extends Error {}

/** A status that means "the AI side is down", not "your request was wrong". */
export function aiDownStatus(status: number) {
  return status >= 500
}

/**
 * The text to show for a failed AI call where there is no room for the full
 * AiDown note (a list row, a summary line): the same calm sentence when the AI
 * side is down, the real message when the request itself was wrong.
 */
export function aiErrorText(err: unknown, what: string) {
  const down =
    err instanceof AiUnavailableError ||
    (err as { unavailable?: unknown } | null)?.unavailable === true ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  if (down) return `${what} isn't available right now. Try again in a little while.`
  return err instanceof Error ? err.message : String(err)
}
