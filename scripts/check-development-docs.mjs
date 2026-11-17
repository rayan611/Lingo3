import fs from 'node:fs'

const required = [
  'AGENTS.md',
  'docs/AI_CONTEXT.md',
  'docs/ACADEMY_ROADMAP.md',
  'docs/DEVELOPMENT_HISTORY.md',
  'docs/DEVELOPMENT_HANDOFF.md',
  'docs/SITEMAP.md',
  'docs/ROUTE_INDEX.md',
]

const read = (path) => fs.readFileSync(path, 'utf8')
const failures = []

for (const path of required) {
  if (!fs.existsSync(path)) failures.push(`missing required development-memory file: ${path}`)
  else if (!read(path).trim()) failures.push(`empty development-memory file: ${path}`)
}

if (fs.existsSync('AGENTS.md')) {
  const agents = read('AGENTS.md')
  for (const path of ['docs/AI_CONTEXT.md', 'docs/DEVELOPMENT_HANDOFF.md']) {
    if (!agents.includes(path)) failures.push(`AGENTS.md must instruct agents to read ${path}`)
  }
  for (const path of ['docs/ACADEMY_ROADMAP.md', 'docs/DEVELOPMENT_HISTORY.md']) {
    if (!agents.includes(path)) failures.push(`AGENTS.md must reference ${path}`)
  }
}

if (fs.existsSync('docs/AI_CONTEXT.md')) {
  const context = read('docs/AI_CONTEXT.md')
  const requiredContext = [
    'Current production baseline',
    'Academy capabilities active now',
    'External/incomplete capabilities',
    'Session close rule',
  ]
  for (const heading of requiredContext) {
    if (!context.includes(heading)) failures.push(`AI_CONTEXT.md missing section: ${heading}`)
  }
}

if (fs.existsSync('docs/ACADEMY_ROADMAP.md')) {
  const roadmap = read('docs/ACADEMY_ROADMAP.md')
  const backlog = [
    'Automatic Microsoft Teams meeting creation',
    'Google / Microsoft Calendar synchronization',
    'Payments',
    'Embedded / hosted video classroom',
    'Binary file upload/storage',
    'Placement / test engine',
    'Realtime collaborative notebook',
    'Real Teacher onboarding and E2E',
  ]
  for (const item of backlog) {
    if (!roadmap.includes(item)) failures.push(`ACADEMY_ROADMAP.md missing backlog item: ${item}`)
  }
}

if (fs.existsSync('docs/DEVELOPMENT_HISTORY.md')) {
  const history = read('docs/DEVELOPMENT_HISTORY.md')
  if (!history.includes('Academy Real Teacher/Student MVP')) {
    failures.push('DEVELOPMENT_HISTORY.md must include the current Academy MVP milestone')
  }
}

if (failures.length) {
  console.error('Development-memory checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Development-memory checks passed.')
