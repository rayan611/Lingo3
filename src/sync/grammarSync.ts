import { db } from '../db/db'
import { supabase } from '../auth/supabase'
import type { GrammarRule, GrammarSection } from '../db/grammar'

/** Independent, optional grammar sync. Existing vocabulary sync is never blocked by rollout. */
type GrammarRow = { id: string; user_id: string; updated_at: string; deleted_at: string | null; payload: GrammarRule | GrammarSection }
const stamp = (value: number) => new Date(value).toISOString()
const rowOf = (item: GrammarRule | GrammarSection, userId: string): GrammarRow => ({
  id: item.id, user_id: userId, updated_at: stamp(item.updatedAt),
  deleted_at: item.deletedAt ? stamp(item.deletedAt) : null, payload: item,
})
const missing = (e: { code?: string; message?: string }) =>
  ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(e.code ?? '') ||
  /schema cache|does not exist|could not find the table/i.test(e.message ?? '')

/** Full reconciliation avoids clock-based pull cursors; a paginated read prevents truncation. */
async function syncTable<T extends GrammarSection | GrammarRule>(
  name: 'grammar_sections' | 'grammar_rules',
  userId: string,
  table: {
    toArray: () => Promise<T[]>
    bulkGet: (ids: string[]) => Promise<(T | undefined)[]>
    bulkPut: (rows: T[]) => Promise<unknown>
  },
): Promise<number> {
  const client = supabase()
  const remote: GrammarRow[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(name).select('id,user_id,updated_at,deleted_at,payload')
      .eq('user_id', userId).order('id').range(offset, offset + 499)
    if (error) {
      if (missing(error)) return 0
      throw new Error(`${name} pull: ${error.message}`)
    }
    const batch = (data ?? []) as GrammarRow[]
    remote.push(...batch)
    if (batch.length < 500) break
  }
  const local = await table.toArray()
  const remoteById = new Map(remote.map(r => [r.id, r]))
  const localById = new Map(local.map(r => [r.id, r]))
  const incoming = remote.filter(r => {
    const existing = localById.get(r.id)
    return !existing || Number(r.payload.updatedAt) > existing.updatedAt
  }).map(r => r.payload as T)
  if (incoming.length) await table.bulkPut(incoming)
  const outgoing = local.filter(r => {
    const existing = remoteById.get(r.id)
    return !existing || r.updatedAt > Number(existing.payload.updatedAt)
  })
  // Server-side upsert is still LWW at client level; concurrent edits can race.
  for (let i = 0; i < outgoing.length; i += 100) {
    const rows = outgoing.slice(i, i + 100).map(r => rowOf(r, userId))
    const { error } = await client.from(name).upsert(rows)
    if (error) {
      if (missing(error)) return incoming.length
      throw new Error(`${name} push: ${error.message}`)
    }
  }
  return incoming.length + outgoing.length
}

export async function syncGrammar(userId: string): Promise<number> {
  const sections = await syncTable<GrammarSection>('grammar_sections', userId, db.grammarSections)
  const rules = await syncTable<GrammarRule>('grammar_rules', userId, db.grammarRules)
  return sections + rules
}
