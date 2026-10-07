'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// The national curriculum guides the AI lesson planner draws on (one central copy for every school). Guides are loaded with
// scripts/load-curriculum.mjs; here the owner can see them, withdraw or remove one, and test what a topic would pull from them.

type Doc = { id: string; title: string; subject: string; aliases: string[]; grade_from: number; grade_to: number; publisher: string | null; published_year: string | null; pages: number | null; chunk_count: number; status: 'draft' | 'published' }
type Hit = { document_id: string; title: string; page_from: number | null; page_to: number | null; grade: number | null; heading: string | null; content: string; rank: number }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${session?.access_token ?? ''}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || 'Something went wrong.')
  return body as T
}
const grades = (d: Doc) => (d.grade_from === d.grade_to ? `Grade ${d.grade_from}` : `Grades ${d.grade_from} to ${d.grade_to}`)

export default function OwnerCurriculumPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notInstalled, setNotInstalled] = useState(false)
  const [tick, setTick] = useState(0)
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState(8)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await api<{ documents?: Doc[]; notInstalled?: boolean; error?: string }>('/api/owner/curriculum')
        if (cancelled) return
        setNotInstalled(!!res.notInstalled); setDocs(res.documents || []); setError(res.notInstalled ? '' : '')
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load.') }
      finally { if (!cancelled) setLoading(false) }
    }
    run()
    return () => { cancelled = true }
  }, [tick])

  async function toggle(d: Doc) {
    try { await api(`/api/owner/curriculum/${d.id}`, { method: 'PATCH', body: JSON.stringify({ status: d.status === 'published' ? 'draft' : 'published' }) }); setTick((n) => n + 1) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not change it.') }
  }
  async function remove(d: Doc) {
    if (!confirm(`Remove "${d.title}" and all its text? Lesson plans will stop using it. You can load the file again later.`)) return
    try { await api(`/api/owner/curriculum/${d.id}`, { method: 'DELETE' }); setTick((n) => n + 1) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove it.') }
  }
  async function search(e: React.FormEvent) {
    e.preventDefault(); setSearching(true); setError('')
    try { const r = await api<{ results: Hit[] }>(`/api/owner/curriculum/search?subject=${encodeURIComponent(subject)}&grade=${grade}&q=${encodeURIComponent(q)}`); setHits(r.results) }
    catch (err) { setError(err instanceof Error ? err.message : 'The search failed.') }
    setSearching(false)
  }

  if (loading) return <div className="page-container">Loading…</div>
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      <h1 className="portal-page-title">Curriculum guides</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 18px' }}>
        The national curriculum text the AI lesson planner draws on, one copy for every school. A teacher drafting a plan for a subject and grade covered here gets a plan lined up with these guides, with the pages named.
      </p>
      {error && <p role="alert" className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</p>}
      {notInstalled && <p className="banner banner-warning" style={{ marginBottom: 14 }}>The curriculum tables are not set up yet. Run <code>scripts/migrations/central/003_curriculum.sql</code> on the central project.</p>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Loaded guides</h2>
        {docs.length === 0 ? <p style={{ fontSize: 14, margin: 0 }}>No guide is loaded yet.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr>{['Guide', 'Subject', 'Grades', 'Pieces', 'Status', ''].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '4px 6px' }}>{h}</th>)}</tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 6px' }}>{d.title}<div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.pages ? `${d.pages} pages` : ''}{d.published_year ? ` · ${d.published_year}` : ''}</div></td>
                  <td style={{ padding: '8px 6px' }}>{d.subject}</td>
                  <td style={{ padding: '8px 6px' }}>{grades(d)}</td>
                  <td style={{ padding: '8px 6px' }}>{d.chunk_count}</td>
                  <td style={{ padding: '8px 6px' }}><span className={`badge ${d.status === 'published' ? 'badge-success' : 'badge-default'}`}>{d.status === 'published' ? 'In use' : 'Withdrawn'}</span></td>
                  <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => toggle(d)}>{d.status === 'published' ? 'Withdraw' : 'Use again'}</button>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--danger)' }} onClick={() => remove(d)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '12px 0 0' }}>To add a guide, run on your computer: <code>node scripts/load-curriculum.mjs --file guide.pdf --subject &quot;Civics&quot; --grades 7-9 --apply --project &lt;central project&gt;</code> (see docs/curriculum-setup.md).</p>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Test a topic</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>This runs the same search the lesson planner runs, so you can see which parts of the guides a topic pulls in.</p>
        <form onSubmit={search} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div><label htmlFor="cs-subject" style={label}>Subject</label><input id="cs-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="English Language" style={{ marginTop: 4 }} required /></div>
          <div><label htmlFor="cs-grade" style={label}>Grade</label><select id="cs-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))} style={{ marginTop: 4 }}>{[7, 8, 9, 10, 11, 12, 13].map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
          <div style={{ flex: '1 1 260px' }}><label htmlFor="cs-q" style={label}>Topic</label><input id="cs-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="persuasive writing" style={{ marginTop: 4, width: '100%' }} required /></div>
          <button type="submit" className="btn btn-primary" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>
        {hits && (hits.length === 0 ? <p style={{ fontSize: 14, margin: '14px 0 0' }}>Nothing in the loaded guides matches that subject, grade and topic. A lesson plan for it would be drafted without curriculum text.</p> : (
          <ol style={{ margin: '14px 0 0', paddingLeft: 20 }}>
            {hits.map((h, i) => (
              <li key={i} style={{ marginBottom: 12, fontSize: 13.5 }}>
                <strong>{h.title}</strong>{h.page_from ? `, ${h.page_from === h.page_to ? `page ${h.page_from}` : `pages ${h.page_from} to ${h.page_to}`}` : ''}{h.heading ? `, ${h.heading}` : ''} <span style={{ color: 'var(--text-muted)' }}>(match {h.rank.toFixed(2)})</span>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{h.content.replace(/\s+/g, ' ').slice(0, 320)}…</div>
              </li>
            ))}
          </ol>
        ))}
      </div>
    </div>
  )
}
