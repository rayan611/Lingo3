import { lazy, type ComponentType } from 'react'

const RELOADED_KEY = 'lingua.chunkReload'

/**
 * React.lazy for a named export, that survives a deploy.
 *
 * A tab opened before a deploy still runs the old build, whose chunk files the
 * new deploy no longer serves; opening a screen then fails to import. One
 * reload picks up the new build. The flag stops a genuinely broken chunk from
 * reloading forever: the second failure is thrown to the error boundary.
 */
export function lazyScreen<M extends Record<K, ComponentType<any>>, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
) {
  return lazy(async (): Promise<{ default: M[K] }> => {
    try {
      const module = await load()
      try {
        sessionStorage.removeItem(RELOADED_KEY)
      } catch {
        /* storage blocked; nothing to clear */
      }
      return { default: module[name] }
    } catch (err) {
      let reloaded = false
      try {
        reloaded = sessionStorage.getItem(RELOADED_KEY) === '1'
        if (!reloaded) sessionStorage.setItem(RELOADED_KEY, '1')
      } catch {
        reloaded = true
      }
      if (!reloaded) {
        window.location.reload()
        // Never settles: the page is going away.
        return new Promise<never>(() => {})
      }
      throw err
    }
  })
}
