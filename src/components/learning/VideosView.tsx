'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadVideos } from '@/lib/videos'
import { subjectsOf, splitForStaff, type Video } from '@/lib/videosPure'
import VideoFeed from '@/components/learning/VideoFeed'
import VideoForm from '@/components/learning/VideoForm'
import VideoManage from '@/components/learning/VideoManage'

type Role = 'student' | 'teacher' | 'supervisor' | 'principal' | 'admin'

// Videos in Smart Learning. Students watch (and can report a problem). Staff watch, add links, and manage: a head of department approves a
// teacher's videos, and the principal team and school admin can decide on any.
export default function VideosView({ role }: { role: Role }) {
  const [tab, setTab] = useState<'watch' | 'add' | 'manage'>('watch')
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloads, setReloads] = useState(0)
  const [me, setMe] = useState('')
  const staff = role !== 'student'
  const isManager = role === 'supervisor' || role === 'principal' || role === 'admin'

  useEffect(() => {
    let cancelled = false
    loadVideos().then((r) => { if (cancelled) return; if (r.ok) { setVideos(r.videos); setError('') } else { setVideos([]); setError(r.error) } })
    return () => { cancelled = true }
  }, [reloads])
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setMe(user?.id ?? '')) }, [])

  const approved = useMemo(() => (videos ?? []).filter((v) => v.status === 'approved'), [videos])
  const subjects = useMemo(() => subjectsOf(videos ?? []), [videos])
  const waiting = videos && me ? splitForStaff(videos, me).pending.length + splitForStaff(videos, me).hidden.length : 0
  const changed = (m?: string) => { setMessage(m ?? ''); setReloads((n) => n + 1) }
  const tabBtn = (t: typeof tab, text: string) => <button type="button" role="tab" aria-selected={tab === t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab(t); setMessage('') }}>{text}</button>

  return (
    <div className="page-container sentence-case" style={{ maxWidth: 780 }}>
      <h1 className="portal-page-title">Videos</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
        {staff ? 'Short videos your teachers have chosen to help students learn. Add a link to a YouTube, Vimeo or Khan Academy video; nothing is uploaded here.' : 'Short videos your teachers chose to help you learn. Tap Play to watch. If something is wrong with a video, tell us with Report a problem.'}
      </p>
      {staff && (
        <div role="tablist" style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {tabBtn('watch', 'Watch')}{tabBtn('add', 'Add a video')}{tabBtn('manage', waiting > 0 ? `Manage (${waiting} to decide)` : 'Manage')}
        </div>
      )}
      {message && <p role="status" className="banner banner-success" style={{ marginTop: 14 }}>{message}</p>}
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 14 }}>{error}</p>}
      {videos === null ? <p style={{ marginTop: 18 }}>Loading…</p> : (
        <>
          {(!staff || tab === 'watch') && <VideoFeed videos={approved} canReport={!staff} />}
          {staff && tab === 'add' && <VideoForm knownSubjects={subjects} isManager={isManager} onDone={changed} />}
          {staff && tab === 'manage' && <VideoManage videos={videos} me={me} subjects={subjects} isManager={isManager} onChanged={changed} />}
        </>
      )}
    </div>
  )
}
