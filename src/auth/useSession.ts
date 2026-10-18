import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authConfigured, supabase } from './supabase'

/**
 * Did this page load from a password-reset link?
 *
 * Read at module load, which is BEFORE anything calls `supabase()` and so
 * before the client is constructed — `detectSessionInUrl` consumes the hash
 * and strips it, and by the time a React effect runs there is nothing left to
 * read. The auth event below is the main signal; this is the one that
 * survives a slow mount.
 */
const ARRIVED_FROM_RESET_LINK =
  typeof window !== 'undefined' &&
  /(^|[#&?])type=recovery([&]|$)/.test(
    window.location.hash + window.location.search,
  )

/**
 * The failure Supabase reports in the URL when a link is no longer good.
 *
 * An expired or already-used reset link does not sign you in, so without this
 * the person lands on the sign-in form with no session, no explanation and no
 * idea the link was the problem — they just try the password they have
 * forgotten again. Read at module load for the same reason as the flag above,
 * and handed out once so a reload does not keep repeating it.
 */
let linkError: string | null = (() => {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(
    (window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash) || window.location.search.slice(1),
  )
  if (!p.get('error') && !p.get('error_code')) return null
  const code = p.get('error_code') ?? ''
  if (code.includes('expired') || code === 'otp_expired') {
    return 'That link has expired. Reset links are good for one hour — ask for a new one.'
  }
  return (
    p.get('error_description')?.replace(/\+/g, ' ') ??
    'That link could not be used. Ask for a new one.'
  )
})()

/** Returns the link failure once, then forgets it. */
export function consumeAuthLinkError(): string | null {
  const e = linkError
  linkError = null
  return e
}

export interface SessionState {
  /** null = signed out, undefined = still checking */
  session: Session | null | undefined
  userId: string | null
  email: string | null
  /**
   * The person followed a reset link and has not set a new password yet.
   *
   * A recovery link signs you in, which is the part that makes this easy to
   * get wrong: without this flag the app simply opens, the reset screen is
   * never shown, and the link has done nothing the person asked it to.
   */
  recovery: boolean
  /** Called once a new password is set, or if they decide not to. */
  endRecovery: () => void
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null | undefined>(
    authConfigured ? undefined : null,
  )
  const [recovery, setRecovery] = useState(
    authConfigured && ARRIVED_FROM_RESET_LINK,
  )

  useEffect(() => {
    if (!authConfigured) return
    let cancelled = false

    // getSession reads from storage first, so this resolves offline too.
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session)
      })
      .catch(() => {
        if (!cancelled) setSession(null)
      })

    const { data: sub } = supabase().auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      // Signing out ends a half-finished reset, or the screen would be
      // waiting for a password on an account nobody is signed into.
      if (event === 'SIGNED_OUT') setRecovery(false)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    recovery: recovery && Boolean(session),
    endRecovery: () => setRecovery(false),
  }
}

/**
 * Send a reset link.
 *
 * Deliberately says nothing about whether the address has an account, and
 * neither does Supabase, which returns success either way: an endpoint that
 * answers "no such user" is a way to find out who has an account here.
 *
 * `redirectTo` is where the link lands. It has to be on the Supabase Auth
 * allowlist or the link silently falls back to the Site URL.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  })
  if (error) throw new Error(friendly(error.message))
}

/** Set a new password for whoever the current session belongs to. */
export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password })
  if (error) throw new Error(friendly(error.message))
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw new Error(friendly(error.message))
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({ email, password })
  if (error) throw new Error(friendly(error.message))
  // When email confirmation is on, no session comes back and the person has to
  // click a link first. Saying so beats a form that silently does nothing.
  return { needsConfirmation: !data.session }
}

/**
 * Hand off to Google and come back signed in.
 *
 * `redirectTo` must be on the Supabase Auth allowlist or the trip back lands
 * on the Site URL instead. There is no password to create and nothing to
 * confirm, so the only failure worth reporting is not reaching Supabase at
 * all — everything after the redirect is handled by `detectSessionInUrl`,
 * which is what `onAuthStateChange` is already listening for.
 */
export async function signInWithGoogle() {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  })
  if (error) throw new Error(friendly(error.message))
}

export async function signOut() {
  await supabase().auth.signOut()
}

function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Wrong email or password.'
  if (m.includes('already registered')) return 'That email already has an account — sign in instead.'
  if (m.includes('password should be')) return 'Password must be at least 6 characters.'
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Could not reach the server. Check your connection.'
  }
  if (m.includes('should be different')) {
    return 'That is the password you already have — choose a different one.'
  }
  if (m.includes('auth session missing') || m.includes('session_not_found')) {
    return 'This reset link has expired. Ask for a new one and use it within the hour.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts just now. Wait a minute and try again.'
  }
  return message
}
