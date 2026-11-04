import type { Lang } from './langs'
import { db, newId } from './db'

/** User-authored grammar, stored offline first. Curated rules are separate immutable data. */
export interface GrammarCloudState {
  cloudVersion?: number | string
  cloudSnapshot?: string
}

export interface GrammarSection extends GrammarCloudState {
  id: string
  lang: Lang
  title: string
  parentId?: string
  sortOrder: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface GrammarExample {
  id: string
  sentence: string
  translation: string
  translationLang: Lang
}

export interface GrammarRule extends GrammarCloudState {
  id: string
  lang: Lang
  sectionId: string
  title: string
  explanation: string
  examples: GrammarExample[]
  level?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

const required = (s: string, field: string) => {
  const value = s.trim()
  if (!value) throw new Error(`${field} is required`)
  return value
}

export async function addGrammarSection(lang: Lang, title: string, parentId?: string) {
  if (parentId) {
    const parent = await db.grammarSections.get(parentId)
    if (!parent || parent.deletedAt || parent.lang !== lang) throw new Error('Invalid parent section')
  }
  const now = Date.now()
  const section: GrammarSection = {
    id: newId(), lang, title: required(title, 'Title'), parentId,
    sortOrder: now, createdAt: now, updatedAt: now,
  }
  await db.grammarSections.add(section)
  return section
}

/** Empty-only soft deletion avoids hiding rules or child sections. */
export async function renameGrammarSection(id: string, title: string) {
  const database = db
  await database.transaction('rw', database.grammarSections, async () => {
    const section = await database.grammarSections.get(id)
    if (!section || section.deletedAt) throw new Error('Grammar section not found')
    await database.grammarSections.put({ ...section, title: required(title, 'Title'), updatedAt: Date.now() })
  })
}

export async function deleteGrammarSection(id: string) {
  const database = db
  await database.transaction('rw', database.grammarSections, database.grammarRules, async () => {
    const section = await database.grammarSections.get(id)
    if (!section || section.deletedAt) throw new Error('Grammar section not found')
    const rules = await database.grammarRules.where('sectionId').equals(id).filter(r => !r.deletedAt).count()
    const children = await database.grammarSections.filter(s => s.parentId === id && !s.deletedAt).count()
    if (rules || children) throw new Error('Only empty sections can be deleted. Remove their rules and child sections first.')
    await database.grammarSections.put({ ...section, deletedAt: Date.now(), updatedAt: Date.now() })
  })
}

export function validateGrammarExamples(examples: GrammarExample[]): GrammarExample[] {
  return examples.map((example, index) => ({
    ...example,
    sentence: required(example.sentence, `Example ${index + 1} sentence`),
    translation: required(example.translation, `Example ${index + 1} translation`),
  }))
}

export async function addGrammarRule(
  lang: Lang, sectionId: string, title: string, explanation: string,
  examples: Omit<GrammarExample, 'id'>[] = [],
) {
  const database = db
  return database.transaction('rw', database.grammarSections, database.grammarRules, async () => {
    const section = await database.grammarSections.get(sectionId)
    if (!section || section.deletedAt || section.lang !== lang) throw new Error('Invalid grammar section')
    const now = Date.now()
    const rule: GrammarRule = {
      id: newId(), lang, sectionId, title: required(title, 'Title'),
      explanation: required(explanation, 'Explanation'),
      examples: examples.map(e => ({
        id: newId(), sentence: required(e.sentence, 'Example sentence'),
        translation: required(e.translation, 'Example translation'),
        translationLang: e.translationLang,
      })),
      tags: [], createdAt: now, updatedAt: now,
    }
    await database.grammarRules.add(rule)
    return rule
  })
}

export async function updateGrammarRule(id: string, patch: Partial<Pick<GrammarRule, 'title' | 'explanation' | 'examples' | 'level' | 'tags'>>) {
  const database = db
  const current = await database.grammarRules.get(id)
  if (!current || current.deletedAt) throw new Error('Grammar rule not found')
  if (patch.title !== undefined) patch.title = required(patch.title, 'Title')
  if (patch.explanation !== undefined) patch.explanation = required(patch.explanation, 'Explanation')
  if (patch.examples !== undefined) patch.examples = validateGrammarExamples(patch.examples)
  await database.grammarRules.put({ ...current, ...patch, updatedAt: Date.now() })
}

export async function deleteGrammarRule(id: string) {
  const database = db
  const rule = await database.grammarRules.get(id)
  if (rule && !rule.deletedAt) await database.grammarRules.put({ ...rule, deletedAt: Date.now(), updatedAt: Date.now() })
}

export async function listGrammarRules(lang: Lang, query = '') {
  const needle = query.trim().toLocaleLowerCase()
  return db.grammarRules.where('lang').equals(lang).filter(rule =>
    !rule.deletedAt && (!needle ||
      rule.title.toLocaleLowerCase().includes(needle) ||
      rule.explanation.toLocaleLowerCase().includes(needle))
  ).toArray()
}
