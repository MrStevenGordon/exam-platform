'use client'

import { useEffect, useRef, useState } from 'react'
import { libraryGet, libraryErrorText, listenPercent, saveProgress, formatDuration, type LibraryBook, type LibraryFile } from '@/lib/library'

// Plays a book's audio, one chapter after another, and remembers the chapter and the second. The file link is
// short-lived and fetched per chapter. Saves every 15 seconds while playing, when paused, and at the end.
const SAVE_EVERY_SECONDS = 15
const RATES = [0.75, 1, 1.25, 1.5, 2]

export default function AudioPlayer({ book, files, startFileId, startSeconds }: { book: LibraryBook; files: LibraryFile[]; startFileId: string | null; startSeconds: number }) {
  const firstIndex = Math.max(0, files.findIndex((f) => f.id === startFileId))
  const audioRef = useRef<HTMLAudioElement>(null)
  const pendingSeek = useRef<number | null>(startSeconds > 0 ? startSeconds : null)
  const autoplay = useRef(false)
  const lastSaved = useRef(0)
  const [index, setIndex] = useState(firstIndex)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(files[firstIndex]?.duration_seconds ?? 0)
  const [rate, setRate] = useState(1)
  const [sleepMinutes, setSleepMinutes] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  const file = files[index]

  useEffect(() => {
    let cancelled = false
    async function load() {
      setUrl(null)
      setError('')
      try {
        const r = await libraryGet<{ url: string }>(`/api/library/files/${files[index].id}/url`)
        if (!cancelled) setUrl(r.url)
      } catch (err) {
        if (!cancelled) setError(libraryErrorText(err))
      }
    }
    load()
    return () => { cancelled = true }
  }, [files, index, reloadKey])

  // Saves the place in a chapter (the current one unless told otherwise).
  function save(seconds: number, finished = false, at = index) {
    const a = audioRef.current
    const dur = at === index ? (a && Number.isFinite(a.duration) ? a.duration : duration) : (files[at].duration_seconds ?? 0)
    lastSaved.current = seconds
    saveProgress({ book, format: 'listen', fileId: files[at].id, seconds, duration: dur, percent: finished ? 100 : listenPercent(files, at, seconds, dur) })
  }

  // Stop after the sleep timer runs out.
  useEffect(() => {
    if (!sleepMinutes) return
    const timer = setTimeout(() => { audioRef.current?.pause(); setSleepMinutes(0) }, sleepMinutes * 60 * 1000)
    return () => clearTimeout(timer)
  }, [sleepMinutes])

  const toggle = () => { const a = audioRef.current; if (!a) return; if (a.paused) a.play().catch(() => setError('Press play again to start.')); else a.pause() }
  const skip = (s: number) => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, Math.min(a.duration || Infinity, a.currentTime + s)) }
  const choose = (i: number) => { autoplay.current = true; pendingSeek.current = null; setTime(0); setIndex(i) }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chapter {index + 1} of {files.length}</div>
      <div style={{ fontWeight: 700, fontSize: 16, margin: '2px 0 12px' }}>{file.label || `Part ${index + 1}`}</div>
      {error && (
        <div className="banner banner-danger" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{error}</span><button className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}
      {url && (
        <audio
          key={url}
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const a = e.currentTarget
            setDuration(Number.isFinite(a.duration) ? a.duration : 0)
            a.playbackRate = rate
            if (pendingSeek.current != null) { a.currentTime = Math.min(pendingSeek.current, Math.max(0, a.duration - 1)); pendingSeek.current = null }
            if (autoplay.current) { autoplay.current = false; a.play().catch(() => {}) }
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setTime(t)
            if (!e.currentTarget.paused && Math.abs(t - lastSaved.current) >= SAVE_EVERY_SECONDS) save(t)
          }}
          onPlay={() => setPlaying(true)}
          onPause={(e) => { setPlaying(false); if (e.currentTarget.currentTime > 0 && !e.currentTarget.ended) save(e.currentTarget.currentTime) }}
          onEnded={() => {
            if (index < files.length - 1) { save(0, false, index + 1); autoplay.current = true; setTime(0); setIndex(index + 1) } else { setPlaying(false); save(duration, true) }
          }}
          onError={() => setError('This chapter could not be played. The link may have expired.')}
        />
      )}
      <input
        type="range" min={0} max={Math.max(1, Math.floor(duration))} value={Math.min(Math.floor(time), Math.max(1, Math.floor(duration)))}
        onChange={(e) => { const a = audioRef.current; if (a) a.currentTime = Number(e.target.value) }}
        aria-label="Position in this chapter" disabled={!url} style={{ width: '100%', accentColor: 'var(--accent)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}><span>{formatDuration(time)}</span><span>-{formatDuration(Math.max(0, duration - time))}</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, margin: '10px 0 14px' }}>
        <button className="btn btn-ghost" onClick={() => skip(-15)} disabled={!url} aria-label="Back 15 seconds"><i className="ti ti-rewind-backward-15" aria-hidden="true" style={{ fontSize: 26 }} /></button>
        <button className="btn btn-primary" onClick={toggle} disabled={!url} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 56, height: 56, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={`ti ${playing ? 'ti-player-pause' : 'ti-player-play'}`} aria-hidden="true" style={{ fontSize: 26 }} /></button>
        <button className="btn btn-ghost" onClick={() => skip(15)} disabled={!url} aria-label="Forward 15 seconds"><i className="ti ti-rewind-forward-15" aria-hidden="true" style={{ fontSize: 26 }} /></button>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>Speed
          <select value={rate} onChange={(e) => { const r = Number(e.target.value); setRate(r); if (audioRef.current) audioRef.current.playbackRate = r }} style={{ padding: '4px 8px' }}>{RATES.map((r) => <option key={r} value={r}>{r}x</option>)}</select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>Sleep timer
          <select value={sleepMinutes} onChange={(e) => setSleepMinutes(Number(e.target.value))} style={{ padding: '4px 8px' }}><option value={0}>Off</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select>
        </label>
      </div>
      {files.length > 1 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {files.map((f, i) => (
            <button key={f.id} onClick={() => choose(i)} aria-current={i === index} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '8px 4px', background: i === index ? 'var(--accent-light)' : 'transparent', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', fontWeight: i === index ? 700 : 400, color: 'var(--text-primary)' }}>
              <span>{i + 1}. {f.label || `Part ${i + 1}`}</span><span style={{ color: 'var(--text-muted)' }}>{f.duration_seconds ? formatDuration(f.duration_seconds) : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
