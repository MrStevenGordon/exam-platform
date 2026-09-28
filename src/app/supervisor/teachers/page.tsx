'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'

type Row = { id: string; full_name: string; role: string; department_name: string | null; is_active: boolean; subjects: string[]; classes: string[] }

// The teachers in a head of department's own department, each linking to a read-only view of their work.
export default function HodTeachersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase.rpc('leadership_teachers')
      if (cancelled) return
      if (err) setError(err.code === 'PGRST202' ? 'This page needs a database update (069) that has not been applied yet.' : 'Something went wrong loading your teachers. Please try again.')
      else setRows((data || []) as Row[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div>Loading…</div>
  const visible = rows.filter((r) => !search.trim() || r.full_name.toLowerCase().includes(search.toLowerCase()) || r.subjects.some((s) => s.toLowerCase().includes(search.toLowerCase())))

  return (
    <div>
      <h1 className="portal-page-title">My Teachers</h1>
      <p className="portal-page-sub">Teachers in your department. Open one to see what they have set and how their marking stands.</p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {!error && rows.length === 0 && <EmptyState icon="🧑‍🏫" title="No teachers in your department yet" />}
      {rows.length > 0 && (
        <input type="search" placeholder="Search by name or subject…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search teachers" style={{ width: '100%', maxWidth: 420, marginBottom: 16 }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((r) => (
          <Link key={r.id} href={`/supervisor/teachers/${r.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {r.full_name}{' '}
              <span className={`badge ${r.role === 'supervisor' ? 'badge-success' : 'badge-default'}`}>{r.role === 'supervisor' ? 'HOD' : 'Teacher'}</span>
              {!r.is_active && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Deactivated</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.subjects.length ? r.subjects.join(', ') : 'No subjects assigned'}</div>
            {r.classes.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Classes: {r.classes.join(', ')}</div>}
          </Link>
        ))}
      </div>
    </div>
  )
}
