'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, shiftDate, attendanceError } from '@/lib/attendance'
import { onTimePercent, type PunctualityRow } from '@/components/principal/PunctualityView'
import { usePresence } from '@/lib/presence'
import PresenceDot from '@/components/PresenceDot'

type Person = { id: string; full_name: string; role: string; department: string | null; is_active: boolean | null }
type GroupBy = 'department' | 'role' | 'none'

const NO_DEPARTMENT = 'No department'

// Every teacher and HOD: where they work, what they teach, and how reliably they reach class. Grouped and collapsible.
// The school overview links here with ?role=teacher, ?role=supervisor or ?online=1.
export default function PrincipalStaffPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [subjects, setSubjects] = useState<Record<string, string[]>>({})
  const [classes, setClasses] = useState<Record<string, string[]>>({})
  const [punctuality, setPunctuality] = useState<Record<string, PunctualityRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all' | 'teacher' | 'supervisor'>('all')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupBy>('department')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const presence = usePresence(people.map((p) => p.id))
  const presenceOn = Object.keys(presence).length > 0

  // Arriving from a link on the overview: apply its filter once.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const r = q.get('role')
    if (r === 'teacher' || r === 'supervisor') setRole(r)
    if (q.get('online') === '1') setOnlineOnly(true)
  }, [])

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

  // The online filter only means something once online status is available; without it everyone is shown.
  const onlineFilter = onlineOnly && presenceOn
  const filtering = search.trim() !== '' || onlineFilter

  const visible = useMemo(() => people.filter((p) =>
    (role === 'all' || p.role === role) &&
    (!onlineFilter || (presence[p.id] && presence[p.id].state !== 'offline')) &&
    (!search.trim() || p.full_name.toLowerCase().includes(search.toLowerCase()) || (p.department || '').toLowerCase().includes(search.toLowerCase()) || (subjects[p.id] || []).some((s) => s.toLowerCase().includes(search.toLowerCase())))
  ), [people, role, search, subjects, onlineFilter, presence])

  // Grouped for display. Online people first inside each group, then by name.
  const groups = useMemo(() => {
    const keyOf = (p: Person) => groupBy === 'department' ? (p.department || NO_DEPARTMENT) : groupBy === 'role' ? (p.role === 'supervisor' ? 'Heads of department' : 'Teachers') : 'Everyone'
    const map = new Map<string, Person[]>()
    for (const p of visible) map.set(keyOf(p), [...(map.get(keyOf(p)) ?? []), p])
    const rank = (p: Person) => (presence[p.id]?.state === 'online' ? 0 : presence[p.id]?.state === 'away' ? 1 : 2)
    for (const list of map.values()) list.sort((a, b) => rank(a) - rank(b) || a.full_name.localeCompare(b.full_name))
    return [...map.entries()].sort(([a], [b]) => (a === NO_DEPARTMENT ? 1 : b === NO_DEPARTMENT ? -1 : a.localeCompare(b)))
  }, [visible, groupBy, presence])

  const toggle = (key: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const isOpen = (key: string) => groupBy === 'none' || filtering || open.has(key)

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <h1 className="portal-page-title">Staff</h1>
      <p className="portal-page-sub">Teachers and heads of department</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input type="search" placeholder="Search by name, department or subject…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search staff" style={{ flex: 1, minWidth: 220 }} />
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Role">
          <option value="all">Teachers and HODs</option>
          <option value="teacher">Teachers</option>
          <option value="supervisor">HODs</option>
        </select>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} aria-label="Group by">
          <option value="department">Group by department</option>
          <option value="role">Group by role</option>
          <option value="none">No grouping</option>
        </select>
        {presenceOn && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} /> Online now
          </label>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{visible.length} of {people.length} staff · on-time rate is for the last 30 days</span>
        {groupBy !== 'none' && groups.length > 1 && !filtering && (
          <>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(new Set(groups.map(([k]) => k)))}>Expand all</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(new Set())}>Collapse all</button>
          </>
        )}
      </div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {!error && visible.length === 0 && <EmptyState icon="🧑‍🏫" title={onlineFilter ? 'Nobody is online right now' : 'No staff found'} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(([name, list]) => {
          const expanded = isOpen(name)
          const online = list.filter((p) => presence[p.id]?.state === 'online').length
          const low = list.filter((p) => { const pu = punctuality[p.id]; const pct = pu ? onTimePercent(pu) : null; return pct !== null && pct < 70 }).length
          return (
            <div key={name} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card-bg)', overflow: 'hidden' }}>
              {groupBy !== 'none' && (
                <button
                  type="button"
                  onClick={() => toggle(name)}
                  aria-expanded={expanded}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', cursor: filtering ? 'default' : 'pointer', font: 'inherit', color: 'inherit' }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {online > 0 && <span className="badge badge-success">{online} online</span>}
                    {low > 0 && <span className="badge badge-warning">{low} below 70% on time</span>}
                    <span>{list.length} staff</span>
                    {!filtering && <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>}
                  </span>
                </button>
              )}
              {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: groupBy !== 'none' ? '1px solid var(--border)' : undefined }}>
                  {list.map((p, i) => {
                    const pu = punctuality[p.id]
                    const pct = pu ? onTimePercent(pu) : null
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                        <div style={{ minWidth: 220, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            <PresenceDot info={presence[p.id]} showLabel /> <Link href={`/principal/staff/${p.id}`} style={{ color: 'inherit' }}>{p.full_name}</Link>{' '}
                            <span className={`badge ${p.role === 'supervisor' ? 'badge-success' : 'badge-default'}`}>{p.role === 'supervisor' ? 'HOD' : 'Teacher'}</span>
                            {p.is_active === false && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Deactivated</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {groupBy !== 'department' && <>{p.department || NO_DEPARTMENT}{(subjects[p.id] || []).length ? ' · ' : ''}</>}
                            {(subjects[p.id] || []).join(', ') || (groupBy === 'department' ? 'No subjects assigned' : '')}
                          </div>
                          {(classes[p.id] || []).length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Classes: {[...(classes[p.id] || [])].sort().join(', ')}</div>}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            <Link href={`/principal/messages?with=${p.id}`} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} aria-label={`Message ${p.full_name}`}>Message</Link>
                            <Link href={`/principal/staff/${p.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>View their work →</Link>
                          </div>
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
