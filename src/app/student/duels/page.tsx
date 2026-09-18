'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'

type Classmate = { student_id: string; full_name: string }

type DuelRow = {
  duel_id: string
  subject: string
  question_count: number
  status: 'pending' | 'active' | 'declined'
  created_at: string
  is_creator: boolean
  creator_id: string
  creator_name: string
  creator_mock_id: string | null
  creator_completed_at: string | null
  creator_score: number | null
  creator_max: number | null
  opponent_id: string
  opponent_name: string
  opponent_mock_id: string | null
  opponent_completed_at: string | null
  opponent_score: number | null
  opponent_max: number | null
}

export default function MathDuelsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const [subjects, setSubjects] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [classmates, setClassmates] = useState<Classmate[]>([])
  const [opponentId, setOpponentId] = useState('')
  const [questionCount, setQuestionCount] = useState(8)

  const [duels, setDuels] = useState<DuelRow[]>([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: bank }, { data: mates }, { data: myDuels }] = await Promise.all([
        supabase.rpc('get_bank_question_subjects'),
        supabase.rpc('get_my_classmates'),
        supabase.rpc('list_my_duels'),
      ])

      const subjectSet = new Set<string>()
      ;(bank || []).forEach((row: any) => { if (row.subject) subjectSet.add(row.subject) })
      const subjectList = Array.from(subjectSet).sort()
      setSubjects(subjectList)
      if (subjectList.length > 0) setSubject(subjectList[0])

      setClassmates(mates || [])
      if ((mates || []).length > 0) setOpponentId(mates[0].student_id)

      setDuels(myDuels || [])
    } catch (err) {
      console.error('Failed to load Math Duels', err)
      setErrorMsg('Something went wrong loading Math Duels. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshDuels() {
    const { data } = await supabase.rpc('list_my_duels')
    setDuels(data || [])
  }

  async function handleChallenge() {
    if (!subject || !opponentId) return
    setBusy('challenge')
    setErrorMsg('')
    try {
      const { data: duelId, error } = await supabase.rpc('create_duel', {
        p_opponent_id: opponentId,
        p_subject: subject,
        p_question_count: questionCount,
      })
      if (error) throw error

      const { data: mockId } = await supabase
        .from('duels')
        .select('creator_mock_id')
        .eq('id', duelId)
        .single()

      if (mockId?.creator_mock_id) router.push(`/student/self-mock/${mockId.creator_mock_id}`)
    } catch (err: any) {
      console.error('Failed to create duel', err)
      setErrorMsg(err?.message || 'Something went wrong sending that challenge. Please try again.')
      setBusy(null)
    }
  }

  async function handleAccept(duelId: string) {
    setBusy(duelId)
    setErrorMsg('')
    try {
      const { data: mockId, error } = await supabase.rpc('accept_duel', { p_duel_id: duelId })
      if (error) throw error
      router.push(`/student/self-mock/${mockId}`)
    } catch (err: any) {
      console.error('Failed to accept duel', err)
      setErrorMsg(err?.message || 'Something went wrong accepting that challenge. Please try again.')
      setBusy(null)
    }
  }

  async function handleDecline(duelId: string) {
    setBusy(duelId)
    setErrorMsg('')
    try {
      const { error } = await supabase.rpc('decline_duel', { p_duel_id: duelId })
      if (error) throw error
      await refreshDuels()
    } catch (err: any) {
      console.error('Failed to decline duel', err)
      setErrorMsg(err?.message || 'Something went wrong declining that challenge. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>

  const pendingForMe = duels.filter((d) => d.status === 'pending' && !d.is_creator)
  const pendingSent = duels.filter((d) => d.status === 'pending' && d.is_creator)
  const activeDuels = duels.filter((d) => d.status === 'active')

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <p className="portal-page-title" style={{ margin: 0 }}>Math Duels</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>
        Challenge a classmate to the same set of questions and see who scores higher. Not graded, just for fun.
      </p>

      {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Challenge a classmate</div>

        {subjects.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            No practice questions are available yet — check back once your teacher has tagged some.
          </p>
        ) : classmates.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            You don't have any classmates set up to challenge yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ minWidth: 160 }}>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Opponent</label>
              <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)} style={{ minWidth: 180 }}>
                {classmates.map((c) => <option key={c.student_id} value={c.student_id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Questions</label>
              <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} style={{ minWidth: 90 }}>
                {[5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={handleChallenge} disabled={busy === 'challenge'} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
              {busy === 'challenge' ? 'Sending…' : 'Send challenge'}
            </button>
          </div>
        )}
      </div>

      {duels.length === 0 && (
        <EmptyState icon="⚔️" title="No duels yet" description="Send a challenge above to start your first Math Duel." />
      )}

      {pendingForMe.length > 0 && (
        <DuelSection title="Challenges waiting on you">
          {pendingForMe.map((d) => (
            <div key={d.duel_id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{d.creator_name} challenged you</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.subject} · {d.question_count} questions</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleAccept(d.duel_id)} disabled={busy === d.duel_id} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>
                  {busy === d.duel_id ? 'Starting…' : 'Accept'}
                </button>
                <button onClick={() => handleDecline(d.duel_id)} disabled={busy === d.duel_id} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </DuelSection>
      )}

      {pendingSent.length > 0 && (
        <DuelSection title="Sent, awaiting response">
          {pendingSent.map((d) => (
            <div key={d.duel_id} className="card">
              <div style={{ fontWeight: 700, fontSize: 14 }}>Waiting for {d.opponent_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.subject} · {d.question_count} questions</div>
            </div>
          ))}
        </DuelSection>
      )}

      {activeDuels.length > 0 && (
        <DuelSection title="Duels">
          {activeDuels.map((d) => {
            const myMockId = d.is_creator ? d.creator_mock_id : d.opponent_mock_id
            const myCompleted = d.is_creator ? d.creator_completed_at : d.opponent_completed_at
            const opponentName = d.is_creator ? d.opponent_name : d.creator_name
            const opponentCompleted = d.is_creator ? d.opponent_completed_at : d.creator_completed_at

            const myScore = d.is_creator ? d.creator_score : d.opponent_score
            const myMax = d.is_creator ? d.creator_max : d.opponent_max
            const oppScore = d.is_creator ? d.opponent_score : d.creator_score
            const oppMax = d.is_creator ? d.opponent_max : d.creator_max

            const bothDone = !!myCompleted && !!opponentCompleted
            const myPct = bothDone && myMax ? Math.round(((myScore || 0) / myMax) * 100) : null
            const oppPct = bothDone && oppMax ? Math.round(((oppScore || 0) / oppMax) * 100) : null
            const iWon = bothDone && myPct !== null && oppPct !== null && myPct > oppPct
            const tied = bothDone && myPct !== null && oppPct !== null && myPct === oppPct

            return (
              <div key={d.duel_id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: bothDone ? 10 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>You vs {opponentName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.subject} · {d.question_count} questions</div>
                  </div>
                  {!myCompleted && (
                    <button onClick={() => router.push(`/student/self-mock/${myMockId}`)} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>
                      Resume
                    </button>
                  )}
                </div>

                {bothDone ? (
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: iWon ? 'var(--success)' : tied ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{myPct}%</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>You{iWon ? ' — winner' : ''}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: !iWon && !tied ? 'var(--success)' : 'var(--text-secondary)' }}>{oppPct}%</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{opponentName}{!iWon && !tied ? ' — winner' : ''}</div>
                    </div>
                    {tied && <div style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>Tied!</div>}
                  </div>
                ) : myCompleted ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Waiting for {opponentName} to finish…</div>
                ) : null}
              </div>
            )
          })}
        </DuelSection>
      )}
    </div>
  )
}

function DuelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}
