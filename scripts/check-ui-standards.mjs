// Enforces the machine-checkable parts of docs/UI_STANDARDS.md.
// The CSS file carries historical debt (hex colours, !important, odd breakpoints, repeated selectors).
// Those numbers are FROZEN as ceilings below: they may go down, never up. When you remove debt, lower the
// ceiling in the same change so the gain cannot be lost again.
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync('src/academy/academy.css', 'utf8')
const failures = []
const expect = (ok, message) => {
  if (!ok) failures.push(message)
}

// --- ceilings (current values on 2026-11-25, v0.7.27) -------------------------------------------------
const CEILING = {
  hexColourUses: 296,
  importantUses: 74,
  oddBreakpointBlocks: 9, // max-width blocks other than 650 / 860 / 1100
  navIsOpenBlocks: 6, // should trend to 1
}

const hexUses = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length
const important = (css.match(/!important/g) || []).length
const breakpoints = [...css.matchAll(/@media \(max-width: (\d+)px\)/g)].map(m => m[1])
const odd = breakpoints.filter(b => !['650', '860', '1100'].includes(b)).length
const navOpen = (css.match(/\.academy-nav\.is-open\s*\{/g) || []).length

expect(hexUses <= CEILING.hexColourUses, `Hex colour uses rose to ${hexUses} (ceiling ${CEILING.hexColourUses}). Use var(--ac-*) tokens.`)
expect(important <= CEILING.importantUses, `!important rose to ${important} (ceiling ${CEILING.importantUses}). Fix the original rule instead.`)
expect(odd <= CEILING.oddBreakpointBlocks, `Non-standard breakpoints rose to ${odd} (ceiling ${CEILING.oddBreakpointBlocks}). Use 650 / 860 / 1100 only.`)
expect(navOpen <= CEILING.navIsOpenBlocks, `.academy-nav.is-open is defined ${navOpen} times (ceiling ${CEILING.navIsOpenBlocks}). Edit the existing rule.`)

// --- tokens exist in light and dark --------------------------------------------------------------------
for (const token of ['--ac-bg', '--ac-surface', '--ac-surface-2', '--ac-border', '--ac-text', '--ac-muted', '--ac-primary', '--ac-primary-text', '--ac-accent', '--ac-success', '--ac-danger', '--ac-radius', '--ac-space', '--ac-touch']) {
  expect(new RegExp(token + ':').test(css), `Design token ${token} is missing from academy.css`)
}
expect(/\.academy\[data-theme='light'\]\s*\{[^}]*--ac-primary/.test(css), 'Light theme must redefine --ac-* tokens')

// --- every new selector is scoped to .academy (the App must not be affected) ----------------------------
// (also enforced with a real CSS parser in check-academy-navigation.mjs; this is a fast text guard)
const unscoped = [...css.matchAll(/(?:^|\n)(\.ac-[A-Za-z0-9_-]+)[^{}\n]*\{/g)].map(m => m[1])
expect(unscoped.length === 0, `Unscoped .ac-* selectors: ${[...new Set(unscoped)].join(', ')}. Prefix with ".academy ".`)

// --- the phone header must not trap fixed children (backdrop-filter on an ancestor of the menu sheet) ---
expect(/@media \(max-width: 860px\) \{\s*\.academy \.academy-top \{[^}]*backdrop-filter: none/.test(css), 'Phone header must set backdrop-filter: none (it would trap the fixed menu sheet).')

// --- every ac-* class used in the components has a CSS rule ---------------------------------------------
const used = new Set()
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (/\.tsx$/.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8')
      for (const m of text.matchAll(/['"` ]((?:ac)-[a-z0-9-]+)\b/g)) used.add(m[1])
    }
  }
}
walk('src/academy')
const dynamicOk = new Set(['ac-chip-btn', 'ac-wizard-steps'])
for (const cls of used) {
  if (dynamicOk.has(cls)) continue
  expect(css.includes('.' + cls), `Class "${cls}" is used in a component but has no rule in academy.css`)
}

// --- forbidden calls ------------------------------------------------------------------------------------
const forbidden = []
const scan = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) scan(p)
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && entry.name !== 'AcademyDialogs.tsx') {
      const text = fs.readFileSync(p, 'utf8')
      if (/window\.(confirm|prompt|alert)\(/.test(text)) forbidden.push(p)
      if (/from ['"]\.\.\/db\/(?!langs['"])/.test(text)) forbidden.push(p + ' (imports the App database; only ../db/langs is allowed)')
    }
  }
}
scan('src/academy')
expect(forbidden.length === 0, `Forbidden calls in: ${forbidden.join(', ')}`)

if (failures.length) {
  console.error('UI standards check failed:')
  for (const f of failures) console.error('- ' + f)
  process.exit(1)
}
console.log(`PASS UI standards: tokens present, hex ${hexUses}/${CEILING.hexColourUses}, !important ${important}/${CEILING.importantUses}, odd breakpoints ${odd}/${CEILING.oddBreakpointBlocks}, nav.is-open ${navOpen}/${CEILING.navIsOpenBlocks}, no browser dialogs, no Dexie in Academy.`)
