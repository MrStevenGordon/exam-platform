'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { INTEGRITY_FLAG_LABELS } from '@/hooks/useIntegrityCapture'
import { mergeIntegrityFlags, AiReview } from '@/lib/essayIntegrity'
import AiOpinionButton from '@/components/AiOpinionButton'
import { isEssayRubricAvailable } from '@/lib/essayRubric'
import AiSuggestionPanel from '@/components/AiSuggestionPanel'
import { fetchUsage, isEssayAiMarkingAvailable, loadSuggestions, recordFinalMarks, requestSuggestion, type Usage } from '@/lib/essayMarking'
import { runPool, type MarkingPoint, type Suggestion } from '@/lib/essayMarkingPure'
import { parseStoredRubric } from '@/lib/essayRubricPure'

type UngradedResponse = {
  overrideScore?: number
  // the per-point marks the teacher saved, so they can be compared with the AI's suggestion
  finalMarks?: number[]
  response_id: string
  session_id: string
  answer: string
  working?: string | null
  question_text: string
  points: number
  student_name: string
  exam_title: string
  marking_points?: any[] | null
  // true when the points are an essay's own marking points: no keywords, and every point is marked by the teacher
  essayPoints?: boolean
  total_marks?: number | null
  integrityFlags: string[]
  aiReview: AiReview | null
}

export default function GradeEssaysPage() {
  const router = useRouter()
  const [items, setItems] = useState<UngradedResponse[]>([])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [savingId, setSavingId] = useState('')

  // AI-suggested marks (only when the school has switched them on and migration 082 is installed)
  const [aiOn, setAiOn] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({})
  const [aiBusy, setAiBusy] = useState<Record<string, boolean>>({})
  const [aiError, setAiError] = useState<Record<string, string>>({})
  const [usage, setUsage] = useState<Usage | null>(null)
  const [batch, setBatch] = useState<{ done: number; total: number; running: boolean; stopped?: string; failed: number } | null>(null)

  useEffect(() => {
    loadData()
  }, [])
  useEffect(() => { isEssayAiMarkingAvailable().then(setAiOn) }, [])
  useEffect(() => { if (aiOn) fetchUsage().then(setUsage) }, [aiOn])
  useEffect(() => {
    if (!aiOn || items.length === 0) return
    loadSuggestions(items.map((i) => i.response_id)).then((found) => setSuggestions((prev) => ({ ...found, ...prev })))
  }, [aiOn, items])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load essays to grade', err)
      setErrorMsg('Something went wrong loading essays. Please try again.')
      setLoading(false)
    }
  }

  async function loadDataInner() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // An essay's marking points need migration 081; ask for the column only once it exists.
    const rubricOn = await isEssayRubricAvailable()
    const columns: string = `
        id, answer, working, session_id, points_awarded, integrity_signals, ai_review,
        questions(question_text, points, question_type, marking_points${rubricOn ? ', essay_rubric' : ''}),
        exam_sessions(profiles!exam_sessions_student_id_fkey(full_name), final_exams(title), draft_exams(title))
      `
    const { data, error } = await supabase
      .from('responses')
      .select(columns)
      .is('points_awarded', null)

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    const essayOnly = ((data || []) as any[])
      .filter((r: any) => r.questions?.question_type === 'essay')
      .map((r: any) => ({
        response_id: r.id,
        session_id: r.session_id,
        marking_points: r.questions?.marking_points || (parseStoredRubric(r.questions?.essay_rubric).length > 0 ? parseStoredRubric(r.questions?.essay_rubric) : null),
        essayPoints: !r.questions?.marking_points && parseStoredRubric(r.questions?.essay_rubric).length > 0,
        answer: r.answer,
        working: r.working,
        question_text: r.questions.question_text,
        points: r.questions.points,
        student_name: r.exam_sessions?.profiles?.full_name || 'Unknown',
        exam_title: r.exam_sessions?.final_exams?.title || r.exam_sessions?.draft_exams?.title || 'Unknown exam',
        integrityFlags: mergeIntegrityFlags(r.integrity_signals),
        aiReview: r.ai_review || null,
      }))

    setItems(essayOnly)
    setLoading(false)
  }

  function updateScore(responseId: string, value: string) {
    setScores({ ...scores, [responseId]: value })
  }

  // Asks the AI for one essay. Returns whether it worked so "Suggest marks for all" can stop when the allowance or the service runs out.
  async function suggest(item: UngradedResponse, regenerate = false) {
    const id = item.response_id
    setAiBusy((b) => ({ ...b, [id]: true }))
    setAiError((e) => { const { [id]: _removed, ...rest } = e; void _removed; return rest })
    const r = await requestSuggestion(id, regenerate)
    if (r.ok) {
      setSuggestions((prev) => ({ ...prev, [id]: r.suggestion }))
      setUsage(r.usage)
    } else {
      setAiError((e) => ({ ...e, [id]: r.error }))
      if (r.usage) setUsage(r.usage)
    }
    setAiBusy((b) => ({ ...b, [id]: false }))
    return r
  }

  // Copies the suggestion into the teacher's own mark boxes. Nothing is saved until they press Save.
  function applySuggestion(item: UngradedResponse, marks: number[]) {
    setScores((prev) => {
      const next = { ...prev }
      marks.forEach((m, pi) => { next[`${item.response_id}_${pi}`] = String(m) })
      return next
    })
  }

  async function suggestForAll() {
    const todo = items.filter((i) => i.essayPoints && !suggestions[i.response_id])
    if (todo.length === 0) return
    setBatch({ done: 0, total: todo.length, running: true, failed: 0 })
    let stopMessage: string | undefined
    const result = await runPool(todo, 3, async (it) => {
      const r = await suggest(it)
      if (!r.ok && (r.limitReached || r.creditProblem || r.switchedOff)) stopMessage = r.error
      setBatch((b) => (b ? { ...b, done: b.done + 1, failed: b.failed + (r.ok ? 0 : 1) } : b))
    }, () => stopMessage !== undefined)
    setBatch((b) => (b ? { ...b, running: false, stopped: stopMessage, failed: Math.max(b.failed, result.failed) } : b))
  }

  async function handleSaveGrade(item: UngradedResponse) {
    // "Save all points" passes the total it has just added up; setScores has not applied yet, so reading scores[] here would be stale.
    const value = item.overrideScore !== undefined ? item.overrideScore : parseFloat(scores[item.response_id])
    if (isNaN(value) || value < 0 || value > item.points) {
      alert(`Enter a valid score between 0 and ${item.points}.`)
      return
    }

    setSavingId(item.response_id)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('responses')
      .update({
        points_awarded: value,
        graded_by: user?.id,
        graded_at: new Date().toISOString(),
      })
      .eq('id', item.response_id)

    if (error) {
      alert(error.message)
      setSavingId('')
      return
    }

    // If the AI had suggested marks for this essay, keep the teacher's final marks beside the suggestion (best effort, never affects the marks).
    if (item.finalMarks && suggestions[item.response_id]) await recordFinalMarks(item.response_id, item.finalMarks, value)

    // Check if all responses for this session are now graded; if so, recompute total and mark fully_graded
    const { data: allResponses } = await supabase
      .from('responses')
      .select('points_awarded')
      .eq('session_id', item.session_id)

    const stillUngraded = (allResponses || []).some((r) => r.points_awarded === null)

    if (!stillUngraded) {
      const totalScore = (allResponses || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0)
      await supabase
        .from('exam_sessions')
        .update({ total_score: totalScore, fully_graded: true })
        .eq('id', item.session_id)
    }

    setSavingId('')
    loadData()
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div className="page-container">
      <h1 className="portal-page-title">Grade essay responses</h1>

      {aiOn && items.some((i) => i.essayPoints) && (
        <div className="card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>AI can suggest marks for your essays</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              It marks against your marking points and shows its reasons. You decide every mark.
              {usage ? ` ${usage.remaining} of ${usage.limit} suggestions left this month.` : ''}
            </div>
          </div>
          <button type="button" className="btn btn-secondary" disabled={batch?.running || items.filter((i) => i.essayPoints && !suggestions[i.response_id]).length === 0} onClick={suggestForAll}>
            Suggest marks for all ({items.filter((i) => i.essayPoints && !suggestions[i.response_id]).length})
          </button>
          {batch && (
            <div role="status" aria-live="polite" style={{ flexBasis: '100%', fontSize: 13, color: 'var(--text-secondary)' }}>
              {batch.running ? `Suggesting marks: ${batch.done} of ${batch.total} done…` : `Done: ${batch.done - batch.failed} suggested${batch.failed ? `, ${batch.failed} could not be suggested (see each essay)` : ''}.`}
              {batch.stopped && <span style={{ color: 'var(--warning)' }}> Stopped: {batch.stopped}</span>}
            </div>
          )}
        </div>
      )}

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}
      {items.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No ungraded responses</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>
            All caught up, or you may not have any classes assigned yet.
          </p>
          <a href="/teacher/profile" style={{ color: 'var(--accent-dark)', fontSize: 13, fontWeight: 700 }}>
            Set up my classes →
          </a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item) => (
          <div key={item.response_id} className="card">
            <p className="section-label" style={{ fontSize: 11, margin: 0 }}>
              {item.exam_title} · {item.student_name}
            </p>
            <p style={{ fontWeight: 700, margin: '8px 0' }}>{item.question_text}</p>
            <div style={{ padding: 12, background: 'var(--page-bg)', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }}>
              {item.answer || <em style={{ color: 'var(--text-secondary)' }}>No answer provided</em>}
            </div>

            {item.integrityFlags.length > 0 && (
              <details style={{ marginBottom: 12, background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 8, padding: '8px 12px' }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', cursor: 'pointer' }}>
                  ⚠ Possible AI-assisted writing · {item.integrityFlags.length} signal{item.integrityFlags.length !== 1 ? 's' : ''}
                </summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {item.integrityFlags.map((f) => <li key={f}>{INTEGRITY_FLAG_LABELS[f] || f}</li>)}
                </ul>
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  This is a heuristic signal based on how the answer was typed, not proof of misconduct. Use your judgment.
                </p>
                <AiOpinionButton responseId={item.response_id} initialReview={item.aiReview} />
              </details>
            )}

            {item.working && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Student working</div>
                <div style={{ padding: '10px 14px', background: '#F0F4FF', borderRadius: 8, border: '1px solid #C8D4F0', fontSize: 14, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {item.working}
                </div>
              </div>
            )}

            {aiOn && item.essayPoints && (
              <AiSuggestionPanel
                points={(item.marking_points || []) as MarkingPoint[]}
                suggestion={suggestions[item.response_id] ?? null}
                busy={!!aiBusy[item.response_id]}
                error={aiError[item.response_id] ?? null}
                onSuggest={() => suggest(item)}
                onRegenerate={() => suggest(item, true)}
                onUse={(marks) => applySuggestion(item, marks)}
                usage={usage}
              />
            )}
            {aiOn && !item.essayPoints && !item.marking_points && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>Add marking points to this question to get AI suggested marks.</p>
            )}

            {item.marking_points && item.marking_points.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Marking points: award marks per point</div>
                {item.marking_points.map((point: any, pi: number) => {
                  const answerLower = (item.answer || '').toLowerCase()
                  // Keyword matching only applies to points that have keywords. An essay's own marking points have none, so the teacher marks each one.
                  const autoMatched = item.essayPoints ? false : point.keywords?.some((kw: string) => answerLower.includes(kw.toLowerCase()))
                  const pointKey = `${item.response_id}_${pi}`
                  return (
                    <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px', background: autoMatched ? 'var(--success-bg)' : 'var(--card-bg)', borderRadius: 8, border: `1px solid ${autoMatched ? 'var(--success)' : 'var(--border)'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Point {pi + 1}: {point.text}</div>
                        {!item.essayPoints && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            Matched on: {point.keywords?.slice(0, 6).join(', ')}{point.keywords?.length > 6 ? '…' : ''} · {autoMatched ? '✓ Auto-matched' : '✗ Not matched'}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={point.marks}
                        step={0.5}
                        placeholder={`0-${point.marks}`}
                        value={scores[pointKey] ?? (item.essayPoints ? '' : autoMatched ? point.marks : 0)}
                        onChange={(e) => updateScore(pointKey, e.target.value)}
                        style={{ width: 70 }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>/ {point.marks} pt{point.marks !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <button
                    onClick={() => {
                      if (item.essayPoints) {
                        // Every point needs a mark, 0 if the answer earns none, so a box left empty is never saved as a zero by accident.
                        const bad = (item.marking_points || []).findIndex((p: { marks: number }, pi: number) => {
                          const raw = scores[`${item.response_id}_${pi}`]
                          const n = Number(raw)
                          return raw === undefined || raw === '' || isNaN(n) || n < 0 || n > p.marks
                        })
                        if (bad !== -1) {
                          alert(`Enter a mark for point ${bad + 1}, between 0 and ${(item.marking_points || [])[bad].marks}. Use 0 if the answer earns nothing for it.`)
                          return
                        }
                      }
                      const total = (item.marking_points || []).reduce((sum: number, _: any, pi: number) => {
                        const pointKey = `${item.response_id}_${pi}`
                        return sum + Number(scores[pointKey] ?? 0)
                      }, 0)
                      updateScore(item.response_id, String(total))
                      handleSaveGrade({ ...item, overrideScore: total, finalMarks: (item.marking_points || []).map((_: unknown, pi: number) => Number(scores[`${item.response_id}_${pi}`] ?? 0)) })
                    }}
                    disabled={savingId === item.response_id}
                    className="btn btn-primary"
                  >
                    {savingId === item.response_id ? 'Saving…' : 'Save all points'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total: {item.marking_points.reduce((s: number, p: any) => s + p.marks, 0)} pts</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  max={item.points}
                  step={0.5}
                  placeholder={`0 - ${item.points}`}
                  value={scores[item.response_id] || ''}
                  onChange={(e) => updateScore(item.response_id, e.target.value)}
                  style={{ width: 100 }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>/ {item.points} pts</span>
                <button onClick={() => handleSaveGrade(item)} disabled={savingId === item.response_id} className="btn btn-primary">
                  {savingId === item.response_id ? 'Saving…' : 'Save grade'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
