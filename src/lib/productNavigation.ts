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
  const {lingo3Tab:_oldTab,academySettings:_oldSettings,academyDialog:_oldDialog,...previousState}=window.history.state??{}
  const state = {
    ...previousState,
    lingo3ProductNavigation: true,
    lingo3DirectApp: Boolean(options.directApp),
  }
  if (options.replace) window.history.replaceState(state, '', path)
  else window.history.pushState(state, '', path)

  window.dispatchEvent(new PopStateEvent('popstate', { state }))
}
