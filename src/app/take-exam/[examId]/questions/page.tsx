'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { gradeAnswer } from '@/lib/grading'
import {
  initExamRecord, getExamRecord, saveAnswersLocally, markSynced,
  setPendingSubmit as setPendingSubmitLocal, queueViolation, clearQueuedViolations, clearExamRecord,
} from '@/lib/examOfflineStore'

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
  marking_points?: { text: string; keywords: string[]; marks: number }[] | null
  order_index: number
}

type SessionInfo = {
  id: string
  started_at: string
  time_limit_seconds: number
  tab_switch_count: number
  option_shuffle_seed: number | null
}

export default function TakeExamQuestionsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [warning, setWarning] = useState('')
  const [inFullscreen, setInFullscreen] = useState(false)
  const [showWarningOverlay, setShowWarningOverlay] = useState(false)
  const [warningReason, setWarningReason] = useState('')
  const [submitPendingOffline, setSubmitPendingOffline] = useState(false)

  const violationCount = useRef(0)
  const handleSubmitRef = useRef<() => void>(() => {})
  const hasBeenFullscreenRef = useRef(false)
  const submittedRef = useRef(false)
  // Synchronous reentrancy guard for handleSubmit itself — see the matching
  // comment in student/direct-exam/[id]/take/page.tsx for why submittedRef
  // alone can't serve this purpose.
  const submitInFlightRef = useRef(false)
  const intentionalExitRef = useRef(false)
  const latestAnswersRef = useRef<Record<string, string>>({})
  const localSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load exam data', err)
      setErrorMsg('Something went wrong loading this exam. Please try again.')
      setLoading(false)
    }
  }

  async function loadDataInner() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/take-exam/${examId}`); return }

    const { data: sessionData, error: sessionError } = await supabase
      .from('org_exam_sessions')
      .select('id, submitted_at, started_at, time_limit_seconds, tab_switch_count, option_shuffle_seed')
      .eq('org_exam_id', examId)
      .eq('auth_user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionError || !sessionData) { router.push(`/take-exam/${examId}`); return }
    if (sessionData.submitted_at) { router.push(`/take-exam/${examId}/submitted`); return }

    const activeSession: SessionInfo = {
      id: sessionData.id,
      started_at: sessionData.started_at,
      time_limit_seconds: sessionData.time_limit_seconds || 3600,
      tab_switch_count: sessionData.tab_switch_count || 0,
      option_shuffle_seed: sessionData.option_shuffle_seed,
    }
    setSession(activeSession)
    violationCount.current = activeSession.tab_switch_count

    const startedAt = new Date(activeSession.started_at).getTime()
    const deadline = startedAt + activeSession.time_limit_seconds * 1000
    setSecondsLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))

    const { data: questionData, error: questionError } = await supabase
      .from('org_exam_questions')
      .select('id, question_type, question_text, points, options, correct_answer, marking_points, order_index')
      .eq('org_exam_id', examId)
      .order('order_index', { ascending: true })

    if (questionError) { setErrorMsg(questionError.message); setLoading(false); return }
    setQuestions(questionData || [])

    const { data: existingResponses } = await supabase
      .from('org_exam_responses')
      .select('question_id, answer')
      .eq('session_id', activeSession.id)

    const answerMap: Record<string, string> = {}
    ;(existingResponses || []).forEach((r) => { answerMap[r.question_id] = r.answer || '' })

    // Offline resilience: the local IndexedDB record may hold edits newer
    // than whatever last made it to the server. Merge those in, local
    // taking precedence.
    const localRecord = await initExamRecord(activeSession.id, examId)
    const mergedAnswers = { ...answerMap, ...(localRecord?.answers || {}) }

    latestAnswersRef.current = mergedAnswers
    setAnswers(mergedAnswers)
    await saveAnswersLocally(activeSession.id, mergedAnswers, {})

    if (localRecord?.pendingSubmit) {
      setSubmitPendingOffline(true)
      submittedRef.current = true
    }

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
        handleSubmitRef.current()
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
      if (document.hidden && !submittedRef.current && !intentionalExitRef.current) {
        setWarningReason('You switched tabs or minimized the window.')
        setShowWarningOverlay(true)
        registerViolation('switched tabs or minimized window')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session])

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

  // Progressive server sync: pushes locally-held answers up to Supabase
  // periodically and immediately on reconnect, so progress survives even if
  // the *final* submit is what fails.
  const syncToServer = useCallback(async () => {
    if (!session || questions.length === 0 || submittedRef.current) return
    const rows = questions.map((q) => ({
      session_id: session.id,
      question_id: q.id,
      answer: latestAnswersRef.current[q.id] || '',
    }))
    const { error } = await supabase.from('org_exam_responses').upsert(rows, { onConflict: 'session_id,question_id' })
    if (!error) await markSynced(session.id)
  }, [session, questions])

  useEffect(() => {
    if (!session) return
    const activeSession = session
    const interval = setInterval(syncToServer, 15000)

    async function flushQueuedViolations() {
      const record = await getExamRecord(activeSession.id)
      if (!record || record.queuedViolations.length === 0) return
      for (const v of record.queuedViolations) {
        await supabase.rpc('append_org_violation_log', { session_id: activeSession.id, entry: v })
      }
      await supabase.from('org_exam_sessions').update({ tab_switch_count: violationCount.current, flagged: true }).eq('id', activeSession.id)
      await clearQueuedViolations(activeSession.id)
    }

    function handleOnline() {
      syncToServer()
      flushQueuedViolations()
      if (submitPendingOffline) { setSubmitPendingOffline(false); handleSubmitRef.current() }
    }

    window.addEventListener('online', handleOnline)
    return () => { clearInterval(interval); window.removeEventListener('online', handleOnline) }
  }, [session, syncToServer, submitPendingOffline])

  async function registerViolation(reason: string) {
    if (!session) return
    violationCount.current += 1
    const count = violationCount.current
    const logEntry = { reason, timestamp: new Date().toISOString(), count }
    try {
      if (!navigator.onLine) throw new Error('offline')
      await supabase.rpc('append_org_violation_log', { session_id: session.id, entry: logEntry })
      await supabase.from('org_exam_sessions').update({ tab_switch_count: count, flagged: true }).eq('id', session.id)
    } catch {
      // No connectivity — don't lose proctoring data to a dropped connection,
      // queue it locally and flush once back online (see the effect above).
      await queueViolation(session.id, logEntry)
    }
    if (count >= 3) {
      setWarning(`This is violation ${count} (${reason}). Your exam is being submitted automatically.`)
      if (!submittedRef.current) { submittedRef.current = true; intentionalExitRef.current = true; handleSubmitRef.current() }
    } else {
      setWarning(`Warning ${count}/3: ${reason}. Reaching 3 violations will auto-submit your exam.`)
    }
  }

  function scheduleLocalSave() {
    if (!session) return
    if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current)
    localSaveTimerRef.current = setTimeout(() => {
      saveAnswersLocally(session.id, latestAnswersRef.current, {})
    }, 2000)
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value }
      latestAnswersRef.current = next
      return next
    })
    scheduleLocalSave()
  }

  async function handleSubmit() {
    if (!session || submitInFlightRef.current) return
    submitInFlightRef.current = true
    setErrorMsg('')

    // Offline at submit time (e.g. time ran out or the respondent hit
    // submit with no connection): don't even attempt the network calls,
    // save locally, lock the UI exactly as a real submit would, and let
    // the reconnect handler in the sync effect retry automatically.
    if (!navigator.onLine) {
      setSubmitting(true)
      await saveAnswersLocally(session.id, latestAnswersRef.current, {})
      await setPendingSubmitLocal(session.id, true)
      submittedRef.current = true
      setSubmitPendingOffline(true)
      setSubmitting(false)
      return
    }

    setSubmitting(true)

    try {
      let totalScore = 0
      let maxScore = 0

      const rows = questions.map((q) => {
        const answer = latestAnswersRef.current[q.id] || ''
        const awarded = gradeAnswer(q, answer) ?? 0
        totalScore += awarded
        maxScore += q.points
        return { session_id: session.id, question_id: q.id, answer, points_awarded: awarded }
      })

      await supabase.from('org_exam_responses').delete().eq('session_id', session.id)
      if (rows.length > 0) {
        const { error } = await supabase.from('org_exam_responses').insert(rows)
        if (error) throw error
      }

      const { error: sessionError } = await supabase
        .from('org_exam_sessions')
        .update({ submitted_at: new Date().toISOString(), total_score: totalScore, max_possible_score: maxScore })
        .eq('id', session.id)

      if (sessionError) throw sessionError

      await clearExamRecord(session.id)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      router.push(`/take-exam/${examId}/submitted`)
    } catch (err) {
      if (!navigator.onLine) {
        await saveAnswersLocally(session.id, latestAnswersRef.current, {})
        await setPendingSubmitLocal(session.id, true)
        submittedRef.current = true
        setSubmitPendingOffline(true)
        setSubmitting(false)
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong submitting your exam.')
        setSubmitting(false)
        submitInFlightRef.current = false
      }
    }
  }

  useEffect(() => {
    handleSubmitRef.current = handleSubmit
  })

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>
  if (errorMsg && questions.length === 0) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!session) return <div className="page-container">Exam not found.</div>

  if (submitPendingOffline) {
    return (
      <div className="page-container" style={{ maxWidth: 480, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
        <h1 style={{ marginBottom: 8 }}>No internet connection</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Your exam has been saved on this device and submitting is locked in. It will finish submitting automatically
          the moment you&apos;re back online. Don&apos;t close this window.
        </p>
      </div>
    )
  }

  const answeredCount = questions.filter((q) => answers[q.id]).length
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeLow = secondsLeft < 300

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
        <div style={{ position: 'sticky', top: 0, background: 'var(--page-bg)', padding: '12px 0', borderBottom: '2px solid var(--border-strong)', marginBottom: 20, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0 }}>Exam</h1>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>{answeredCount} of {questions.length} answered</p>
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
        {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

        <div className="exam-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((q, i) => (
            <div key={q.id} className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Q{i + 1} · {q.points} pt{q.points !== 1 ? 's' : ''}
              </div>
              <p style={{ fontWeight: 600, marginBottom: 10 }}>{q.question_text}</p>

              {q.question_type === 'multiple_choice' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {seededShuffle(q.options, questionSeed(session.option_shuffle_seed ?? 1, q.id)).map((opt, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: answers[q.id] === opt ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === opt ? 'var(--accent)' : 'var(--border)'}` }}>
                      <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => updateAnswer(q.id, opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === 'true_false' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {['true', 'false'].map((val) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 16px', borderRadius: 8, background: answers[q.id] === val ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === val ? 'var(--accent)' : 'var(--border)'}` }}>
                      <input type="radio" name={q.id} checked={answers[q.id] === val} onChange={() => updateAnswer(q.id, val)} />
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </label>
                  ))}
                </div>
              )}

              {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
                <input value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)} style={{ width: '100%' }} placeholder="Your answer…" />
              )}
            </div>
          ))}
        </div>

        <button onClick={() => { intentionalExitRef.current = true; submittedRef.current = true; handleSubmit() }} disabled={submitting} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
