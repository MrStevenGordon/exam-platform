'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  marking_points?: any[] | null
  total_marks?: number | null
  section_id?: string | null
  image_url?: string | null
  show_working?: boolean | null
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
}

export default function TakeExamPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<ExamInfo | null>(null)
  const [sections, setSections] = useState<{ id: string; name: string; instructions: string; order_index: number }[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [workings, setWorkings] = useState<Record<string, string>>({})
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
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
      .eq('final_exam_id', examId)
      .eq('student_id', user.id)
      .single()

    if (sessionError || !sessionData) { router.push(`/student/exam/${examId}`); return }
    if (sessionData.status === 'completed') { router.push('/student'); return }

    setSession(sessionData)
    violationCount.current = sessionData.tab_switch_count || 0

    const startedAt = new Date(sessionData.started_at).getTime()
    const deadline = startedAt + sessionData.time_limit_seconds * 1000
    setSecondsLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))

    const { data: examData, error: examError } = await supabase
      .from('final_exams')
      .select('id, title, questions_per_page')
      .eq('id', examId)
      .single()

    if (examError) { setErrorMsg(examError.message); setLoading(false); return }
    setExam(examData)

    const { data: sectionData } = await supabase
      .from('exam_sections')
      .select('id, name, instructions, order_index, question_type')
      .eq('final_exam_id', examId)
      .order('order_index', { ascending: true })
    setSections(sectionData || [])

    const { data: linkData, error: linkError } = await supabase
      .from('final_exam_questions')
      .select('order_index, questions(id, question_type, question_text, points, options, correct_answer, marking_points, total_marks, section_id, image_url, show_working)')
      .eq('final_exam_id', examId)
      .order('order_index', { ascending: true })

    if (linkError) { setErrorMsg(linkError.message); setLoading(false); return }

    const qs = (linkData || []).map((l: any) => {
      const q = Array.isArray(l.questions) ? l.questions[0] : l.questions
      if (!q) return null
      return {
        id: q.id,
        question_type: q.question_type,
        question_text: q.question_text,
        points: q.points,
        options: q.options,
        correct_answer: q.correct_answer,
        marking_points: q.marking_points,
        total_marks: q.total_marks,
        section_id: q.section_id,
        image_url: q.image_url,
        show_working: q.show_working,
        order_index: l.order_index,
      }
    }).filter((q: any) => q && q.id) as Question[]
    setQuestions(qs)

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
    if (!session) return
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
  }, [session])

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
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
  }, [session])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !submittedRef.current && !intentionalExitRef.current) registerViolation('switched tabs or minimized window')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session])

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

  // Block keyboard shortcuts and right-click
  useEffect(() => {
    if (!session) return

    function handleKeyDown(e: KeyboardEvent) {
      // Block Tab switching: Cmd+Tab, Alt+Tab
      if ((e.metaKey || e.altKey) && e.key === 'Tab') { e.preventDefault(); return }
      // Block closing: Cmd+W, Cmd+Q, Alt+F4
      if ((e.metaKey || e.ctrlKey) && (e.key === 'w' || e.key === 'q')) { e.preventDefault(); return }
      // Block new window/tab: Cmd+N, Cmd+T
      if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 't')) { e.preventDefault(); return }
      // Block F11 (fullscreen toggle)
      if (e.key === 'F11') { e.preventDefault(); return }
      // Block Escape (exits fullscreen)
      if (e.key === 'Escape' && !submittedRef.current) { e.preventDefault(); return }
      // Block copy/paste
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'v' || e.key === 'a')) { e.preventDefault(); return }
    }

    function handleContextMenu(e: MouseEvent) { e.preventDefault() }
    function handleSelectStart(e: Event) { e.preventDefault() }
    function handleCopy(e: ClipboardEvent) { e.preventDefault() }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('selectstart', handleSelectStart)
    document.addEventListener('copy', handleCopy)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('copy', handleCopy)
    }
  }, [session])

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
      // Check each answer box against this marking point
      const matched = answers.some((ans) => {
        const ansLower = ans.toLowerCase().trim()
        return point.keywords.some((kw: string) => ansLower.includes(kw.toLowerCase()))
      })
      if (matched) totalAwarded += point.marks
    }
    // Cap at question maximum marks
    return Math.min(totalAwarded, maxMarks)
  }

  function gradeAnswer(question: Question, studentAnswer: string): number | null {
    const autoGradable = ['multiple_choice', 'true_false', 'short_answer', 'fill_blank']
    if (!autoGradable.includes(question.question_type)) return null

    // Multi-point marking uses separate gradeMultiPoint function
    if (question.marking_points && question.marking_points.length > 0) {
      // For single answer box, split by newline or comma to check multiple answers
      const answers = studentAnswer.split(/\n|,/).map(a => a.trim()).filter(Boolean)
      if (answers.length === 0) answers.push(studentAnswer)
      return gradeMultiPoint(question, answers)
    }

    // Single exact match — case insensitive
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
      // For multi-point questions, grade using all answer boxes
      let awarded: number | null
      if (q.marking_points && q.marking_points.length > 0) {
        const answerBoxes = studentAnswer.split('\n').map((a: string) => a.trim()).filter(Boolean)
        awarded = gradeMultiPoint(q, answerBoxes.length > 0 ? answerBoxes : [studentAnswer])
      } else {
        awarded = gradeAnswer(q, studentAnswer)
      }
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
    router.push(`/student/exam/${examId}/submitted`)
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
    <div onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()}>

      {/* Warning overlay */}
      {showWarningOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 440, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: '0 0 10px', color: '#c0392b' }}>Security Warning</h2>
            <p style={{ fontSize: 15, margin: '0 0 8px' }}>{warningReason}</p>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px' }}>
              This is a monitored exam. Exiting the exam window is not permitted.
              {violationCount.current < 3 && ` You have ${3 - violationCount.current} warning${3 - violationCount.current !== 1 ? 's' : ''} remaining before auto-submit.`}
            </p>
            <button
              onClick={() => { setShowWarningOverlay(false); enterFullscreen() }}
              style={{ background: '#c0392b', color: 'white', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Return to exam
            </button>
          </div>
        </div>
      )}
      <div className="page-container" style={{ maxWidth: 640, userSelect: 'none' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--page-bg)', padding: '12px 0', borderBottom: '2px solid var(--border-strong)', marginBottom: 20, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>{exam.title}</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              {answeredCount} of {questions.length} answered · Page {currentPage + 1} of {totalPages}
            </p>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: timeLow ? 'var(--danger)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
        {!inFullscreen && hasBeenFullscreenRef.current && (
          <button onClick={enterFullscreen} className="btn btn-secondary" style={{ marginTop: 8 }}>
            Re-enter fullscreen
          </button>
        )}
      </div>

      {warning && <div className="banner banner-danger" style={{ marginBottom: 16, fontWeight: 700 }}>{warning}</div>}

      {/* Questions for current page */}
      {sections.length > 0 && currentPage === 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Exam sections</div>
          {sections.map((s, i) => (
            <div key={s.id} style={{ marginBottom: 10, padding: '14px 16px', background: 'var(--card-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Section {String.fromCharCode(65 + i)}: {s.name}</div>
              {s.instructions && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{s.instructions}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="exam-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {pageQuestions.map((q, i) => {
          const globalIndex = currentPage * qpp + i
          // Determine section for this question based on equal distribution
          // Determine section for this question
          // If section has question_type, match by type; otherwise use position
          const getSectionForQuestion = (qItem: typeof q, idx: number) => {
            for (let si = 0; si < sections.length; si++) {
              const s = sections[si] as any
              if (s.question_type && qItem.question_type === s.question_type) return { section: s, sectionIndex: si }
            }
            // Fallback: equal distribution
            const qpp2 = Math.ceil(questions.length / Math.max(sections.length, 1))
            const si = Math.floor(idx / qpp2)
            return si < sections.length ? { section: sections[si], sectionIndex: si } : { section: null, sectionIndex: -1 }
          }
          const { section, sectionIndex } = getSectionForQuestion(q, globalIndex)
          const prevQ2 = questions[globalIndex - 1]
          const { sectionIndex: prevSectionIndex } = prevQ2 ? getSectionForQuestion(prevQ2, globalIndex - 1) : { sectionIndex: -1 }
          const showSectionHeader = section && sectionIndex !== prevSectionIndex
          return (
            <div key={q.id}>
              {showSectionHeader && section && (
                <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid var(--accent)' }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--accent-dark)' }}>
                    Section {String.fromCharCode(65 + sectionIndex)}: {section.name}
                  </div>
                  {section.instructions && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{section.instructions}</div>
                  )}
                </div>
              )}
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: q.image_url ? 8 : 12, fontSize: 15 }}>
                {globalIndex + 1}. {q.question_text}
              </p>

              {(q as any).image_url && (
                <div style={{ marginBottom: 12 }}>
                  <img
                    src={(q as any).image_url}
                    alt="Question diagram"
                    style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Show your working
                  </label>
                  <textarea
                    value={workings[q.id] || ''}
                    onChange={(e) => updateWorking(q.id, e.target.value)}
                    rows={5}
                    style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: 14 }}
                    placeholder="Show all your working here — steps, calculations, diagrams described in words…"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Your working is visible to your teacher but does not affect automatic grading.
                  </div>
                </div>
              )}

              {(q.question_type === 'short_answer' && (q as any).show_working) && (
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                  Final answer
                </label>
              )}

              {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
                <div>
                  {q.marking_points && q.marking_points.length > 0 ? (
                    // Multiple answer boxes — one per required answer (based on question points)
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
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                    rows={8}
                    style={{
                      width: '100%',
                      minHeight: 200,
                      resize: 'vertical',
                      display: 'block',
                      padding: '10px 12px',
                      fontSize: 15,
                      fontFamily: 'inherit',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius)',
                      background: 'white',
                      color: 'var(--text-primary)',
                      lineHeight: 1.6,
                    }}
                    placeholder="Write your response here…"
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {(answers[q.id] || '').length} characters · Essay questions are manually graded by your teacher
                  </div>
                </div>
              )}
            </div>
            </div>
          )
        })}
      </div>

      {/* Page navigation */}
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
      </div>
  )
}
