import type { GrammarExample } from '../db/grammar'

export interface GrammarDraft {
  editingId: string | null
  title: string
  explanation: string
  examples: GrammarExample[]
  sectionTitle: string
  sectionId: string
}
const memory = new Map<string, GrammarDraft>()
export const emptyGrammarDraft = (): GrammarDraft => ({ editingId: null, title: '', explanation: '', examples: [], sectionTitle: '', sectionId: '' })
export const grammarDraftKey = (userId: string | null, lang: string) => `lingo3.grammarDraft.v1:${userId ?? 'local'}:${lang}`

export function readGrammarDraft(key: string): GrammarDraft {
  if (memory.has(key)) return structuredClone(memory.get(key)!)
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as GrammarDraft | null
    if (value && (value.editingId === null || typeof value.editingId === 'string') &&
      ['title', 'explanation', 'sectionTitle', 'sectionId'].every(field => typeof value[field as keyof GrammarDraft] === 'string') &&
      Array.isArray(value.examples) && value.examples.every(e => e && typeof e.id === 'string' && typeof e.sentence === 'string' && typeof e.translation === 'string' && typeof e.translationLang === 'string')) return value
  } catch { /* In-memory drafts still work if tab storage is unavailable. */ }
  return emptyGrammarDraft()
}

export function writeGrammarDraft(key: string, draft: GrammarDraft) {
  memory.set(key, structuredClone(draft))
  try { sessionStorage.setItem(key, JSON.stringify(draft)) } catch { /* Keep in memory. */ }
}
