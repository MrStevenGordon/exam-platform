'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import TutorTranscript from '@/components/learning/TutorTranscript'
import { timeAgo } from '@/lib/presence'
import { FLAG_LABEL, type TutorMessage } from '@/lib/tutorClient'
import { FLAGS_CHANGED_EVENT, OVERDUE_DAYS, loadFlagCounts, waitingDays, waitingLabel, type FlagCounts, type FlaggedRow } from '@/lib/tutorFlags'

type View = 'unread' | 'read' | 'all'

// Every AI tutor conversation flagged in the school, for the principal team and school admins: what is
// still to be read, how long it has been waiting, and who has read the rest. A flag is a prompt for an
// adult to look. It is not a diagnosis, and it does not replace the school's safeguarding procedure.
export default function TutorFlagsDashboard({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<FlaggedRow[] | null>(null)
  const [counts, setCounts] = useState<FlagCounts | null>(null)
  const [installed, setInstalled] = useState(true)
  // If the list could not be loaded, say so and show nothing else: an empty list must never be shown as
  // "nothing waiting" when the truth is that we could not look.
  const [failed, setFailed] = useState<'none' | 'denied' | 'error'>('none')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('unread')
  const [openId, setOpenId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TutorMessage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [c, list] = await Promise.all([loadFlagCounts(), supabase.rpc('learning_tutor_flagged')])
      if (cancelled) return
      if (list.error) {
        // Not installed yet (migration 065) is a plain message; anything else is a problem to report.
        setInstalled(list.error.code !== 'PGRST202')
        setFailed(list.error.code === 'PGRST202' ? 'none' : list.error.code === '42501' ? 'denied' : 'error')
        setRows([])
        return
      }
      setFailed('none')
      setCounts(c)
      setRows((list.data as FlaggedRow[]) || [])
      setError('')
    }
    load()
    return () => { cancelled = true }
  }, [reload])

  const open = useCallback(async (id: string) => {
    if (openId === id) { setOpenId(null); setTranscript(null); return }
    setOpenId(id); setTranscript(null)
    const { data, error: e } = await supabase.rpc('learning_tutor_transcript', { p_conversation_id: id })
    if (e) { setError('Could not open that conversation.'); setOpenId(null); return }
    setTranscript((data as TutorMessage[]) || [])
  }, [openId])

  async function markRead(id: string) {
    setBusy(true)
    const { error: e } = await supabase.rpc('learning_tutor_mark_reviewed', { p_conversation_id: id })
    setBusy(false)
    if (e) { setError('Could not mark it as read. Please try again.'); return }
    setOpenId(null); setTranscript(null); setReload((n) => n + 1); onChanged?.()
    window.dispatchEvent(new Event(FLAGS_CHANGED_EVENT))
  }

  const visible = useMemo(() => (rows ?? []).filter((r) => (view === 'all' ? true : view === 'unread' ? !r.reviewed_at : !!r.reviewed_at)), [rows, view])

  if (rows === null) return <div>Loading…</div>

  if (!installed) {
    return (
      <div>
        <p className="portal-page-title">Tutor flags</p>
        <EmptyState icon="🛡️" title="This list isn’t set up yet" description="Your school administrator needs to apply the latest update before flagged tutor conversations can be listed here." />
      </div>
    )
  }

  if (failed !== 'none') {
    return (
      <div>
        <p className="portal-page-title">Tutor flags</p>
        <p className="banner banner-danger" role="alert">
          {failed === 'denied' ? 'This page is for the principal team and school admins.' : 'Could not load the flagged conversations, so this page cannot tell you whether any are waiting. Please try again.'}
        </p>
        {failed === 'error' && <button type="button" className="btn btn-secondary" onClick={() => { setRows(null); setReload((n) => n + 1) }}>Try again</button>}
      </div>
    )
  }

  const oldestDays = counts ? waitingDays(counts.oldest_open_at) : 0

  return (
    <div>
      <p className="portal-page-title" style={{ marginBottom: 2 }}>Tutor flags</p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Conversations between students and the AI tutor that were marked for an adult to read: a student who may be worried or unsafe, or a message that was not appropriate. A flag is a prompt to look, not a diagnosis.
      </p>

      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {counts && counts.open_wellbeing > 0 && (
        <p className="banner banner-warning" role="status" style={{ fontSize: 13 }}>
          {counts.open_wellbeing} wellbeing concern{counts.open_wellbeing === 1 ? ' is' : 's are'} waiting to be read. If a student may be in danger, follow your school’s safeguarding procedure and involve your guidance counsellor right away.
        </p>
      )}

      {counts && (
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className={`stat-card ${counts.open_total > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{counts.open_total}</div><div className="stat-card-label">To read</div></div>
          <div className="stat-card"><div className="stat-card-value">{counts.open_wellbeing}</div><div className="stat-card-label">Wellbeing concerns</div></div>
          <div className="stat-card"><div className="stat-card-value">{counts.open_inappropriate}</div><div className="stat-card-label">Inappropriate messages</div></div>
          <div className="stat-card"><div className="stat-card-value">{counts.open_total === 0 ? '—' : oldestDays === 0 ? 'Today' : `${oldestDays} day${oldestDays === 1 ? '' : 's'}`}</div><div className="stat-card-label">Longest waiting</div></div>
        </div>
      )}

      <div role="group" aria-label="Show" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([['unread', 'To read'], ['read', 'Already read'], ['all', 'All']] as [View, string][]).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={view === 'unread' ? '✓' : '💬'}
          title={view === 'unread' ? 'Nothing waiting to be read' : view === 'read' ? 'Nothing has been read yet' : 'No flagged conversations'}
          description={view === 'unread' ? 'Every flagged conversation has been read.' : 'Conversations appear here when the AI tutor flags one.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((r) => {
            const unread = !r.reviewed_at
            const overdue = unread && waitingDays(r.flagged_at) >= OVERDUE_DAYS
            const isOpen = openId === r.conversation_id
            return (
              <div key={r.conversation_id} className="card" style={{ borderColor: unread ? (overdue || r.flag_reason === 'wellbeing' ? 'var(--danger)' : 'var(--border-strong)') : undefined }}>
                <button type="button" onClick={() => open(r.conversation_id)} aria-expanded={isOpen} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ minWidth: 220, flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.student_name}</span>
                    {r.student_code ? <span style={{ color: 'var(--text-muted)', fontSize: 13 }}> · {r.student_code}</span> : null}
                    {r.class_name ? <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}> · {r.class_name}</span> : null}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {r.lesson_title} ({r.lesson_subject}){r.teacher_name ? ` · ${r.teacher_name}` : ''} · {r.student_messages} message{r.student_messages === 1 ? '' : 's'}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: overdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: overdue ? 700 : 400 }}>
                      {unread ? waitingLabel(r.flagged_at) : `Read by ${r.reviewed_by_name ?? 'a member of staff'} ${timeAgo(r.reviewed_at)}`}
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <span className={`badge ${unread && r.flag_reason === 'wellbeing' ? 'badge-danger' : unread ? 'badge-warning' : 'badge-default'}`}>{FLAG_LABEL[r.flag_reason]}</span>
                    <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                  </span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {transcript === null ? <div style={{ fontSize: 13 }}>Loading…</div> : <TutorTranscript messages={transcript} studentName={r.student_name} />}
                    {unread && transcript !== null && (
                      <div style={{ marginTop: 12 }}>
                        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => markRead(r.conversation_id)}>I have read this</button>
                        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>Your name and the time are recorded.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
