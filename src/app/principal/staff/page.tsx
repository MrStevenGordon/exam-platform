'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, shiftDate, attendanceError } from '@/lib/attendance'
import { onTimePercent, type PunctualityRow } from '@/components/principal/PunctualityView'
import { usePresence } from '@/lib/presence'
import PresenceDot from '@/components/PresenceDot'

type Person = { id: string; full_name: string; role: string; department: string | null; is_active: boolean | null }

// Every teacher and HOD: where they work, what they teach, and how reliably they reach class.
export default function PrincipalStaffPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [subjects, setSubjects] = useState<Record<string, string[]>>({})
  const [classes, setClasses] = useState<Record<string, string[]>>({})
  const [punctuality, setPunctuality] = useState<Record<string, PunctualityRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all' | 'teacher' | 'supervisor'>('all')
  const presence = usePresence(people.map((p) => p.id))

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const today = jamaicaDate()
        const [staffRes, subjectRes, classRes, punctRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, role, is_active, departments!profiles_department_id_fkey(name)').in('role', ['teacher', 'supervisor']).order('full_name'),
          supabase.from('teacher_subjects').select('teacher_id, subject'),
          supabase.from('teacher_class_groups').select('teacher_id, class_groups(name)'),
          supabase.rpc('teacher_punctuality', { p_from: shiftDate(today, -29), p_to: today }),
        ])
        if (staffRes.error) throw staffRes.error
        if (cancelled) return
        setPeople((staffRes.data || []).map((p) => ({
          id: p.id, full_name: p.full_name, role: p.role, is_active: p.is_active,
          department: (p.departments as unknown as { name: string } | null)?.name ?? null,
        })))
        const bySubject: Record<string, string[]> = {}
        for (const r of subjectRes.data || []) (bySubject[r.teacher_id] ??= []).push(r.subject)
        setSubjects(bySubject)
        const byClass: Record<string, string[]> = {}
        for (const r of (classRes.data || []) as unknown as { teacher_id: string; class_groups: { name: string } | null }[]) {
          if (r.class_groups?.name) (byClass[r.teacher_id] ??= []).push(r.class_groups.name)
        }
        setClasses(byClass)
        // Punctuality is a bonus column: if attendance isn't set up yet, the list still works.
        setPunctuality(Object.fromEntries(((punctRes.data || []) as PunctualityRow[]).map((r) => [r.teacher_id, r])))
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => people.filter((p) =>
    (role === 'all' || p.role === role) &&
    (!search.trim() || p.full_name.toLowerCase().includes(search.toLowerCase()) || (p.department || '').toLowerCase().includes(search.toLowerCase()) || (subjects[p.id] || []).some((s) => s.toLowerCase().includes(search.toLowerCase())))
  ), [people, role, search, subjects])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Staff</p>
      <p className="portal-page-sub">Teachers and heads of department</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="search" placeholder="Search by name, department or subject…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search staff" style={{ flex: 1, minWidth: 220 }} />
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Role">
          <option value="all">Teachers and HODs</option>
          <option value="teacher">Teachers</option>
          <option value="supervisor">HODs</option>
        </select>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>{visible.length} of {people.length} staff · on-time rate is for the last 30 days</p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {!error && visible.length === 0 && <EmptyState icon="🧑‍🏫" title="No staff found" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((p) => {
          const pu = punctuality[p.id]
          const pct = pu ? onTimePercent(pu) : null
          return (
            <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  <PresenceDot info={presence[p.id]} showLabel /> {p.full_name}{' '}
                  <span className={`badge ${p.role === 'supervisor' ? 'badge-success' : 'badge-default'}`}>{p.role === 'supervisor' ? 'HOD' : 'Teacher'}</span>
                  {p.is_active === false && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Deactivated</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {p.department || 'No department'}{(subjects[p.id] || []).length ? ` · ${(subjects[p.id] || []).join(', ')}` : ''}
                </div>
                {(classes[p.id] || []).length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Classes: {(classes[p.id] || []).sort().join(', ')}</div>}
              </div>
              <div style={{ textAlign: 'right', alignSelf: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                {pct === null ? <span style={{ color: 'var(--text-muted)' }}>No attendance data yet</span> : (
                  <>
                    <span className={`badge ${pct >= 90 ? 'badge-success' : pct >= 70 ? 'badge-warning' : 'badge-danger'}`}>{pct}% on time</span>
                    <div style={{ marginTop: 4 }}>{pu.late} late · {pu.missed} not recorded</div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
