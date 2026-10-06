'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopicPicker from '@/components/TopicPicker'
import { loadMyDepartments, loadResources, openResource, removeResource, setPinned, shareFile, shareLink, updateResource, type MyDepartment } from '@/lib/departmentResources'
import { ACCEPT, domainOf, facets, filterResources, formatSize, LIMITS, type Filters, type Resource } from '@/lib/resourcesPure'
import EmptyState from '@/components/EmptyState'

// The department's shared shelf: links and files colleagues add, tagged by subject, grade and topic. The head of department can pin the best ones.
// Students never see this page. What each person may do is decided by the database; the buttons here only mirror it.

const labelStyle = { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' } as const
const sub = { fontSize: 12, color: 'var(--text-secondary)' } as const
const GRADES = [7, 8, 9, 10, 11, 12, 13]

type Draft = { title: string; description: string; url: string; subject: string; grade: string; topic: { id: string } | null }
const emptyDraft = (): Draft => ({ title: '', description: '', url: '', subject: '', grade: '', topic: null })

export default function ResourcesPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [departments, setDepartments] = useState<MyDepartment[]>([])
  const [deptId, setDeptId] = useState('')
  const [items, setItems] = useState<Resource[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState<Filters>({ search: '', subject: '', grade: '', kind: '' })

  const [mode, setMode] = useState<'link' | 'file'>('link')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; kind: 'link' | 'file'; draft: Draft } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!['teacher', 'supervisor', 'admin'].includes(profile?.role as string)) { router.replace('/learning'); return }
      const deps = await loadMyDepartments()
      if (cancelled) return
      if (!deps) { setError('The resource space is not available yet.'); setReady(true); return }
      setDepartments(deps)
      setDeptId(deps[0]?.id ?? '')
      setReady(true)
    }
    start()
    return () => { cancelled = true }
  }, [router])

  const reload = useCallback(async (id: string) => {
    const list = await loadResources(id)
    if (list === null) setError('Could not load the resources. Please try again.')
    setItems(list ?? [])
  }, [])
  useEffect(() => {
    if (!deptId) return
    let cancelled = false
    loadResources(deptId).then((list) => { if (cancelled) return; if (list === null) setError('Could not load the resources. Please try again.'); setItems(list ?? []) })
    return () => { cancelled = true }
  }, [deptId])

  const dept = departments.find((d) => d.id === deptId)
  const shown = useMemo(() => filterResources(items ?? [], filters), [items, filters])
  const f = useMemo(() => facets(items ?? []), [items])

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string): Promise<boolean> {
    setBusy(true); setError(''); setNotice('')
    const r = await fn()
    setBusy(false)
    if (!r.ok) { setError(r.error); return false }
    if (done) setNotice(done)
    await reload(deptId)
    return true
  }

  async function share() {
    const tags = { subject: draft.subject, grade: draft.grade, topic: draft.topic }
    const ok = mode === 'link'
      ? await run(() => shareLink(deptId, { title: draft.title, description: draft.description, url: draft.url, ...tags }), 'Shared with your department.')
      : file ? await run(() => shareFile(deptId, file, { title: draft.title, description: draft.description, ...tags }), 'Shared with your department.') : (setError('Choose a file.'), false)
    if (ok) { setDraft(emptyDraft()); setFile(null); setFileKey((k) => k + 1); setShareOpen(false) }
  }

  async function saveEdit() {
    if (!editing) return
    const d = editing.draft
    const ok = await run(() => updateResource(editing.id, { title: d.title, description: d.description, url: editing.kind === 'link' ? d.url : undefined, subject: d.subject, grade: d.grade, topic: d.topic }), 'Saved.')
    if (ok) setEditing(null)
  }

  async function remove(r: Resource) {
    if (!window.confirm(`Remove "${r.title}" from the shelf? This cannot be undone.`)) return
    await run(() => removeResource(r), 'Removed.')
  }

  if (!ready) return <div className="page-container">Loading…</div>
  const input = { width: '100%', display: 'block', marginTop: 4 } as const

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <h1 className="portal-page-title">Resources</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>A shelf your department shares: worksheets, past papers, slides and useful links. Only teachers in the department can see it. Students cannot.</p>

      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 16 }}>{error}</p>}
      {notice && <p role="status" className="banner banner-success" style={{ marginTop: 16 }}>{notice}</p>}

      {departments.length === 0 && !error && (
        <div style={{ marginTop: 20 }}><EmptyState icon="📚" title="No department yet" description="You are not part of a department, so there is no shared shelf for you. Ask your school admin to add you to one." /></div>
      )}

      {departments.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 18 }}>
            {departments.length > 1 && (
              <div>
                <label htmlFor="res-dept" style={labelStyle}>Department</label>
                <select id="res-dept" value={deptId} onChange={(e) => { setItems(null); setEditing(null); setDeptId(e.target.value) }} style={{ display: 'block', marginTop: 4, minWidth: 200 }}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {departments.length === 1 && <div style={{ fontSize: 15, fontWeight: 700 }}>{dept?.name}</div>}
            <span style={{ flex: 1 }} />
            {dept?.canShare && <button type="button" className="btn btn-primary" onClick={() => setShareOpen((o) => !o)} aria-expanded={shareOpen}>{shareOpen ? 'Close' : 'Share a resource'}</button>}
          </div>

          {shareOpen && dept?.canShare && (
            <section className="card" style={{ marginTop: 16 }} aria-label="Share a resource">
              <h2 style={{ marginBottom: 12, fontSize: 16 }}>Share a resource with {dept.name}</h2>
              <div role="radiogroup" aria-label="What are you sharing?" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['link', 'file'] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setMode(m)}>{m === 'link' ? 'A web link' : 'A file'}</button>
                ))}
              </div>
              <label htmlFor="res-title" style={labelStyle}>Title</label>
              <input id="res-title" value={draft.title} maxLength={LIMITS.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Fractions practice worksheet" style={input} />
              {mode === 'link' ? (
                <div style={{ marginTop: 12 }}>
                  <label htmlFor="res-url" style={labelStyle}>Link (starts with https://)</label>
                  <input id="res-url" type="url" inputMode="url" value={draft.url} maxLength={LIMITS.link} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" style={input} />
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <label htmlFor="res-file" style={labelStyle}>File (PDF, Word, PowerPoint, Excel, CSV, text or a picture, up to {formatSize(LIMITS.fileBytes)})</label>
                  <input key={fileKey} id="res-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: 'block', marginTop: 6 }} />
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <label htmlFor="res-desc" style={labelStyle}>What is it, and when would a colleague use it? (optional)</label>
                <textarea id="res-desc" value={draft.description} rows={2} maxLength={LIMITS.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={input} />
              </div>
              <TagFields draft={draft} setDraft={setDraft} subjects={f.subjects} idPrefix="res" />
              <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="button" className="btn btn-primary" onClick={share} disabled={busy}>{busy ? 'Sharing…' : 'Share'}</button>
                <span style={sub}>It appears for everyone in {dept.name} straight away.</span>
              </div>
            </section>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <input aria-label="Search the shelf" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search titles, subjects, topics, people…" style={{ flex: '2 1 220px' }} />
            <select aria-label="Filter by subject" value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })} style={{ flex: '1 1 150px' }}>
              <option value="">All subjects</option>
              {f.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Filter by grade" value={filters.grade} onChange={(e) => setFilters({ ...filters, grade: e.target.value })} style={{ flex: '1 1 110px' }}>
              <option value="">All grades</option>
              {f.grades.map((g) => <option key={g} value={String(g)}>Grade {g}</option>)}
            </select>
            <select aria-label="Filter by type" value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value as Filters['kind'] })} style={{ flex: '1 1 110px' }}>
              <option value="">Links and files</option>
              <option value="link">Links</option>
              <option value="file">Files</option>
            </select>
          </div>

          {items === null && <p style={{ ...sub, marginTop: 18 }}>Loading…</p>}
          {items !== null && items.length === 0 && (
            <div style={{ marginTop: 20 }}><EmptyState icon="📎" title="Nothing on the shelf yet" description={dept?.canShare ? 'Be the first to share a worksheet, past paper or useful link with your department.' : 'Nothing has been shared in this department yet.'} /></div>
          )}
          {items !== null && items.length > 0 && shown.length === 0 && <p style={{ ...sub, marginTop: 18 }}>Nothing matches those filters.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, marginBottom: 24 }}>
            {shown.map((r) => (
              <article key={r.id} className="card" style={{ padding: 16 }} aria-label={r.title}>
                {editing?.id === r.id ? (
                  <div>
                    <label htmlFor={`e-title-${r.id}`} style={labelStyle}>Title</label>
                    <input id={`e-title-${r.id}`} value={editing.draft.title} maxLength={LIMITS.title} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })} style={input} />
                    {r.kind === 'link' && (<div style={{ marginTop: 10 }}><label htmlFor={`e-url-${r.id}`} style={labelStyle}>Link</label><input id={`e-url-${r.id}`} value={editing.draft.url} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, url: e.target.value } })} style={input} /></div>)}
                    <div style={{ marginTop: 10 }}><label htmlFor={`e-desc-${r.id}`} style={labelStyle}>Description</label><textarea id={`e-desc-${r.id}`} rows={2} value={editing.draft.description} maxLength={LIMITS.description} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })} style={input} /></div>
                    <TagFields draft={editing.draft} setDraft={(d) => setEditing({ ...editing, draft: d })} subjects={f.subjects} idPrefix={`e-${r.id}`} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy}>Save</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {r.pinned && <span className="badge badge-warning"><i className="ti ti-bookmark" aria-hidden="true" /> Pinned by the head</span>}
                          <span style={{ fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>{r.title}</span>
                        </div>
                        <div style={{ ...sub, marginTop: 4 }}>
                          <i className={`ti ${r.kind === 'link' ? 'ti-external-link' : 'ti-file-text'}`} aria-hidden="true" />{' '}
                          {r.kind === 'link' ? domainOf(r.url ?? '') : `${r.fileName ?? 'File'}${r.fileSize ? ` · ${formatSize(r.fileSize)}` : ''}`}
                          {' · '}Shared by {r.mine ? 'you' : r.sharedBy} on {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => run(() => openResource(r))} disabled={busy}>{r.kind === 'link' ? 'Open link' : 'Open file'}</button>
                    </div>
                    {r.description && <p style={{ margin: '10px 0 0', fontSize: 14, overflowWrap: 'anywhere' }}>{r.description}</p>}
                    {(r.subject || r.grade || r.topicName) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {r.subject && <span className="badge badge-default">{r.subject}</span>}
                        {r.grade && <span className="badge badge-default">Grade {r.grade}</span>}
                        {r.topicName && <span className="badge badge-default">{r.topicName}</span>}
                      </div>
                    )}
                    {(r.canPin || r.canEdit || r.canRemove) && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        {r.canPin && <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={() => run(() => setPinned(r.id, !r.pinned), r.pinned ? 'Unpinned.' : 'Pinned to the top.')}>{r.pinned ? 'Unpin' : 'Pin to the top'}</button>}
                        {r.canEdit && <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={() => setEditing({ id: r.id, kind: r.kind, draft: { title: r.title, description: r.description, url: r.url ?? '', subject: r.subject ?? '', grade: r.grade ? String(r.grade) : '', topic: r.topicId ? { id: r.topicId } : null } })}>Edit</button>}
                        {r.canRemove && <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }} disabled={busy} onClick={() => remove(r)}>Remove</button>}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Subject, grade and topic. The topic list needs both a subject and a grade, so it is offered once they are chosen.
function TagFields({ draft, setDraft, subjects, idPrefix }: { draft: Draft; setDraft: (d: Draft) => void; subjects: string[]; idPrefix: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 200px' }}>
          <label htmlFor={`${idPrefix}-subject`} style={labelStyle}>Subject (optional)</label>
          <input id={`${idPrefix}-subject`} list={`${idPrefix}-subjects`} value={draft.subject} maxLength={LIMITS.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value, topic: null })} placeholder="e.g. Mathematics" style={{ width: '100%', display: 'block', marginTop: 4 }} />
          <datalist id={`${idPrefix}-subjects`}>{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label htmlFor={`${idPrefix}-grade`} style={labelStyle}>Grade (optional)</label>
          <select id={`${idPrefix}-grade`} value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value, topic: null })} style={{ width: '100%', display: 'block', marginTop: 4 }}>
            <option value="">Any grade</option>
            {GRADES.map((g) => <option key={g} value={String(g)}>Grade {g}</option>)}
          </select>
        </div>
      </div>
      {draft.subject.trim() && draft.grade && (
        <div style={{ marginTop: 10 }}>
          <TopicPicker subject={draft.subject.trim()} grade={Number(draft.grade)} value={draft.topic?.id ?? null} onChange={(t) => setDraft({ ...draft, topic: t ? { id: t.id } : null })} label="Topic (optional)" />
        </div>
      )}
    </div>
  )
}
