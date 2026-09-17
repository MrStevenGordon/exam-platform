'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mergeIntegrityFlags, AiReview, INTEGRITY_FLAG_LABELS } from '@/lib/essayIntegrity'
import AiOpinionButton from '@/components/AiOpinionButton'

type FlaggedResponse = {
  id: string
  answer: string
  studentName: string
  examTitle: string
  flags: string[]
  aiReview: AiReview | null
}

// RLS on exam_sessions/responses does all the department/ownership scoping
// here -- supervisors and admins run the exact same query and each just see
// what they're allowed to see, same convention as the report card feature.
export default function IntegrityDashboard() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<FlaggedResponse[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load integrity dashboard', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDataInner() {
    const [{ data: finalSessions }, { data: draftSessions }] = await Promise.all([
      supabase.from('exam_sessions')
        .select('id, profiles!exam_sessions_student_id_fkey(full_name), final_exams(title), responses(id, answer, integrity_signals, ai_review, questions(question_type))')
        .not('final_exam_id', 'is', null),
      supabase.from('exam_sessions')
        .select('id, profiles!exam_sessions_student_id_fkey(full_name), draft_exams(title), responses(id, answer, integrity_signals, ai_review, questions(question_type))')
        .not('draft_exam_id', 'is', null),
    ])

    const flagged: FlaggedResponse[] = []

    for (const session of [...(finalSessions || []), ...(draftSessions || [])] as any[]) {
      const studentName = session.profiles?.full_name || 'Unknown'
      const examTitle = session.final_exams?.title || session.draft_exams?.title || 'Unknown exam'
      for (const r of session.responses || []) {
        if (r.questions?.question_type !== 'essay') continue
        const flags = mergeIntegrityFlags(r.integrity_signals)
        if (flags.length === 0) continue
        flagged.push({ id: r.id, answer: r.answer, studentName, examTitle, flags, aiReview: r.ai_review || null })
      }
    }

    flagged.sort((a, b) => b.flags.length - a.flags.length)
    setItems(flagged)
    setLoading(false)
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <p className="portal-page-title" style={{ margin: 0 }}>Writing Integrity</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>{items.length} flagged essay response{items.length !== 1 ? 's' : ''}</p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 640 }}>
        These are heuristic signals based on how each answer was typed, not proof of misconduct. Always use your own judgment.
      </p>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No flagged essay responses right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{item.studentName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {item.examTitle} · {item.flags.length} signal{item.flags.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>{expanded === item.id ? '▲' : '▼'}</span>
              </div>

              {expanded === item.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--page-bg)' }}>
                  <div style={{ padding: 12, background: 'var(--card-bg)', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)', fontSize: 14 }}>
                    {item.answer || <em style={{ color: 'var(--text-secondary)' }}>No answer provided</em>}
                  </div>
                  <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.flags.map((f) => <li key={f}>{INTEGRITY_FLAG_LABELS[f] || f}</li>)}
                  </ul>
                  <AiOpinionButton responseId={item.id} initialReview={item.aiReview} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
