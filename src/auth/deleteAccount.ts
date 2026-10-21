import Dexie from 'dexie'
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
