import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addGrammarSection, addGrammarRule, updateGrammarRule, deleteGrammarRule, type GrammarExample } from '../db/grammar'
import { supabase } from '../auth/supabase'
import type { GrammarSyncStatus } from '../sync/grammarSync'
import { LANG_NAMES, type Lang } from '../db/types'

/** Lightweight, safe Markdown rendering: no HTML injection or external parser. */
function RichText({ value }: { value: string }) {
  return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{value.split('\n').map((line, index) => {
    const heading = /^(#{1,3})\s+/.exec(line)
    const text = heading ? line.slice(heading[0].length) : line
    const parts = text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
    return <div key={index} style={{ minHeight: '1.35em', fontSize: heading ? heading[1].length === 1 ? '1.35em' : '1.13em' : undefined, fontWeight: heading ? 650 : undefined }}>{parts}</div>
  })}</div>
}

export function GrammarManager({ lang: initialLang, nativeLang, userId, syncing, onSync, syncError }: {
  lang: Lang; nativeLang: Lang; userId: string | null; syncing: boolean; onSync: () => Promise<void>; syncError?: string
}) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [explanation, setExplanation] = useState('')
  const [examples, setExamples] = useState<GrammarExample[]>([])
  const [sectionTitle, setSectionTitle] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const syncRow = useLiveQuery(() => db.meta.get('grammar.syncStatus'), [])
  const status = typeof syncRow?.value === 'string' ? JSON.parse(syncRow.value) as GrammarSyncStatus : null
  const sections = useLiveQuery(() => db.grammarSections.where('lang').equals(lang).filter(s => !s.deletedAt).toArray(), [lang]) ?? []
  const rules = useLiveQuery(() => db.grammarRules.where('lang').equals(lang).filter(r => !r.deletedAt).toArray(), [lang]) ?? []
  const reset = () => { setEditingId(null); setTitle(''); setExplanation(''); setExamples([]); setPreview(false) }
  useEffect(() => { setSectionId(''); setEditingId(null); setTitle(''); setExplanation(''); setExamples([]) }, [lang])

  const wrapSelection = (before: string, after = before) => {
    const input = textarea.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    const selection = explanation.slice(start, end)
    setExplanation(explanation.slice(0, start) + before + selection + after + explanation.slice(end))
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + before.length, end + before.length) })
  }
  const submitSection = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const section = await addGrammarSection(lang, sectionTitle)
      setSectionId(section.id); setSectionTitle(''); setError('')
      if (userId) void onSync().catch(() => {})
    } catch (err) { setError(String(err)) }
  }

  const generateExamples = async (ruleId: string, savedTitle: string, savedExplanation: string, savedLang: Lang) => {
    if (!userId) return
    try {
      const { data } = await supabase().auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const response = await fetch('/api/grammar-examples', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ lang: savedLang, nativeLang, title: savedTitle, explanation: savedExplanation }),
      })
      if (!response.ok) return
      const dataJson: unknown = await response.json()
      const proposed = (dataJson as { examples?: Array<{ sentence: string; translation: string }> }).examples
      if (!Array.isArray(proposed) || proposed.length < 2) return
      const current = await db.grammarRules.get(ruleId)
      // Never overwrite an edit, deletion, or manually authored examples while AI is running.
      if (!current || current.deletedAt || current.title !== savedTitle || current.explanation !== savedExplanation || current.examples?.length) return
      const accepted = proposed.slice(0, 5).filter(e => typeof e.sentence === 'string' && typeof e.translation === 'string' && e.sentence.trim() && e.translation.trim()).map(e => ({
        id: crypto.randomUUID(), sentence: e.sentence.trim(), translation: e.translation.trim(), translationLang: nativeLang,
      }))
      if (accepted.length < 2) return
      await updateGrammarRule(ruleId, { examples: accepted })
      void onSync().catch(() => {})
    } catch {
      // AI is an optional enhancement. Saving a rule must never depend on it.
    }
  }

  const submitRule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const cleanExamples = examples.filter(x => x.sentence.trim() && x.translation.trim())
      if (editingId) await updateGrammarRule(editingId, { title, explanation, examples: cleanExamples })
      else {
        const rule = await addGrammarRule(lang, sectionId, title, explanation, cleanExamples)
        if (!cleanExamples.length) void generateExamples(rule.id, rule.title, rule.explanation, lang)
      }
      reset(); setError('')
      if (userId) void onSync().catch(() => {})
    } catch (err) { setError(String(err)) }
  }

  const sectionName = (id: string) => sections.find(s => s.id === id)?.title ?? 'Uncategorised'
  const matches = rules.filter(r => (r.title + ' ' + r.explanation + ' ' + (r.examples ?? []).map(e => e.sentence).join(' ')).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const fieldStyle: React.CSSProperties = { width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, marginTop: 5 }
  const buttonStyle: React.CSSProperties = { marginRight: 8, marginTop: 8 }

  return <section style={{ maxWidth: 860, margin: 'auto', padding: 16 }}>
    <h2>Grammar Manager</h2>
    <label>Grammar library — language
      <select style={fieldStyle} value={lang} onChange={event => setLang(event.target.value as Lang)}>
        {Object.entries(LANG_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>
    <p className="muted">Each language has its own sections, rules and examples. Your notes are private and saved offline first.</p>
    <p role="status">{!userId ? 'Sign in to sync grammar across devices.' : syncing ? 'Syncing…' : syncError ? `Sync failed: ${syncError}. Local notes are safe.` : status?.state === 'error' ? `Grammar sync failed: ${status.message}` : status?.state === 'synced' ? `Last grammar sync: ${new Date(status.at).toLocaleString()}` : 'Grammar has not synced yet.'}</p>
    {status && status.conflicts > 0 && <p role="alert">Conflicting edits were kept as separate copies.</p>}
    {userId && <button type="button" disabled={syncing} onClick={() => void onSync()}>Sync now</button>}
    {error && <p role="alert">{error}</p>}
    <form onSubmit={submitSection} style={{ margin: '18px 0', padding: 16, border: '1px solid var(--border, #aaa)', borderRadius: 12 }}>
      <h3>Sections in {LANG_NAMES[lang]}</h3>
      <label>New section <input style={fieldStyle} value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} required maxLength={120} placeholder="e.g. Verbs, Sentence structure, Pronouns" /></label>
      <button type="submit" style={buttonStyle}>Add section</button>
    </form>
    <form onSubmit={submitRule} style={{ padding: 16, border: '1px solid var(--border, #aaa)', borderRadius: 12 }}>
      <h3>{editingId ? 'Edit grammar rule' : 'Add grammar rule'}</h3>
      <label>Section
        <select style={fieldStyle} required disabled={Boolean(editingId)} value={sectionId} onChange={e => setSectionId(e.target.value)}>
          <option value="">Choose a section</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </label>
      <label>Title <input style={fieldStyle} required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Explanation</label>
      <div role="toolbar" aria-label="Text formatting" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" onClick={() => wrapSelection('**')} aria-label="Bold selected text"><strong>B</strong></button>
        <button type="button" onClick={() => wrapSelection('## ', '')}>Heading</button>
        <button type="button" onClick={() => wrapSelection('- ', '')}>List</button>
        <button type="button" onClick={() => wrapSelection('\n\n', '')}>Paragraph break</button>
        <button type="button" onClick={() => setPreview(v => !v)}>{preview ? 'Edit text' : 'Preview'}</button>
      </div>
      {preview ? <div style={{ ...fieldStyle, minHeight: 170, border: '1px solid #888' }}><RichText value={explanation} /></div> :
        <textarea ref={textarea} style={{ ...fieldStyle, minHeight: 210, lineHeight: 1.75, fontFamily: 'inherit', fontSize: 16, resize: 'vertical' }} required value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Paste or type your grammar notes. Enter and blank lines are preserved. Select text and press B to make it bold." />}
      <h3>Examples</h3>
      <p className="muted">Examples are saved with the rule. When you save a new rule without examples, AI can add them quietly in the background; you can edit them later.</p>
      {examples.map((example, index) => <div key={example.id} style={{ marginBottom: 12, padding: 10, border: '1px solid var(--border, #aaa)', borderRadius: 8 }}>
        <label>Example {index + 1} ({LANG_NAMES[lang]})
          <textarea style={{ ...fieldStyle, minHeight: 55 }} value={example.sentence} onChange={e => setExamples(old => old.map(x => x.id === example.id ? { ...x, sentence: e.target.value } : x))} />
        </label>
        <label>Translation ({LANG_NAMES[example.translationLang]})
          <textarea style={{ ...fieldStyle, minHeight: 55 }} value={example.translation} onChange={e => setExamples(old => old.map(x => x.id === example.id ? { ...x, translation: e.target.value } : x))} />
        </label>
        <button type="button" onClick={() => setExamples(old => old.filter(x => x.id !== example.id))}>Remove example</button>
      </div>)}
      <button type="button" style={buttonStyle} onClick={() => setExamples(old => [...old, { id: crypto.randomUUID(), sentence: '', translation: '', translationLang: nativeLang }])}>+ Add example</button>
      <div><button type="submit" style={buttonStyle}>{editingId ? 'Save changes' : 'Save rule'}</button>
      {editingId && <button type="button" onClick={reset}>Cancel edit</button>}</div>
    </form>
    <h3>Saved grammar — {LANG_NAMES[lang]}</h3>
    <label>Search <input style={fieldStyle} value={search} onChange={e => setSearch(e.target.value)} /></label>
    {sections.map(section => {
      const group = matches.filter(r => r.sectionId === section.id)
      if (!group.length) return null
      return <section key={section.id} style={{ marginTop: 18 }}>
        <h3>{section.title}</h3>
        {group.map(r => <article key={r.id} style={{ borderBottom: '1px solid var(--border, #aaa)', padding: '12px 0' }}>
          <h4>{r.title}</h4>
          <RichText value={r.explanation} />
          {Boolean(r.examples?.length) && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--surface, rgba(128,128,128,.08))' }}>
            <strong>Examples</strong>
            {(r.examples ?? []).map(e => <div key={e.id} style={{ marginTop: 9 }}><div>{e.sentence}</div><small className="muted">{e.translation}</small></div>)}
          </div>}
          <button type="button" style={buttonStyle} onClick={() => { setEditingId(r.id); setSectionId(r.sectionId); setTitle(r.title); setExplanation(r.explanation); setExamples(r.examples ?? []); setPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button>
          <button type="button" style={buttonStyle} onClick={() => void deleteGrammarRule(r.id).then(() => { if (userId) void onSync().catch(() => {}) }).catch(err => setError(String(err)))}>Delete</button>
        </article>)}
      </section>
    })}
    {matches.filter(r => !sections.some(s => s.id === r.sectionId)).map(r => <p key={r.id}>{r.title} — {sectionName(r.sectionId)}</p>)}
  </section>
}
