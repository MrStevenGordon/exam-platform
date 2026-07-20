'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type MemberRow = {
  studentId: string
  fullName: string
  sessionId: string | null
  status: string
  contribution: string
  score: string
  avgPeerRating: number | null
  ratingCount: number
}

export default function GroupGradingPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const groupId = params.groupId as string

  const [examTitle, setExamTitle] = useState('')
  const [groupName, setGroupName] = useState('')
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [maxScore, setMaxScore] = useState('100')
  const [applyAllScore, setApplyAllScore] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [groupId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: examData } = await supabase.from('draft_exams').select('title').eq('id', examId).single()
    setExamTitle(examData?.title || '')

    const { data: group } = await supabase
      .from('project_groups')
      .select('name, file_submission_url, file_submission_name')
      .eq('id', groupId)
      .single()

    if (group) {
      setGroupName(group.name)
      setFileUrl(group.file_submission_url)
      setFileName(group.file_submission_name)
    }

    const { data: allMembers } = await supabase
      .from('project_group_members')
      .select('student_id, profiles!project_group_members_student_id_fkey(id, full_name)')
      .eq('group_id', groupId)

    const { data: ratings } = await supabase
      .from('peer_ratings')
      .select('ratee_student_id, rating')
      .eq('group_id', groupId)

    const rows: MemberRow[] = []
    for (const m of allMembers || []) {
      const profile = (m as any).profiles
      if (!profile) continue

      const { data: session } = await supabase
        .from('exam_sessions')
        .select('id, status, contribution_statement, total_score, max_possible_score')
        .eq('draft_exam_id', examId)
        .eq('student_id', profile.id)
        .maybeSingle()

      const memberRatings = (ratings || []).filter((r) => r.ratee_student_id === profile.id)
      const avg = memberRatings.length > 0 ? memberRatings.reduce((s, r) => s + r.rating, 0) / memberRatings.length : null

      rows.push({
        studentId: profile.id,
        fullName: profile.full_name,
        sessionId: session?.id || null,
        status: session?.status || 'not started',
        contribution: session?.contribution_statement || '',
        score: session?.total_score != null ? String(session.total_score) : '',
        avgPeerRating: avg,
        ratingCount: memberRatings.length,
      })

      if (session?.max_possible_score) setMaxScore(String(session.max_possible_score))
    }

    rows.sort((a, b) => a.fullName.localeCompare(b.fullName))
    setMembers(rows)
    setLoading(false)
  }

  function updateScore(studentId: string, value: string) {
    setMembers((prev) => prev.map((m) => (m.studentId === studentId ? { ...m, score: value } : m)))
  }

  function applyToAll() {
    if (!applyAllScore.trim()) return
    setMembers((prev) => prev.map((m) => ({ ...m, score: applyAllScore.trim() })))
  }

  async function handleSaveAll() {
    setSaving(true)
    setErrorMsg('')

    for (const m of members) {
      if (!m.sessionId || m.score === '') continue
      const { error } = await supabase
        .from('exam_sessions')
        .update({ total_score: parseFloat(m.score), max_possible_score: parseFloat(maxScore) || 100, fully_graded: true })
        .eq('id', m.sessionId)
      if (error) { setErrorMsg(error.message); setSaving(false); return }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <Link href={`/teacher/exam/${examId}/groups`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to groups</Link>

      <h1 style={{ marginTop: 16 }}>{groupName}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{examTitle}</p>

      {saved && <div className="banner banner-success" style={{ marginBottom: 16 }}>Grades saved.</div>}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Shared submission</h2>
        {fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ display: 'inline-block' }}>
            📎 Download: {fileName}
          </a>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No file uploaded by this group yet.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Apply one grade to everyone</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            value={applyAllScore}
            onChange={(e) => setApplyAllScore(e.target.value)}
            placeholder="Score"
            style={{ width: 100 }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>out of</span>
          <input
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            style={{ width: 100 }}
          />
          <button onClick={applyToAll} className="btn btn-secondary">Apply to all</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
          You can still adjust an individual student's score below if their contribution warrants it.
        </p>
      </div>

      {members.map((m) => (
        <div key={m.studentId} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{m.fullName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {m.status === 'completed' ? 'Submitted' : 'Not yet submitted'}
                {m.avgPeerRating !== null && ` · Avg peer rating: ${m.avgPeerRating.toFixed(1)}/5 (${m.ratingCount} rating${m.ratingCount !== 1 ? 's' : ''})`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                value={m.score}
                onChange={(e) => updateScore(m.studentId, e.target.value)}
                placeholder="Score"
                style={{ width: 80 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ {maxScore}</span>
            </div>
          </div>
          {m.contribution ? (
            <p style={{ fontSize: 13, background: 'var(--page-bg)', padding: 10, borderRadius: 6, margin: 0 }}>{m.contribution}</p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No contribution statement submitted.</p>
          )}
        </div>
      ))}

      <button onClick={handleSaveAll} disabled={saving} className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
        {saving ? 'Saving…' : 'Save all grades'}
      </button>
    </div>
  )
}
