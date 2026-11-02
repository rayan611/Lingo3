import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addGrammarSection, addGrammarRule, deleteGrammarRule } from '../db/grammar'
import { LANG_NAMES, type Lang } from '../db/types'

/** Offline-first personal grammar notebook. Cloud sync is not yet enabled. */
export function GrammarManager({ lang }: { lang: Lang }) {
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
      await addGrammarRule(lang, sectionId, title, explanation)
      setTitle('')
      setExplanation('')
      setError('')
    } catch (err) { setError(String(err)) }
  }
  return <section style={{ maxWidth: 780, margin: 'auto', padding: 16 }}>
    <h2>Grammar Manager — {LANG_NAMES[lang]}</h2>
    <p>Personal grammar notebook. Changes are saved on this device; cloud sync is not yet available.</p>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={submitSection}>
      <label>New section <input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} required maxLength={120} /></label>
      <button type="submit">Add section</button>
    </form>
    <form onSubmit={submitRule}>
      <h3>Add grammar rule</h3>
      <label>Section <select required value={sectionId} onChange={e => setSectionId(e.target.value)}>
        <option value="">Choose a section</option>
        {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select></label>
      <label>Title <input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Explanation <textarea required value={explanation} onChange={e => setExplanation(e.target.value)} /></label>
      <button type="submit">Save rule</button>
    </form>
    <h3>My rules</h3>
    <label>Search <input value={search} onChange={e => setSearch(e.target.value)} /></label>
    {rules.filter(r => (r.title + ' ' + r.explanation).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(r =>
      <article key={r.id} style={{ borderBottom: '1px solid', padding: '12px 0' }}>
        <strong>{r.title}</strong>
        <p>{r.explanation}</p>
        <button type="button" onClick={() => void deleteGrammarRule(r.id)}>Delete</button>
      </article>)}
  </section>
}
