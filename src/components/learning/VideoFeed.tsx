'use client'

import { useMemo, useState } from 'react'
import { embedUrl, thumbnailUrl, gradeLabel, PROVIDER_LABEL, DATA_NOTE, subjectsOf, bySubject, defaultLowData, type Video } from '@/lib/videosPure'
import { readLowData, reportVideo, saveLowData } from '@/lib/videos'

// The video feed. One card per video, a short screen at a time (like a Shorts feed), by subject. A video only loads when its Play button is
// tapped, never before. Low-data mode also drops the pictures and shows a compact list.

type Conn = { saveData?: boolean; effectiveType?: string }
const REASONS = ['It does not play', 'It is wrong or confusing', 'It is not suitable for school']

function Meta({ v }: { v: Video }) {
  const chip = (t: string, k: string) => <span key={k} className="badge badge-default">{t}</span>
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[chip(v.subject, 's'), ...(v.topic ? [chip(v.topic, 't')] : []), chip(gradeLabel(v.grade_from, v.grade_to), 'g')]}</div>
}

function Media({ v, playing, low, onPlay }: { v: Video; playing: boolean; low: boolean; onPlay: () => void }) {
  const src = embedUrl(v)
  const thumb = low ? null : thumbnailUrl(v)
  if (playing && src) {
    return <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', maxHeight: '42dvh', background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <iframe src={src} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
    </div>
  }
  if (low) return null
  return (
    <button type="button" onClick={src ? onPlay : () => window.open(v.url, '_blank', 'noopener,noreferrer')} aria-label={src ? `Play ${v.title}` : `Open ${v.title} on ${PROVIDER_LABEL[v.provider]}`}
      style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', maxHeight: '42dvh', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', padding: 0, cursor: 'pointer', background: 'var(--accent-light, #FAE8D4)', display: 'grid', placeItems: 'center' }}>
      {/* a plain <img>: the picture comes straight from the video site, and is not routed through our own image service */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', background: 'rgba(26,14,6,0.78)', color: '#fff', display: 'grid', placeItems: 'center' }}><i className="ti ti-player-play" style={{ fontSize: 26 }} aria-hidden /></span>
      {!thumb && <span style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 12, color: 'var(--text-secondary)' }}>{PROVIDER_LABEL[v.provider]}</span>}
    </button>
  )
}

function Card({ v, playing, low, canReport, onPlay, onReported, tall }: { v: Video; playing: boolean; low: boolean; canReport: boolean; onPlay: () => void; onReported: (id: string) => void; tall: boolean }) {
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const src = embedUrl(v)
  async function send() {
    setBusy(true); setError('')
    const r = await reportVideo(v.id, reason)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    onReported(v.id)
  }
  return (
    <article className="card" aria-label={v.title} style={tall ? { height: '100%', boxSizing: 'border-box', scrollSnapAlign: 'start', scrollSnapStop: 'always', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 } : { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Media v={v} playing={playing} low={low} onPlay={onPlay} />
      <div>
        <h3 style={{ margin: 0, fontSize: 17, overflowWrap: 'anywhere' }}>{v.title}</h3>
        <p style={{ margin: '2px 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>Added by {v.added_by_name} · {PROVIDER_LABEL[v.provider]}</p>
        <Meta v={v} />
        {v.note && <p style={{ margin: '10px 0 0', fontSize: 14, overflowWrap: 'anywhere' }}>{v.note}</p>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        {src && !playing && <button type="button" className="btn btn-primary" onClick={onPlay} style={{ minHeight: 44 }}><i className="ti ti-player-play" aria-hidden /> Play</button>}
        <a className="btn btn-secondary" href={v.url} target="_blank" rel="noopener noreferrer" style={{ minHeight: 44 }}>Open on {PROVIDER_LABEL[v.provider]}</a>
        {canReport && !reporting && <button type="button" className="btn btn-ghost" onClick={() => setReporting(true)} style={{ minHeight: 44 }}>Report a problem</button>}
      </div>
      {reporting && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <label htmlFor={`rep-${v.id}`} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>What is the problem?</label>
          <select id={`rep-${v.id}`} value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 8 }}>{REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send report'}</button><button type="button" className="btn btn-ghost" onClick={() => setReporting(false)}>Cancel</button></div>
          {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </article>
  )
}

export default function VideoFeed({ videos, canReport }: { videos: Video[]; canReport: boolean }) {
  const [subject, setSubject] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const [gone, setGone] = useState<string[]>([])
  const [thanks, setThanks] = useState(false)
  const [low, setLow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = readLowData()
    return saved !== null ? saved : defaultLowData((navigator as Navigator & { connection?: Conn }).connection)
  })
  const subjects = useMemo(() => subjectsOf(videos), [videos])
  const shown = useMemo(() => bySubject(videos, subject).filter((v) => !gone.includes(v.id)), [videos, subject, gone])
  const toggle = () => { const next = !low; setLow(next); saveLowData(next); setPlaying(null) }
  const chip = (value: string, text: string) => <button key={value} type="button" aria-pressed={subject === value} className={`btn ${subject === value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSubject(value); setPlaying(null) }} style={{ minHeight: 40 }}>{text}</button>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
        {subjects.length > 1 && <>{chip('', 'All subjects')}{subjects.map((s) => chip(s, s))}</>}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', fontSize: 13, fontWeight: 600, minHeight: 44 }}>
          <input type="checkbox" checked={low} onChange={toggle} style={{ width: 20, height: 20 }} /> Low-data mode
        </label>
      </div>
      {low && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0' }}>{DATA_NOTE}</p>}
      {thanks && <p role="status" className="banner banner-success" style={{ marginTop: 10 }}>Thank you. A teacher will check that video.</p>}

      {shown.length === 0 ? (
        <div className="card" style={{ marginTop: 14 }}><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>{videos.length === 0 ? 'No videos yet. Your teachers will add helpful ones here.' : 'No videos for that subject yet.'}</p></div>
      ) : low ? (
        <div>{shown.map((v) => <Card key={v.id} v={v} playing={playing === v.id} low canReport={canReport} tall={false} onPlay={() => setPlaying(v.id)} onReported={(id) => { setGone([...gone, id]); setThanks(true) }} />)}</div>
      ) : (
        <div style={{ marginTop: 12, height: 'clamp(420px, calc(100dvh - 290px), 720px)', overflowY: 'auto', scrollSnapType: 'y mandatory', display: 'flex', flexDirection: 'column', gap: 12 }} tabIndex={0} aria-label="Video feed, scroll for the next video">
          {shown.map((v) => (
            <div key={v.id} style={{ flex: '0 0 100%', minHeight: 0, scrollSnapAlign: 'start' }}>
              <Card v={v} playing={playing === v.id} low={false} canReport={canReport} tall onPlay={() => setPlaying(v.id)} onReported={(id) => { setGone([...gone, id]); setThanks(true) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
