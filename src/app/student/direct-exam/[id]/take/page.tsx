'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ScientificCalculator from '@/components/ScientificCalculator'

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array]
  const random = mulberry32(seed)
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function questionSeed(sessionSeed: number, questionId: string): number {
  let hash = sessionSeed
  for (let i = 0; i < questionId.length; i++) {
    hash = (hash * 31 + questionId.charCodeAt(i)) % 1000000
  }
  return hash
}

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  options: string[] | null
  correct_answer: string | null
  order_index: number
  marking_points: { text: string; keywords: string[]; marks: number }[] | null
  total_marks: number | null
}

type SessionInfo = {
  id: string
  status: string
  started_at: string
  time_limit_seconds: number
  tab_switch_count: number
  option_shuffle_seed: number | null
}

type ExamInfo = {
  id: string
  title: string
  questions_per_page: number
  calculator_enabled: boolean
  exam_kind: string
}

export default function TakeDirectExamPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<ExamInfo | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [workings, setWorkings] = useState<Record<string, string>>({})
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [calculatorEnabled, setCalculatorEnabled] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [warning, setWarning] = useState('')
  const [inFullscreen, setInFullscreen] = useState(false)
  const [showWarningOverlay, setShowWarningOverlay] = useState(false)
  const [warningReason, setWarningReason] = useState('')
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  const [studentProfile, setStudentProfile] = useState<{ full_name: string; student_id: string | null } | null>(null)

  const violationCount = useRef(0)
  const hasBeenFullscreenRef = useRef(false)
  const submittedRef = useRef(false)
  const intentionalExitRef = useRef(false)

  // Homework and assignments are meant to be done at home, on the student's
  // own time — no countdown pressure, no fullscreen/tab-switch proctoring,
  // no 3-strike auto-submit. Everything else (exams, tests, pop quizzes)
  // keeps the full timed, proctored behavior.
  const isRelaxedExam = exam?.exam_kind === 'homework' || exam?.exam_kind === 'assignment'

  // Always hide sidebar on take page
  useEffect(() => {
    const sidebar = document.querySelector('.portal-layout > *:first-child') as HTMLElement
    const portalContent = document.querySelector('.portal-content') as HTMLElement
    if (sidebar) sidebar.style.display = 'none'
    if (portalContent) { portalContent.style.marginLeft = '0'; portalContent.style.maxWidth = '100%' }
    return () => {
      if (sidebar) sidebar.style.display = ''
      if (portalContent) { portalContent.style.marginLeft = ''; portalContent.style.maxWidth = '' }
    }
  }, [])

  // Block keyboard shortcuts, copy, paste during exam
  useEffect(() => {
    if (!session) return
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.altKey) && e.key === 'Tab') { e.preventDefault(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'w' || e.key === 'q')) { e.preventDefault(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 't')) { e.preventDefault(); return }
      if (e.key === 'F11') { e.preventDefault(); return }
      if (e.key === 'Escape' && !submittedRef.current) { e.preventDefault(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'x')) { e.preventDefault(); return }
    }
    function handleContextMenu(e: MouseEvent) { e.preventDefault() }
    function handleSelectStart(e: Event) { e.preventDefault() }
    function handleCopy(e: ClipboardEvent) { e.preventDefault() }
    function handlePaste(e: ClipboardEvent) { e.preventDefault() }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('selectstart', handleSelectStart)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
    }
  }, [session])

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, student_id')
      .eq('id', user.id)
      .single()
    if (profileData) setStudentProfile(profileData)

    const { data: sessionData, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('id, status, started_at, time_limit_seconds, tab_switch_count, option_shuffle_seed')
      .eq('draft_exam_id', examId)
      .eq('student_id', user.id)
      .single()

    if (sessionError || !sessionData) { router.push(`/student/direct-exam/${examId}`); return }
    if (sessionData.status === 'completed') { router.push('/student'); return }

    setSession(sessionData)
    violationCount.current = sessionData.tab_switch_count || 0

    const startedAt = new Date(sessionData.started_at).getTime()
    const deadline = startedAt + sessionData.time_limit_seconds * 1000
    setSecondsLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))

    const { data: examData, error: examError } = await supabase
      .from('draft_exams')
      .select('id, title, questions_per_page, calculator_enabled, exam_kind')
      .eq('id', examId)
      .single()

    if (examError) { setErrorMsg(examError.message); setLoading(false); return }
    setExam(examData)
    if (examData?.calculator_enabled) setCalculatorEnabled(true)

    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('id, question_type, question_text, points, options, correct_answer, order_index, marking_points, total_marks, image_url, show_working')
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: true })

    if (questionError) { setErrorMsg(questionError.message); setLoading(false); return }
    setQuestions(questionData || [])

    const { data: existingAnswers } = await supabase
      .from('responses')
      .select('question_id, answer')
      .eq('session_id', sessionData.id)

    const answerMap: Record<string, string> = {}
    ;(existingAnswers || []).forEach((a) => { answerMap[a.question_id] = a.answer })
    setAnswers(answerMap)

    setLoading(false)
  }

  useEffect(() => {
    if (!session || isRelaxedExam) return
    const interval = setInterval(() => {
      const startedAt = new Date(session.started_at).getTime()
      const deadline = startedAt + session.time_limit_seconds * 1000
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0 && !submittedRef.current) {
        submittedRef.current = true
        intentionalExitRef.current = true
        handleSubmit()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [session, isRelaxedExam])

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    if (isRelaxedExam) return
    function handleFullscreenChange() {
      const isFull = !!document.fullscreenElement
      setInFullscreen(isFull)
      if (isFull) hasBeenFullscreenRef.current = true
      if (!isFull && !submittedRef.current && !intentionalExitRef.current && hasBeenFullscreenRef.current) {
        setWarningReason('You exited fullscreen mode.')
        setShowWarningOverlay(true)
        registerViolation('exited fullscreen')
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [session, isRelaxedExam])

  useEffect(() => {
    if (isRelaxedExam) return
    function handleVisibilityChange() {
      if (document.hidden && !submittedRef.current && !intentionalExitRef.current) {
        setWarningReason('You switched tabs or minimized the window.')
        setShowWarningOverlay(true)
        registerViolation('switched tabs or minimized window')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session, isRelaxedExam])

  async function registerViolation(reason: string) {
    if (!session) return
    violationCount.current += 1
    const count = violationCount.current
    const logEntry = { reason, timestamp: new Date().toISOString(), count }
    await supabase.rpc('append_violation_log', { session_id: session.id, entry: logEntry })
    await supabase.from('exam_sessions').update({ tab_switch_count: count, flagged: true }).eq('id', session.id)
    if (count >= 3) {
      setWarning(`This is violation ${count} (${reason}). Your exam is being submitted automatically.`)
      if (!submittedRef.current) { submittedRef.current = true; intentionalExitRef.current = true; handleSubmit() }
    } else {
      setWarning(`Warning ${count}/3: ${reason}. Reaching 3 violations will auto-submit your exam.`)
    }
  }

  function updateWorking(questionId: string, value: string) {
    setWorkings(prev => ({ ...prev, [questionId]: value }))
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function gradeMultiPoint(question: Question, answers: string[]): number {
    if (!question.marking_points || question.marking_points.length === 0) return 0
    let totalAwarded = 0
    const maxMarks = question.points
    for (const point of question.marking_points) {
      if (!point.keywords || point.keywords.length === 0) continue
      const matched = answers.some((ans) => {
        const ansLower = ans.toLowerCase().trim()
        return point.keywords.some((kw: string) => ansLower.includes(kw.toLowerCase()))
      })
      if (matched) totalAwarded += point.marks
    }
    return Math.min(totalAwarded, maxMarks)
  }

  function gradeAnswer(question: Question, studentAnswer: string): number | null {
    const autoGradable = ['multiple_choice', 'true_false', 'short_answer', 'fill_blank']
    if (!autoGradable.includes(question.question_type)) return null

    if (question.marking_points && question.marking_points.length > 0) {
      const answers = studentAnswer.split('\n').map(a => a.trim()).filter(Boolean)
      if (answers.length === 0) answers.push(studentAnswer)
      return gradeMultiPoint(question, answers)
    }

    if (!question.correct_answer) return 0
    return studentAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()
      ? question.points : 0
  }

  async function handleSubmit() {
    if (!session) return
    setSubmitting(true)
    setErrorMsg('')

    let autoScore = 0
    let autoMax = 0
    let hasEssay = false

    const rows = questions.map((q) => {
      const studentAnswer = answers[q.id] || ''
      const awarded = gradeAnswer(q, studentAnswer)
      if (awarded === null) hasEssay = true
      else autoScore += awarded
      autoMax += q.points
      return { session_id: session.id, question_id: q.id, answer: studentAnswer, working: workings[q.id] || null, points_awarded: awarded, graded_at: awarded !== null ? new Date().toISOString() : null }
    })

    await supabase.from('responses').delete().eq('session_id', session.id)
    if (rows.length > 0) {
      const { error } = await supabase.from('responses').insert(rows)
      if (error) { setErrorMsg(error.message); setSubmitting(false); return }
    }

    const { error: sessionError } = await supabase
      .from('exam_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString(), total_score: autoScore, max_possible_score: autoMax, fully_graded: !hasEssay })
      .eq('id', session.id)

    if (sessionError) { setErrorMsg(sessionError.message); setSubmitting(false); return }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    router.push(`/student/direct-exam/${examId}/submitted`)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!exam || !session) return <div className="page-container">Exam not found.</div>

  const qpp = exam.questions_per_page || 10
  const totalPages = Math.ceil(questions.length / qpp)
  const pageQuestions = questions.slice(currentPage * qpp, (currentPage + 1) * qpp)
  const isLastPage = currentPage === totalPages - 1
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeLow = secondsLeft < 300
  const answeredCount = questions.filter((q) => answers[q.id]).length

  return (
    <div onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onPaste={(e) => e.preventDefault()}>

      {showWarningOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 440, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: '0 0 10px', color: '#c0392b' }}>Security Warning</h2>
            <p style={{ fontSize: 15, margin: '0 0 8px' }}>{warningReason}</p>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px' }}>
              This is a monitored exam. Exiting the exam window is not permitted.
            </p>
            <button
              onClick={() => { setShowWarningOverlay(false); if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen() }}
              style={{ background: '#c0392b', color: 'white', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Return to exam
            </button>
          </div>
        </div>
      )}
      <div className="page-container" style={{ maxWidth: 640, userSelect: 'none' }}>
      {studentProfile && (
        <div style={{
          background: 'var(--border)',
          borderRadius: 6,
          padding: '6px 12px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          letterSpacing: 0.3,
        }}>
          <span>{studentProfile.full_name}</span>
          {studentProfile.student_id && <span>ID: {studentProfile.student_id}</span>}
        </div>
      )}
      <div style={{ position: 'sticky', top: 0, background: 'var(--page-bg)', padding: '12px 0', borderBottom: '2px solid var(--border-strong)', marginBottom: 20, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>{exam.title}</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              {answeredCount} of {questions.length} answered · Page {currentPage + 1} of {totalPages}
            </p>
          </div>
          {!isRelaxedExam && (
            <div style={{ fontSize: 24, fontWeight: 700, color: timeLow ? 'var(--danger)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
          )}
        </div>
        {!isRelaxedExam && !inFullscreen && hasBeenFullscreenRef.current && (
          <button onClick={enterFullscreen} className="btn btn-secondary" style={{ marginTop: 8 }}>
            Re-enter fullscreen
          </button>
        )}
      </div>

      {warning && <div className="banner banner-danger" style={{ marginBottom: 16, fontWeight: 700 }}>{warning}</div>}

      <div className="exam-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {pageQuestions.map((q, i) => {
          const globalIndex = currentPage * qpp + i
          return (
            <div key={q.id} className="card">
              <p style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>
                {globalIndex + 1}. {q.question_text}
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }}>({q.points} pt{q.points !== 1 ? 's' : ''})</span>
              </p>

              {(q as any).image_url && (
                <div style={{ marginBottom: 12 }}>
                  <img src={(q as any).image_url} alt="Question diagram" style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8, border: '1px solid var(--border)' }} />
                </div>
              )}

              {q.question_type === 'multiple_choice' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {seededShuffle(q.options, questionSeed(session.option_shuffle_seed || 1, q.id)).map((opt, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: answers[q.id] === opt ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === opt ? 'var(--accent)' : 'var(--border)'}` }}>
                      <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => updateAnswer(q.id, opt)} style={{ accentColor: 'var(--accent)' }} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === 'true_false' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {['true', 'false'].map((val) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 16px', borderRadius: 8, background: answers[q.id] === val ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === val ? 'var(--accent)' : 'var(--border)'}` }}>
                      <input type="radio" name={q.id} checked={answers[q.id] === val} onChange={() => updateAnswer(q.id, val)} style={{ accentColor: 'var(--accent)' }} />
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === 'short_answer' && (q as any).show_working && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Show your working</label>
                  <textarea
                    value={workings[q.id] || ''}
                    onChange={(e) => updateWorking(q.id, e.target.value)}
                    rows={5}
                    style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: 14 }}
                    placeholder="Show all your working here — steps, calculations…"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Your working is visible to your teacher but does not affect automatic grading.</div>
                </div>
              )}
              {q.question_type === 'short_answer' && (q as any).show_working && (
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Final answer</label>
              )}
              {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
                <div>
                  {q.marking_points && q.marking_points.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.from({ length: q.points }).map((_, boxIndex) => {
                        const currentAnswers = (answers[q.id] || '').split('\n')
                        return (
                          <div key={boxIndex} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 20 }}>{boxIndex + 1}.</span>
                            <input
                              value={currentAnswers[boxIndex] || ''}
                              onChange={(e) => {
                                const updated = (answers[q.id] || '').split('\n')
                                updated[boxIndex] = e.target.value
                                updateAnswer(q.id, updated.join('\n'))
                              }}
                              style={{ flex: 1 }}
                              placeholder={`Answer ${boxIndex + 1}…`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <input value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)} style={{ width: '100%' }} placeholder="Your answer…" />
                  )}
                </div>
              )}

              {q.question_type === 'essay' && (
                <div>
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                    rows={8}
                    style={{ width: '100%', resize: 'vertical', minHeight: 160 }}
                    placeholder="Write your response here…"
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {(answers[q.id] || '').length} characters
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => { setCurrentPage((p) => Math.max(0, p - 1)); window.scrollTo(0, 0) }}
          disabled={currentPage === 0}
          className="btn btn-ghost"
        >
          ← Previous
        </button>

        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
          Page {currentPage + 1} of {totalPages}
        </span>

        {isLastPage ? (
          !confirmingSubmit ? (
            <button onClick={() => setConfirmingSubmit(true)} disabled={submitting} className="btn btn-primary">
              Submit exam
            </button>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Submit now? You can't change answers after this.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmingSubmit(false)} className="btn btn-ghost">Cancel</button>
                <button onClick={() => { intentionalExitRef.current = true; submittedRef.current = true; handleSubmit() }} disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Submitting…' : 'Yes, submit'}
                </button>
              </div>
            </div>
          )
        ) : (
          <button
            onClick={() => { setCurrentPage((p) => Math.min(totalPages - 1, p + 1)); window.scrollTo(0, 0) }}
            className="btn btn-primary"
          >
            Next →
          </button>
        )}
      </div>
    </div>
      {calculatorEnabled && <ScientificCalculator />}
      </div>
  )
}