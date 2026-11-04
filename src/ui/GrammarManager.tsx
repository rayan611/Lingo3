import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addGrammarSection, addGrammarRule, updateGrammarRule, deleteGrammarRule, renameGrammarSection, deleteGrammarSection, validateGrammarExamples, type GrammarExample } from '../db/grammar'
import { supabase } from '../auth/supabase'
import type { GrammarSyncStatus } from '../sync/grammarSync'
import { LANG_NAMES, type Lang } from '../db/types'
import { grammarDraftKey, readGrammarDraft, writeGrammarDraft } from './grammarDraft'

/** Lightweight, safe Markdown rendering: no HTML injection or external parser. */
function RichText({ value }: { value: string }) {
  return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{value.split('\n').map((line, index) => {
    const heading = /^(#{1,3})\s+/.exec(line)
    const text = heading ? line.slice(heading[0].length) : line
    const parts = text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
    return <div key={index} style={{ minHeight: '1.35em', fontSize: heading ? heading[1].length === 1 ? '1.35em' : '1.13em' : undefined, fontWeight: heading ? 650 : undefined }}>{parts}</div>
  })}</div>
}

type GrammarManagerProps = {
  lang: Lang; learningLangs: Lang[]; nativeLang: Lang; userId: string | null; syncing: boolean; onSync: () => Promise<void>; syncError?: string
}
export function GrammarManager(props: GrammarManagerProps) {
  const [selectedLang, setLang] = useState(props.lang)
  const availableLangs = [...new Set(props.learningLangs)]
  const lang = availableLangs.includes(selectedLang) ? selectedLang : availableLangs[0] ?? props.lang
  return <section className="grammar-manager">
    <h2>Grammar</h2>
    <label>Grammar library — language
      <select value={lang} onChange={event => setLang(event.target.value as Lang)}>
        {(availableLangs.length ? availableLangs : [lang]).map(code => <option key={code} value={code}>{LANG_NAMES[code]}</option>)}
      </select>
    </label>
    <GrammarEditor key={`${props.userId ?? 'local'}:${lang}`} {...props} lang={lang} />
  </section>
}

function GrammarEditor({ lang, nativeLang, userId, syncing, onSync, syncError }: GrammarManagerProps) {
  const draftKey = grammarDraftKey(userId, lang)
  const [draft] = useState(() => readGrammarDraft(draftKey))
  const [editingId, setEditingId] = useState<string | null>(draft.editingId)
  const [title, setTitle] = useState(draft.title)
  const [explanation, setExplanation] = useState(draft.explanation)
  const [examples, setExamples] = useState<GrammarExample[]>(draft.examples)
  const [sectionTitle, setSectionTitle] = useState(draft.sectionTitle)
  const [sectionId, setSectionId] = useState(draft.sectionId)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    writeGrammarDraft(draftKey, { editingId, title, explanation, examples, sectionTitle, sectionId })
  }, [draftKey, editingId, title, explanation, examples, sectionTitle, sectionId])
  const currentForm = useRef({ editingId, examples })
  currentForm.current = { editingId, examples }
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuccess, setAiSuccess] = useState('')
  const [aiRuleId, setAiRuleId] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const syncRow = useLiveQuery(() => db.meta.get('grammar.syncStatus'), [])
  const status = typeof syncRow?.value === 'string' ? JSON.parse(syncRow.value) as GrammarSyncStatus : null
  const sections = useLiveQuery(() => db.grammarSections.where('lang').equals(lang).filter(s => !s.deletedAt).toArray(), [lang]) ?? []
  const rules = useLiveQuery(() => db.grammarRules.where('lang').equals(lang).filter(r => !r.deletedAt).toArray(), [lang]) ?? []
  const reset = () => { setEditingId(null); setTitle(''); setExplanation(''); setExamples([]); setPreview(false) }


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

  const generateExamples = async (ruleId: string, savedTitle: string, savedExplanation: string, savedLang: Lang, append = false) => {
    if (generating) return
    const initialExamples = JSON.stringify(currentForm.current.examples)
    setGenerating(true); setAiRuleId(ruleId); setAiError(''); setAiSuccess('')
    try {
      const { data } = await supabase().auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Please sign in again to generate AI examples.')
      const response = await fetch('/api/grammar-examples', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ lang: savedLang, nativeLang, title: savedTitle, explanation: savedExplanation }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || `AI request failed (HTTP ${response.status}).`)
      }
      const dataJson: unknown = await response.json()
      const proposed = (dataJson as { examples?: Array<{ sentence: string; translation: string }> }).examples
      if (!Array.isArray(proposed) || proposed.length < 2) throw new Error('AI returned no usable examples. Please retry.')
      if (!mounted.current) return
      const current = await db.grammarRules.get(ruleId)
      // Never overwrite an edit, deletion, or manually authored examples while AI is running.
      if (!current || current.deletedAt) throw new Error('The grammar rule no longer exists.')
      if (current.title !== savedTitle || current.explanation !== savedExplanation) throw new Error('The rule changed while AI was generating. Please retry.')
      if (!append && current.examples?.length) return
      const accepted = proposed.slice(0, 5).filter(e => typeof e.sentence === 'string' && typeof e.translation === 'string' && e.sentence.trim() && e.translation.trim()).map(e => ({
        id: crypto.randomUUID(), sentence: e.sentence.trim(), translation: e.translation.trim(), translationLang: nativeLang,
      }))
      if (accepted.length < 2) throw new Error('AI returned incomplete examples. Please retry.')
      const merged = append ? [...(current.examples ?? []), ...accepted] : accepted
      await updateGrammarRule(ruleId, { examples: merged })
      if (currentForm.current.editingId === ruleId && JSON.stringify(currentForm.current.examples) === initialExamples) setExamples(merged)
      setAiSuccess(`${accepted.length} examples added to ${current.title}.`)
      void onSync().catch(() => {})
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI examples could not be generated. Please retry.')
    } finally { setGenerating(false); setAiRuleId(null) }
  }

  const submitRule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const cleanExamples = validateGrammarExamples(examples)
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

  return <div className="grammar-editor">
    <p className="muted small">Unfinished notes are kept separately for each language in this tab. Save a rule to sync it across devices.</p>
    <p className="muted">Each language has its own sections, rules and examples. Your notes are private and saved offline first.</p>
    <p role="status">{!userId ? 'Sign in to sync grammar across devices.' : syncing ? 'Syncing…' : syncError ? `Sync failed: ${syncError}. Local notes are safe.` : status?.state === 'error' ? `Grammar sync failed: ${status.message}` : status?.state === 'synced' ? `Last grammar sync: ${new Date(status.at).toLocaleString()}` : 'Grammar has not synced yet.'}</p>
    {status && status.conflicts > 0 && <p role="alert">Conflicting edits were kept as separate copies.</p>}
    {userId && <button type="button" disabled={syncing} onClick={() => void onSync()}>Sync now</button>}
    {error && <p role="alert">{error}</p>}
    {aiError && <p role="alert" style={{ color: 'var(--danger)' }}>{aiError}</p>}
    {aiSuccess && <p role="status">{aiSuccess}</p>}
    <form onSubmit={submitSection} style={{ margin: '18px 0', padding: 16, border: '1px solid var(--line)', borderRadius: 12 }}>
      <h3>Sections in {LANG_NAMES[lang]}</h3>
      <label>New section <input style={fieldStyle} value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} required maxLength={120} placeholder="e.g. Verbs, Sentence structure, Pronouns" /></label>
      <button type="submit" style={buttonStyle}>Add section</button>
    </form>
    <form onSubmit={submitRule} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 12 }}>
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
      {preview ? <div style={{ ...fieldStyle, minHeight: 170, border: '1px solid var(--line)' }}><RichText value={explanation} /></div> :
        <textarea ref={textarea} style={{ ...fieldStyle, minHeight: 210, lineHeight: 1.75, fontFamily: 'inherit', fontSize: 'var(--fs-body)', resize: 'vertical' }} required value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Paste or type your grammar notes. Enter and blank lines are preserved. Select text and press B to make it bold." />}
      <h3>Examples</h3>
      <p className="muted">Examples are saved with the rule. When you save a new rule without examples, AI can add them quietly in the background; you can edit them later.</p>
      {examples.map((example, index) => <div key={example.id} style={{ marginBottom: 12, padding: 10, border: '1px solid var(--line)', borderRadius: 8 }}>
        <label>Example {index + 1} ({LANG_NAMES[lang]})
          <textarea style={{ ...fieldStyle, minHeight: 55 }} value={example.sentence} onChange={e => setExamples(old => old.map(x => x.id === example.id ? { ...x, sentence: e.target.value } : x))} />
        </label>
        <label>Translation ({LANG_NAMES[example.translationLang]})
          <textarea style={{ ...fieldStyle, minHeight: 55 }} value={example.translation} onChange={e => setExamples(old => old.map(x => x.id === example.id ? { ...x, translation: e.target.value } : x))} />
        </label>
        <button type="button" onClick={() => setExamples(old => old.filter(x => x.id !== example.id))}>Remove example</button>
      </div>)}
      <button type="button" style={buttonStyle} onClick={() => setExamples(old => [...old, { id: crypto.randomUUID(), sentence: '', translation: '', translationLang: nativeLang }])}>+ Add example</button>
      {editingId && <button type="button" disabled={generating || !userId} onClick={() => { const rule = rules.find(r => r.id === editingId); if (rule) void generateExamples(rule.id, rule.title, rule.explanation, rule.lang, true) }}>{generating && aiRuleId === editingId ? 'Generating…' : 'Generate more with AI'}</button>}
      <div><button type="submit" style={buttonStyle}>{editingId ? 'Save changes' : 'Save rule'}</button>
      {editingId && <button type="button" onClick={reset}>Cancel edit</button>}</div>
    </form>
    <h3>Saved grammar — {LANG_NAMES[lang]}</h3>
    <label>Search <input style={fieldStyle} value={search} onChange={e => setSearch(e.target.value)} /></label>
    {sections.map(section => {
      const group = matches.filter(r => r.sectionId === section.id)
      if (!group.length && search) return null
      return <details key={section.id} open={search ? true : undefined} style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        <summary style={{ cursor: 'pointer', padding: '14px 16px', background: 'var(--panel-soft)', fontWeight: 700 }}>
          {section.title} <small className="muted">({group.length} rules)</small>
        </summary>
        <div style={{ padding: '8px 12px 14px' }}>
          {renamingId === section.id ? <form className="grammar-section-actions" onSubmit={async event => {
            event.preventDefault()
            try { await renameGrammarSection(section.id, renameTitle); setRenamingId(null); if (userId) void onSync().catch(() => {}) }
            catch (err) { setError(String(err)) }
          }}>
            <label>Section name<input required maxLength={120} value={renameTitle} onChange={event => setRenameTitle(event.target.value)} /></label>
            <button type="submit">Save name</button><button type="button" onClick={() => setRenamingId(null)}>Cancel</button>
          </form> : <div className="grammar-section-actions">
            <button type="button" onClick={() => { setRenamingId(section.id); setRenameTitle(section.title) }}>Rename section</button>
            <button type="button" onClick={async () => {
              if (!window.confirm(`Delete the empty section “${section.title}”? Sections containing rules or child sections are protected.`)) return
              try { await deleteGrammarSection(section.id); if (sectionId === section.id) setSectionId(''); if (userId) void onSync().catch(() => {}) }
              catch (err) { setError(String(err)) }
            }}>Delete empty section</button>
          </div>}
          {group.length === 0 && <p className="muted">No grammar rules yet.</p>}
          {group.map(r => <details key={r.id} open={search ? true : undefined} style={{ border: '1px solid var(--line)', borderRadius: 10, marginTop: 9, overflow: 'hidden' }}>
            <summary style={{ cursor: 'pointer', padding: '12px 14px', fontWeight: 600, background: 'var(--panel-soft)' }}>{r.title}</summary>
            <div style={{ padding: 14 }}>
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 12, marginBottom: 12 }}>
                <strong>Explanation</strong>
                <RichText value={r.explanation} />
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 12, marginBottom: 12 }}>
                <strong>Examples</strong>
                {(r.examples ?? []).length ? (r.examples ?? []).map(e => <div key={e.id} style={{ marginTop: 10 }}><div>{e.sentence}</div><small className="muted">{e.translation}</small></div>) : <p className="muted">No examples yet.</p>}
                <div style={{ marginTop: 10 }}>
                  <button type="button" style={buttonStyle} disabled={generating || !userId} onClick={() => void generateExamples(r.id, r.title, r.explanation, r.lang, true)}>{generating && aiRuleId === r.id ? 'Generating…' : 'Generate examples with AI'}</button>
                </div>
              </div>
              <button type="button" style={buttonStyle} onClick={() => { if (editingId === r.id) return; if ((title || explanation || examples.length) && !window.confirm('Replace the current draft with this saved rule?')) return; setEditingId(r.id); setSectionId(r.sectionId); setTitle(r.title); setExplanation(r.explanation); setExamples(r.examples ?? []); setPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit explanation & examples</button>
              <button type="button" style={buttonStyle} onClick={() => void deleteGrammarRule(r.id).then(() => { if (userId) void onSync().catch(() => {}) }).catch(err => setError(String(err)))}>Delete</button>
            </div>
          </details>)}
        </div>
      </details>
    })}
    {matches.filter(r => !sections.some(s => s.id === r.sectionId)).map(r => <p key={r.id}>{r.title} — {sectionName(r.sectionId)}</p>)}
  </div>
}
