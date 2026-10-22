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
