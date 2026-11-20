export interface ProductNavigationOptions {
  replace?: boolean
  directApp?: boolean
}

/**
 * Navigate between Lingo3 App and Academy without reloading the document.
 *
 * Both products share one Supabase browser session. A full-page App ↔ Academy
 * navigation creates a new JS realm/client while the previous page may still
 * be retained by the browser, which increases the chance of overlapping auth
 * refresh lifecycles. Keep product switches inside this SPA instead.
 */
export function navigateProduct(path: string, options: ProductNavigationOptions = {}) {
  // Keep the explicitly selected public language across Academy navigation.
  if (/^\/academy(?:\/|$)/.test(window.location.pathname) && /^\/academy(?:[/?#]|$)/.test(path)) {
    const target = new URL(path, window.location.origin)
    const lang = new URLSearchParams(window.location.search).get('lang')
    if (lang && ['en', 'fa', 'sv', 'de'].includes(lang) && !target.searchParams.has('lang')) {
      target.searchParams.set('lang', lang)
      path = target.pathname + target.search + target.hash
    }
  }
  const {lingo3Tab:_oldTab,academySettings:_oldSettings,academyDialog:_oldDialog,...previousState}=window.history.state??{}
  const state = {
    ...previousState,
    lingo3ProductNavigation: true,
    lingo3DirectApp: Boolean(options.directApp),
    ...(!options.replace && /^\/academy(?:\/|$)/.test(window.location.pathname) && /^\/academy(?:[/?#]|$)/.test(path) ? {academyPreviousPath: window.location.pathname + window.location.search} : {}),
  }
  if (options.replace) window.history.replaceState(state, '', path)
  else window.history.pushState(state, '', path)

  window.dispatchEvent(new PopStateEvent('popstate', { state }))
}
