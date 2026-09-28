'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TopicRow = { subject: string; topic: string; questionCount: number }
const DEFAULT_TEAM_NAMES = ['Red', 'Blue', 'Green', 'Gold', 'Purple', 'Orange']
type PastGame = { code: string; subject: string; status: string; players: number }

export default function BoardSetupPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [games, setGames] = useState<PastGame[]>([])
  const [subject, setSubject] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [rows, setRows] = useState(5)
  const [buzzSeconds, setBuzzSeconds] = useState(20)
  const [deductWrong, setDeductWrong] = useState(false)
  const [teamMode, setTeamMode] = useState(false)
  const [teamCount, setTeamCount] = useState(3)
  const [teamNames, setTeamNames] = useState(DEFAULT_TEAM_NAMES)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [t, g] = await Promise.all([fetch('/api/play/host/board-topics'), fetch('/api/play/board')])
        if (t.status === 401 || g.status === 401) { router.push('/play/login'); return }
        const tj = await t.json()
        const gj = await g.json()
        if (!t.ok) throw new Error(tj.error)
        if (!g.ok) throw new Error(gj.error)
        setTopics(tj.topics)
        setGames(gj.games)
        const subjects = Array.from(new Set<string>(tj.topics.map((x: TopicRow) => x.subject))).sort()
        if (subjects.length > 0) setSubject(subjects.includes('Mathematics') ? 'Mathematics' : subjects[0])
      } catch (err: any) {
        setError(err?.message || 'Something went wrong loading the setup.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const subjects = useMemo(() => Array.from(new Set(topics.map((t) => t.subject))).sort(), [topics])
  const subjectTopics = topics.filter((t) => t.subject === subject)

  function toggle(topic: string) {
    setChosen((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : prev.length >= 6 ? prev : [...prev, topic]))
  }

  async function create() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/play/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topics: chosen, rows, buzzSeconds, deductWrong, teamNames: teamMode ? teamNames.slice(0, teamCount) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/play/host/board/${data.code}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong creating the board.')
      setBusy(false)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>

  const open = games.filter((g) => g.status !== 'ended')
  const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>Jeopardy board</h1>
        <Link href="/play/host" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Pick categories and run the board on the projector. Students buzz in from their own devices; the first to buzz answers out loud and you mark it right or wrong.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {open.length > 0 && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>You have a board in progress</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Code {open[0].code} · {open[0].players} player{open[0].players !== 1 ? 's' : ''}</div>
          </div>
          <Link href={`/play/host/board/${open[0].code}`} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 16px' }}>Resume hosting</Link>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ ...label, maxWidth: 240 }}>
          Subject
          <select value={subject} onChange={(e) => { setSubject(e.target.value); setChosen([]) }}>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Categories (choose 2 to 6). Each needs at least {rows} approved questions.</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {subjectTopics.map((t) => {
              const enough = t.questionCount >= rows
              const on = chosen.includes(t.topic)
              return (
                <label
                  key={t.topic}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 14,
                    border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-light)' : 'var(--card-bg)',
                    opacity: enough ? 1 : 0.5, cursor: enough ? 'pointer' : 'not-allowed', textTransform: 'none', letterSpacing: 'normal',
                  }}
                >
                  <input type="checkbox" checked={on} disabled={!enough} onChange={() => toggle(t.topic)} style={{ width: 16, height: 16 }} />
                  {t.topic} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({t.questionCount}{enough ? '' : `, needs ${rows}`})</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={label}>
            Rows (values 100 to {rows * 100})
            <select value={rows} onChange={(e) => { const r = Number(e.target.value); setRows(r); setChosen((prev) => prev.filter((t) => (topics.find((x) => x.subject === subject && x.topic === t)?.questionCount ?? 0) >= r)) }}>
              {[3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={label}>
            Seconds to buzz
            <select value={buzzSeconds} onChange={(e) => setBuzzSeconds(Number(e.target.value))}>
              {[10, 20, 30, 45].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, textTransform: 'none', letterSpacing: 'normal' }}>
          <input type="checkbox" checked={deductWrong} onChange={(e) => setDeductWrong(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16 }} />
          <span>Lose points for a wrong answer <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(off by default)</span></span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, textTransform: 'none', letterSpacing: 'normal' }}>
            <input type="checkbox" checked={teamMode} onChange={(e) => setTeamMode(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16 }} />
            <span>Play in teams <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(students are split into balanced teams as they join; a team gets one try per clue and points go to the team)</span></span>
          </label>
          {teamMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 24 }}>
              <label style={{ ...label, maxWidth: 160 }}>
                Number of teams
                <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {teamNames.slice(0, teamCount).map((name, i) => (
                  <label key={i} style={{ ...label, width: 150 }}>
                    Team {i + 1} name
                    <input value={name} maxLength={24} onChange={(e) => setTeamNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))} />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <button onClick={create} disabled={busy || chosen.length < 2} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>
            {busy ? 'Creating…' : chosen.length < 2 ? 'Choose at least 2 categories' : `Create board (${chosen.length} × ${rows})`}
          </button>
        </div>
      </div>
    </div>
  )
}
