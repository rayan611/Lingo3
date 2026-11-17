import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const app = read('src/App.tsx')
const session = read('src/auth/useSession.ts')
const academy = read('src/academy/Academy.tsx')
const landing = read('src/ui/Landing.tsx')
const signIn = read('src/auth/SignIn.tsx')
const showcase = read('public/showcase.js')
const showcaseHtml = read('public/showcase.html')
const nav = read('src/lib/productNavigation.ts')

const checks = [
  ['App owns exactly one useSession call', (app.match(/useSession\(\)/g) || []).length === 1],
  ['Session hook does not race getSession with INITIAL_SESSION', !session.includes('.auth.getSession()')],
  ['Auth callback stays synchronous', session.includes('onAuthStateChange((event, next) => {') && !session.includes('onAuthStateChange(async')],
  ['App and Academy receive the same SessionState', app.includes('sessionState={sessionState}') && app.includes('<LingoApp sessionState={sessionState} />')],
  ['Product navigation uses history without document reload', nav.includes('history.pushState') && nav.includes("dispatchEvent(new PopStateEvent('popstate'") && !nav.includes('location.href')],
  ['App Home exposes Academy entry', app.includes('className="academy-entry-card"') && app.includes("navigateProduct('/academy')")],
  ['Academy menu exposes App entry via SPA navigation', academy.includes("navigateProduct('/',{directApp:true})")],
  ['Academy login back closes modal without reload', academy.includes('onBack={()=>setLoginOpen(false)}') && signIn.includes('onBack?: () => void')],
  ['Google OAuth uses root callback and remembers Academy return', session.includes("OAUTH_RETURN_PATH_KEY = 'lingo3.oauthReturnPath'") && session.includes("options: { redirectTo: \`\${window.location.origin}/\` }") && session.includes("saved.path === '/academy'")],
  ['Shared session restores Academy after OAuth', app.includes('consumeOAuthReturnPath()') && app.includes('if (returnPath) navigateProduct(returnPath)')],
  ['Welcome Academy entry uses SPA navigation', landing.includes("navigateProduct('/academy')")],
  ['Embedded showcase Academy entry posts to parent', showcase.includes('showcase-academy') && landing.includes("event.data?.type === 'showcase-academy'")],
  ['Embedded showcase App entry posts to parent', showcase.includes('showcase-open') && showcaseHtml.includes('data-showcase-app')],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
if (failed.length) process.exit(1)
console.log(`Auth/product navigation checks passed: ${checks.length}/${checks.length}`)
