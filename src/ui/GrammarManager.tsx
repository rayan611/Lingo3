import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addGrammarSection, addGrammarRule, updateGrammarRule, deleteGrammarRule } from '../db/grammar'
import type { GrammarSyncStatus } from '../sync/grammarSync'
import { LANG_NAMES, type Lang } from '../db/types'

/** Offline-first notebook with visible, independently reported cloud status. */
export function GrammarManager({ lang: initialLang, userId, syncing, onSync, syncError }: { lang: Lang; userId: string | null; syncing: boolean; onSync: () => Promise<void>; syncError?: string }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [editingId, setEditingId] = useState<string | null>(null)
  useEffect(() => { setSectionId(''); setEditingId(null); setTitle(''); setExplanation('') }, [lang])
  const syncRow = useLiveQuery(() => db.meta.get('grammar.syncStatus'), [])
  const status = typeof syncRow?.value === 'string' ? JSON.parse(syncRow.value) as GrammarSyncStatus : null
  const [title, setTitle] = useState('')
  const [explanation, setExplanation] = useState('')
  const [sectionTitle, setSectionTitle] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const sections = useLiveQuery(() => db.grammarSections.where('lang').equals(lang).filter(s => !s.deletedAt).toArray(), [lang]) ?? []
  const rules = useLiveQuery(() => db.grammarRules.where('lang').equals(lang).filter(r => !r.deletedAt).toArray(), [lang]) ?? []
  const submitSection = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const section = await addGrammarSection(lang, sectionTitle)
      setSectionId(section.id)
      setSectionTitle('')
      setError('')
    } catch (err) { setError(String(err)) }
  }
  const submitRule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) await updateGrammarRule(editingId, { title, explanation })
      else await addGrammarRule(lang, sectionId, title, explanation)
      setEditingId(null)
      setTitle('')
      setExplanation('')
      setError('')
    } catch (err) { setError(String(err)) }
  }
  return <section style={{ maxWidth: 780, margin: 'auto', padding: 16 }}>
    <h2>Grammar Manager — {LANG_NAMES[lang]}</h2>
    <label>Language <select value={lang} onChange={event => setLang(event.target.value as Lang)}>{Object.entries(LANG_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
    <p>Changes are saved on this device and sync to your account when online.</p>
    <p role="status">{!userId ? 'Sign in to sync grammar across devices.' : syncing ? 'Syncing…' : syncError ? `Sync failed: ${syncError}. Your local notes are saved.` : status?.state === 'error' ? `Grammar sync failed: ${status.message}. Your local notes are saved.` : status?.state === 'synced' ? `Last grammar sync: ${new Date(status.at).toLocaleString()}` : 'Grammar has not synced yet.'}</p>
    {status && status.conflicts > 0 && <p role="alert">Conflicting edits were kept as separate conflict copies. Review both versions below.</p>}
    {userId && <button type="button" disabled={syncing} onClick={() => void onSync()}>Sync now</button>}
    {error && <p role="alert">{error}</p>}
    <form onSubmit={submitSection}>
      <label>New section <input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} required maxLength={120} /></label>
      <button type="submit">Add section</button>
    </form>
    <form onSubmit={submitRule}>
      <h3>{editingId ? 'Edit grammar rule' : 'Add grammar rule'}</h3>
      <label>Section <select required disabled={Boolean(editingId)} value={sectionId} onChange={e => setSectionId(e.target.value)}>
        <option value="">Choose a section</option>
        {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select></label>
      <label>Title <input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Explanation <textarea required value={explanation} onChange={e => setExplanation(e.target.value)} /></label>
      <button type="submit">Save rule</button>
      {editingId && <button type="button" onClick={() => { setEditingId(null); setTitle(''); setExplanation('') }}>Cancel edit</button>}
    </form>
    <h3>My rules</h3>
    <label>Search <input value={search} onChange={e => setSearch(e.target.value)} /></label>
    {rules.filter(r => (r.title + ' ' + r.explanation).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(r =>
      <article key={r.id} style={{ borderBottom: '1px solid', padding: '12px 0' }}>
        <strong>{r.title}</strong>
        <p>{r.explanation}</p>
        <button type="button" onClick={() => { setEditingId(r.id); setSectionId(r.sectionId); setTitle(r.title); setExplanation(r.explanation) }}>Edit</button>
        <button type="button" onClick={() => { void deleteGrammarRule(r.id).catch(err => setError(String(err))) }}>Delete</button>
      </article>)}
  </section>
}
