import Dexie from 'dexie'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { dbNameFor, db } from '../db/db'

/**
 * Deleting an account, which both app stores require to be possible from
 * inside the app and which has to be real rather than cosmetic.
 *
 * The server side is one Postgres function, `delete_my_account()`. It takes no
 * arguments: the caller cannot name a victim, because the function reads
 * `auth.uid()` and deletes that and nothing else. It is SECURITY DEFINER
 * because `auth.users` is not writable by the caller — the alternative was a
 * serverless endpoint holding the service-role key, which bypasses every
 * row-level policy for every user and would be a much larger thing to get
 * wrong.
 *
 * Leaving the auth row behind was not an option either: rows gone but user
 * still present means the email can never sign up again, and the account is
 * not deleted in any sense the person would recognise.
 */

/**
 * Re-authentication, used as the second confirmation.
 *
 * It is deliberately a different *kind* of check from the first one: typing a
 * word proves you read the warning, entering the password proves it is you and
 * not someone holding your unlocked phone. Two of the same kind would be
 * theatre.
 *
 * Supabase has no "verify password" call, so this is a sign-in against the
 * session that already exists. It succeeds silently and changes nothing.
 */
export async function verifyPassword(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<void> {
  // A sign-in underneath, so it needs a CAPTCHA token like any other.
  const { error } = await supabase().auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  })
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes('invalid login')
        ? 'That password is not right.'
        : error.message,
    )
  }
}

/**
 * The second confirmation for someone who signs in with Google.
 *
 * They have no password, so the password step could never be passed and the
 * account could not be deleted at all — which both app stores reject. The
 * equivalent check is a fresh Google sign-in: it proves the same thing (it is
 * you, not someone holding your unlocked phone) by the means the account
 * actually has.
 *
 * It leaves the page, so the intent is written down first and picked up by
 * the delete panel when Google sends the person back.
 */
const PENDING_KEY = 'lingua.deleteAfterGoogle'

/** How recent the Google sign-in must be for the last button to work. */
export const GOOGLE_CONFIRM_MAX_AGE_MS = 5 * 60_000

/** Does this account have a password to check, or only Google? */
export function hasPassword(user: User | null | undefined): boolean {
  const meta = user?.app_metadata ?? {}
  const providers: unknown[] = Array.isArray(meta.providers)
    ? meta.providers
    : [meta.provider]
  return providers.includes('email')
}

export async function confirmWithGoogle(): Promise<void> {
  try {
    sessionStorage.setItem(PENDING_KEY, String(Date.now()))
  } catch {
    /* without it the person lands on Add and has to open Settings again */
  }
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      // Always show Google's account chooser, so this is a step the person
      // takes rather than one a remembered Google session takes for them.
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) {
    clearGoogleConfirmation()
    throw new Error(error.message)
  }
}

/** True when the person has just come back from confirmWithGoogle. */
export function pendingGoogleConfirmation(now = Date.now()): boolean {
  try {
    const at = Number(sessionStorage.getItem(PENDING_KEY))
    return at > 0 && now - at < GOOGLE_CONFIRM_MAX_AGE_MS * 2
  } catch {
    return false
  }
}

export function clearGoogleConfirmation(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* nothing to clear */
  }
}

/**
 * When the current session last signed in with Google, from the `amr` claim
 * Supabase puts in every access token, or null if it never did.
 *
 * Read from the token rather than from a flag this page set: the flag says the
 * person meant to confirm, the token says Google actually signed them in.
 */
export function googleSignInAt(accessToken: string | undefined): number | null {
  if (!accessToken) return null
  try {
    const part = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))) as {
      amr?: { method?: string; timestamp?: number }[]
    }
    const times = (claims.amr ?? [])
      .filter((entry) => entry.method === 'oauth' && typeof entry.timestamp === 'number')
      .map((entry) => (entry.timestamp as number) * 1000)
    return times.length ? Math.max(...times) : null
  } catch {
    return null
  }
}

/** Has this session signed in with Google recently enough to delete? */
export async function recentlyConfirmedWithGoogle(now = Date.now()): Promise<boolean> {
  const { data } = await supabase().auth.getSession()
  const at = googleSignInAt(data.session?.access_token)
  return at !== null && now - at < GOOGLE_CONFIRM_MAX_AGE_MS
}

/**
 * Deletes the account on the server, then this device's copy.
 *
 * Server first on purpose. If the server call fails, nothing has been lost and
 * the person can try again; the other order would leave someone with an empty
 * app and an account that still exists.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { error } = await supabase().rpc('delete_my_account')
  if (error) throw new Error(error.message)

  // The local store is now the only copy of data that no longer exists
  // anywhere, which is exactly what was asked for — drop it.
  try {
    db.close()
  } catch {
    /* already closed */
  }
  try {
    await Dexie.delete(dbNameFor(userId))
  } catch {
    /* the browser may refuse while another tab holds it open; the sign-out
       below still ends the session, and the rows are gone from the server */
  }

  await supabase().auth.signOut()
}
