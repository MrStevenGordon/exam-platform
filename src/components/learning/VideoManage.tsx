'use client'

import { useState } from 'react'
import { removeVideo, setVideoStatus } from '@/lib/videos'
import { gradeLabel, PROVIDER_LABEL, splitForStaff, STATUS_LABEL, type Video } from '@/lib/videosPure'
import VideoForm from '@/components/learning/VideoForm'

// Staff view of the videos: what waits for a decision, what students reported, what the person added, and everything live.

function Row({ v, subjects, isManager, onChanged }: { v: Video; subjects: string[]; isManager: boolean; onChanged: (message?: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true); setError('')
    const r = await fn()
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    onChanged()
  }
  const tone = v.status === 'approved' ? 'badge-success' : v.status === 'pending' ? 'badge-warning' : v.status === 'hidden' ? 'badge-danger' : 'badge-default'
  return (
    <section className="card" style={{ marginTop: 12 }} aria-label={v.title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, overflowWrap: 'anywhere' }}>{v.title}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{[v.subject, v.topic, gradeLabel(v.grade_from, v.grade_to), PROVIDER_LABEL[v.provider], `added by ${v.added_by_name}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge ${tone}`}>{STATUS_LABEL[v.status]}</span>
          {v.reports > 0 && <span className="badge badge-danger">{v.reports} {v.reports === 1 ? 'report' : 'reports'}</span>}
        </div>
      </div>
      {v.note && <p style={{ margin: '8px 0 0', fontSize: 14, overflowWrap: 'anywhere' }}>{v.note}</p>}
      {!editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="btn btn-secondary" href={v.url} target="_blank" rel="noopener noreferrer">Open to check it</a>
          {v.can_manage && v.status !== 'approved' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => setVideoStatus(v.id, 'approved'))}>{v.status === 'hidden' ? 'Approve again' : 'Approve'}</button>}
          {v.can_manage && v.status === 'approved' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(() => setVideoStatus(v.id, 'hidden'))}>Hide</button>}
          {v.can_edit && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {(v.can_manage || v.can_edit) && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => (v.can_manage ? setVideoStatus(v.id, 'removed') : removeVideo(v.id)))}>Remove</button>}
        </div>
      )}
      {editing && <VideoForm video={v} knownSubjects={subjects} isManager={isManager} onCancel={() => setEditing(false)} onDone={(m) => { setEditing(false); onChanged(m) }} />}
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 10 }}>{error}</p>}
    </section>
  )
}

export default function VideoManage({ videos, me, subjects, isManager, onChanged }: { videos: Video[]; me: string; subjects: string[]; isManager: boolean; onChanged: (message?: string) => void }) {
  const s = splitForStaff(videos, me)
  const section = (title: string, hint: string, list: Video[]) => list.length === 0 ? null : (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 16, margin: 0 }}>{title} ({list.length})</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{hint}</p>
      {list.map((v) => <Row key={v.id + v.status} v={v} subjects={subjects} isManager={isManager} onChanged={onChanged} />)}
    </div>
  )
  const mineOnly = s.mine.filter((v) => !s.pending.includes(v) && !s.hidden.includes(v))
  const live = s.approved.filter((v) => !mineOnly.includes(v))
  return (
    <div>
      {section('Waiting for your decision', 'Open each video to check it, then approve or remove it. Students cannot see it until it is approved.', s.pending)}
      {section('Reported by students', 'Two students reported these, so they are hidden. Approve a video to bring it back, or remove it.', s.hidden)}
      {section('Added by you', 'Your videos and where each one stands.', mineOnly)}
      {section('Live for students', 'Everything students can see now.', live)}
      {videos.length === 0 && <div className="card" style={{ marginTop: 14 }}><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>No videos yet. Use Add a video.</p></div>}
    </div>
  )
}
