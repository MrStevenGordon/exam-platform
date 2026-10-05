'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ALL_LEVELS, LEVEL_LABEL, SHELF_LABEL, bookVisible, libraryErrorText, libraryGet, loadLibrarySettings, normaliseSettings, type LibrarySettings } from '@/lib/library'

type AdminBook = { id: string; title: string; author: string; shelf: 'curriculum' | 'fun'; subject: string | null; levels: string[]; formats: Array<'read' | 'listen'>; hidden: boolean }

function Row({ title, hint, on, onChange, busy }: { title: string; hint: string; on: boolean; onChange: (v: boolean) => void; busy: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }} id={`lbl-${title}`}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{hint}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={`lbl-${title}`} className="lib-switch" disabled={busy} onClick={() => onChange(!on)} />
    </div>
  )
}

export default function LibrarySettingsPage() {
  const [settings, setSettings] = useState<LibrarySettings>(normaliseSettings(null))
  const [installed, setInstalled] = useState(true)
  const [books, setBooks] = useState<AdminBook[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: { user } }, controls] = await Promise.all([supabase.auth.getUser(), loadLibrarySettings()])
        if (cancelled) return
        setUserId(user?.id ?? '')
        setSettings(controls.settings)
        setInstalled(controls.installed)
        const res = await libraryGet<{ books: AdminBook[] }>('/api/library/admin/books')
        if (!cancelled) setBooks(res.books)
      } catch (err) {
        if (!cancelled) setError(libraryErrorText(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function change(patch: Partial<LibrarySettings>) {
    setBusy(true); setError(''); setNotice('')
    const next = { ...settings, ...patch }
    if (next.levels.length === 0) { setError('Choose at least one age band.'); setBusy(false); return }
    const { error: e } = await supabase.from('library_settings').update(patch).eq('id', true)
    setBusy(false)
    if (e) { setError('Could not save that. Please try again.'); return }
    setSettings(next); setNotice('Saved.')
  }

  async function toggleHidden(b: AdminBook) {
    setBusy(true); setError(''); setNotice('')
    const { error: e } = b.hidden
      ? await supabase.from('library_hidden_books').delete().eq('book_id', b.id)
      : await supabase.from('library_hidden_books').insert({ book_id: b.id, book_title: b.title, hidden_by: userId })
    setBusy(false)
    if (e) { setError('Could not change that title. Please try again.'); return }
    setBooks((all) => all.map((x) => (x.id === b.id ? { ...x, hidden: !b.hidden } : x)))
  }

  const hidden = useMemo(() => new Set(books.filter((b) => b.hidden).map((b) => b.id)), [books])
  const term = search.trim().toLowerCase()
  const shown = books.filter((b) => !term || `${b.title} ${b.author} ${b.subject ?? ''}`.toLowerCase().includes(term))

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <h1 className="portal-page-title">Library settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>Choose what your students see. You can change this at any time.</p>
      {!installed && <div className="banner banner-warning" style={{ marginBottom: 16 }}>These settings are not installed yet. Ask Smart Assess Ja to add them, then they will save here.</div>}
      {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="banner banner-success" style={{ marginBottom: 16 }}>{notice}</div>}

      <div className="card" style={{ padding: '4px 22px', marginBottom: 24 }}>
        <Row title="Curriculum shelf" hint="Subject books and readers, organised by subject and topic." on={settings.curriculum_shelf} onChange={(v) => change({ curriculum_shelf: v })} busy={busy || !installed} />
        <Row title="Read for fun shelf" hint="A curated set of stories and classics students can choose for themselves." on={settings.fun_shelf} onChange={(v) => change({ fun_shelf: v })} busy={busy || !installed} />
        <Row title="Audio books" hint="Students can listen as well as read." on={settings.audio} onChange={(v) => change({ audio: v })} busy={busy || !installed} />
        <Row title="Teachers can assign reading" hint="Teachers and heads of department can set reading for their classes and see progress." on={settings.teachers_assign} onChange={(v) => change({ teachers_assign: v })} busy={busy || !installed} />
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Age bands shown</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 10px' }}>A book appears when at least one of its age bands is switched on here.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ALL_LEVELS.map((l) => (
              <button key={l} type="button" className="lib-chip" aria-pressed={settings.levels.includes(l)} disabled={busy || !installed}
                onClick={() => change({ levels: settings.levels.includes(l) ? settings.levels.filter((x) => x !== l) : [...settings.levels, l] })}>{LEVEL_LABEL[l]}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Titles</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-strong)', background: '#fff', borderRadius: 100, padding: '7px 14px', width: 260, maxWidth: '100%' }}>
          <i className="ti ti-search" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles" aria-label="Search titles" style={{ border: 0, outline: 'none', background: 'transparent', fontSize: 13, width: '100%', padding: 0 }} />
        </label>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>New titles are added centrally by Smart Assess Ja. Hide any title you do not want your students to see.</p>

      <div className="card" style={{ padding: '6px 8px', overflowX: 'auto' }}>
        {books.length === 0 && <p style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>There are no titles in the Library yet.</p>}
        {books.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Title', 'Shelf', 'Formats', 'Students see it', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map((b) => {
                const visible = bookVisible(b, settings, hidden)
                const reason = b.hidden ? 'Hidden by you' : !visible ? (b.shelf === 'curriculum' ? (settings.curriculum_shelf ? 'Age band off' : 'Shelf off') : (settings.fun_shelf ? 'Age band off' : 'Shelf off')) : 'Yes'
                return (
                  <tr key={b.id}>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{b.title}<div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>{b.author}</div></td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{SHELF_LABEL[b.shelf]}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{b.formats.map((f) => (f === 'read' ? 'Read' : 'Listen')).join(', ')}{!settings.audio && b.formats.includes('listen') ? ' (audio off)' : ''}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}><span className={`badge ${visible ? 'badge-success' : 'badge-default'}`}>{reason}</span></td>
                    <td style={{ padding: 10, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy || !installed} onClick={() => toggleHidden(b)}>{b.hidden ? 'Show' : 'Hide'}</button>
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && <tr><td colSpan={5} style={{ padding: 16, color: 'var(--text-secondary)' }}>Nothing matches that search.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
