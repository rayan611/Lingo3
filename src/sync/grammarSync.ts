import type { Table } from 'dexie'
import { db, dbNameFor, newId, type Lingo3DB } from '../db/db'
import { supabase } from '../auth/supabase'
import type { GrammarRule, GrammarSection } from '../db/grammar'

export type GrammarItem = GrammarRule | GrammarSection
export type GrammarRow = { id: string; user_id: string; version: number | string; payload: GrammarItem }
export type GrammarTable = 'grammar_sections' | 'grammar_rules'
export type GrammarSyncStatus = { state: 'synced' | 'error'; at: number; conflicts: number; message?: string }
export interface GrammarTransport {
  read(name: GrammarTable): Promise<GrammarRow[]>
  write(name: GrammarTable, item: GrammarItem, version: number | string): Promise<{ applied: boolean; row: GrammarRow }>
}

/** Stable JSON keeps Dexie-only bookkeeping out of the server's user content. */
export function grammarPayload(item: GrammarItem): GrammarItem {
  const { cloudVersion: _version, cloudSnapshot: _snapshot, ...payload } = item
  return JSON.parse(JSON.stringify(payload)) as GrammarItem
}
function snapshot(item: GrammarItem): string {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value
  return JSON.stringify(stable(grammarPayload(item)))
}
const dirty = (item: GrammarItem) => snapshot(item) !== item.cloudSnapshot

/** Capture the database handle: an account switch must never redirect in-flight writes. */
export async function reconcileGrammar(
  database: Lingo3DB, transport: GrammarTransport, active: () => void = () => {},
): Promise<number> {
  let conflicts = 0
  for (const [name, table] of [
    ['grammar_sections', database.grammarSections], ['grammar_rules', database.grammarRules],
  ] as [GrammarTable, Table<GrammarItem, string>][]) {
    active()
    const remote = await transport.read(name)
    const byId = new Map(remote.map(row => [row.id, row]))
    const local = await table.toArray()
    const ids = new Set([...byId.keys(), ...local.map(item => item.id)])
    for (const id of ids) {
      active()
      const item = await table.get(id)
      let row = byId.get(id)
      let submitted: GrammarItem | undefined
      let conflict = false
      if (item && dirty(item)) {
        submitted = grammarPayload(item)
        const result = await transport.write(name, submitted, item.cloudVersion ?? 0)
        row = result.row
        conflict = !result.applied && snapshot(submitted) !== snapshot(row.payload)
      }
      if (!row) continue
      active()
      const received = { ...row.payload, cloudVersion: row.version, cloudSnapshot: snapshot(row.payload) }
      await database.transaction('rw', table, async () => {
        const current = await table.get(id)
        // Edits made during a request stay dirty and are retried against the new version.
        if (!conflict && current && submitted && snapshot(current) !== snapshot(submitted)) {
          await table.put({ ...current, cloudVersion: row!.version, cloudSnapshot: snapshot(row!.payload) })
          return
        }
        if (current && !submitted && dirty(current)) return
        if (conflict && current) {
          // Preserve both versions, including edit-v-delete. A conflict copy is visible,
          // editable and uploaded on the next pass; it never resurrects the original ID.
          const copy: GrammarItem = {
            ...grammarPayload(current), id: newId(), title: `${current.title} (conflict copy${current.deletedAt ? ' — deletion requested' : ''})`,
            deletedAt: undefined, createdAt: Date.now(), updatedAt: Date.now(),
          }
          await table.put(copy)
          conflicts++
        }
        if (!current || snapshot(current) !== snapshot(received) || current.cloudVersion !== row!.version || !current.cloudSnapshot) {
          await table.put(received)
        }
      })
    }
  }
  return conflicts
}

export async function syncGrammar(userId: string, signal?: AbortSignal): Promise<GrammarSyncStatus> {
  const database = db
  const active = () => {
    if (signal?.aborted || db !== database || database.name !== dbNameFor(userId)) throw new Error('Grammar sync cancelled: account changed or request timed out')
  }
  try {
    active()
    const client = supabase()
    const { data: session } = await client.auth.getSession()
    if (session.session?.user.id !== userId) throw new Error('Sign in again to sync grammar')
    // updated_at is an opaque revision token, never a winner chosen by device time.
    // A conditional UPDATE is atomic in Postgres and works with the existing schema.
    const transport: GrammarTransport = {
      async read(name) {
        const rows: GrammarRow[] = []
        for (let offset = 0; ; offset += 500) {
          active()
          let query = client.from(name).select('id,user_id,updated_at,payload').eq('user_id', userId).order('id').range(offset, offset + 499)
          if (signal) query = query.abortSignal(signal)
          const { data, error } = await query
          if (error) throw new Error(`Grammar download: ${error.message}`)
          const batch = (data ?? []).map(row => ({ ...row, version: row.updated_at })) as GrammarRow[]
          rows.push(...batch)
          if (batch.length < 500) return rows
        }
      },
      async write(name, item, version) {
        active()
        const previous = typeof version === 'string' ? Date.parse(version) : 0
        // Ensure this token differs from the previous token even with equal/skewed clocks.
        const updatedAt = new Date(Math.max(Date.now(), previous + 1)).toISOString()
        const values = { id: item.id, user_id: userId, updated_at: updatedAt,
          deleted_at: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
          payload: grammarPayload(item) }
        let query = (version === 0
          ? client.from(name).insert(values)
          : client.from(name).update(values).eq('id', item.id).eq('user_id', userId).eq('updated_at', String(version)))
          .select('id,user_id,updated_at,payload')
        if (signal) query = query.abortSignal(signal)
        const { data, error } = await query
        if (error && error.code !== '23505') throw new Error(`Grammar upload: ${error.message}`)
        if (data?.[0]) return { applied: true, row: { ...data[0], version: data[0].updated_at } as GrammarRow }
        // A stale UPDATE or duplicate INSERT cannot overwrite the winner.
        let currentQuery = client.from(name).select('id,user_id,updated_at,payload').eq('id', item.id).eq('user_id', userId)
        if (signal) currentQuery = currentQuery.abortSignal(signal)
        const { data: current, error: readError } = await currentQuery.single()
        if (readError || !current) throw new Error(`Grammar conflict reload: ${readError?.message ?? 'item missing'}`)
        return { applied: false, row: { ...current, version: current.updated_at } as GrammarRow }
      },
    }
    const conflicts = await reconcileGrammar(database, transport, active)
    const status: GrammarSyncStatus = { state: 'synced', at: Date.now(), conflicts }
    active()
    await database.meta.put({ key: 'grammar.syncStatus', value: JSON.stringify(status) })
    return status
  } catch (error) {
    const status: GrammarSyncStatus = { state: 'error', at: Date.now(), conflicts: 0, message: error instanceof Error ? error.message : String(error) }
    if (db === database && !signal?.aborted) await database.meta.put({ key: 'grammar.syncStatus', value: JSON.stringify(status) })
    return status
  }
}
