'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { formatDay, formatTime, attendanceError } from '@/lib/attendance'
import { ALERT_KIND, type AttendanceAlert, type AlertKind } from '@/lib/attendanceAlerts'
import HowItWorks from '@/components/HowItWorks'

// Attendance alerts: a teacher late or not started, and students at school but missing from class.
export default function PrincipalAlertsPage() {
  const [alerts, setAlerts] = useState<AttendanceAlert[]>([])
  const [read, setRead] = useState<Set<string>>(new Set())
  const [showResolved, setShowResolved] = useState(false)
  const [kind, setKind] = useState<'all' | AlertKind>('all')
  const [openDays, setOpenDays] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  // Read once on the client (this page never renders on the server: the portal layout waits for sign-in first).
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await supabase.rpc('refresh_attendance_alerts')
        const { data: { session } } = await supabase.auth.getSession()
        const [alertRes, readRes] = await Promise.all([
          supabase.from('attendance_alerts').select('id, kind, class_date, student_id, message, created_at, resolved_at').order('created_at', { ascending: false }).limit(200),
          supabase.from('attendance_alert_reads').select('alert_id').eq('user_id', session?.user?.id ?? ''),
        ])
        if (alertRes.error) throw alertRes.error
        if (cancelled) return
        setAlerts((alertRes.data as AttendanceAlert[]) || [])
        setRead(new Set((readRes.data || []).map((r) => r.alert_id)))
        setError('')
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [reload])

  const markRead = useCallback(async (ids: string[] | null) => {
    const { error: rpcError } = await supabase.rpc('mark_alerts_read', ids ? { p_ids: ids } : {})
    if (rpcError) { setError(attendanceError(rpcError)); return }
    setReload((n) => n + 1)
  }, [])

  const byStatus = alerts.filter((a) => showResolved || !a.resolved_at)
  const kindCount = (k: AlertKind) => byStatus.filter((a) => a.kind === k).length
  const visible = byStatus.filter((a) => kind === 'all' || a.kind === kind)
  const unread = visible.filter((a) => !a.resolved_at && !read.has(a.id)).length

  // Group by school day, newest first.
  const days = new Map<string, AttendanceAlert[]>()
  for (const a of visible) (days.get(a.class_date) ?? days.set(a.class_date, []).get(a.class_date)!).push(a)

  return (
    <div>
      <p className="portal-page-title">Alerts</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{unread === 0 ? 'Nothing unread' : `${unread} unread`}</span>
        <div style={{ flex: 1 }} />
        {permission === 'default' && (
          <button type="button" className="btn btn-secondary" onClick={async () => setPermission(await Notification.requestPermission())}>
            Get desktop notifications
          </button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
        </label>
        <button type="button" className="btn btn-secondary" disabled={unread === 0} onClick={() => markRead(null)}>Mark all read</button>
      </div>
      <HowItWorks title="When do alerts appear?">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><strong>Teacher late:</strong> a teacher starts a class after the bell.</li>
          <li><strong>Not started:</strong> a class has not been started 10 minutes after the bell.</li>
          <li><strong>Truancy:</strong> a student registered present is marked absent from a class.</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>They clear on their own if the teacher starts the class or corrects the mark.{permission === 'granted' ? ' Desktop notifications are on.' : ''}</p>
      </HowItWorks>

      <div role="group" aria-label="Type of alert" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {([['all', 'All', byStatus.length], ['teacher_not_started', ALERT_KIND.teacher_not_started.label, kindCount('teacher_not_started')], ['teacher_late', ALERT_KIND.teacher_late.label, kindCount('teacher_late')], ['truancy', ALERT_KIND.truancy.label, kindCount('truancy')]] as [('all' | AlertKind), string, number][]).map(([k, label, n]) => (
          <button key={k} type="button" aria-pressed={kind === k} className={kind === k ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setKind(k)}>
            {label} ({n})
          </button>
        ))}
      </div>

      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && !error && visible.length === 0 && (
        <EmptyState icon="✓" title="No alerts" description="Everything is on track. New alerts appear here as they happen." />
      )}

      {[...days.entries()].map(([day, list], di) => {
        const dayUnread = list.filter((a) => !a.resolved_at && !read.has(a.id)).length
        // The newest day, and any day with something unread, starts open; older days start closed.
        const expanded = openDays.has(day) ? true : openDays.has('!' + day) ? false : di === 0 || dayUnread > 0
        const toggleDay = () => setOpenDays((prev) => { const next = new Set(prev); next.delete(day); next.delete('!' + day); next.add(expanded ? '!' + day : day); return next })
        return (
          <section key={day} style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card-bg)', overflow: 'hidden' }}>
            <button type="button" onClick={toggleDay} aria-expanded={expanded} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{formatDay(day)}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                {dayUnread > 0 && <span className="badge badge-warning">{dayUnread} unread</span>}
                <span>{list.length} alert{list.length === 1 ? '' : 's'}</span>
                <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
              </span>
            </button>
            {expanded && (
              <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
                {list.map((a, i) => {
                  const isUnread = !a.resolved_at && !read.has(a.id)
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border)' : undefined, opacity: a.resolved_at ? 0.6 : 1, borderLeft: isUnread ? '3px solid var(--accent)' : '3px solid transparent' }}>
                      <div style={{ minWidth: 220, flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={`badge ${ALERT_KIND[a.kind].badge}`}>{ALERT_KIND[a.kind].label}</span>
                          {a.resolved_at && <span className="badge badge-success">Resolved</span>}
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(a.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 14, marginTop: 4, fontWeight: isUnread ? 700 : 400 }}>{a.message}</div>
                        {a.student_id && <Link href={`/principal/students/${a.student_id}`} style={{ fontSize: 12, fontWeight: 700 }}>View student →</Link>}
                      </div>
                      {isUnread && <button type="button" className="btn btn-ghost" style={{ alignSelf: 'center', fontSize: 12 }} onClick={() => markRead([a.id])}>Mark read</button>}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
