'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import MathRenderer from '@/components/MathRenderer'
import ReadAloudButton from '@/components/ReadAloudButton'

type Question = {
  id: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank'
  text: string
  options?: string[]
  correct: string
  points: number
  readAloud?: boolean
}

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    type: 'multiple_choice',
    text: 'Which of these numbers is prime?',
    options: ['15', '21', '23', '27'],
    correct: '23',
    points: 1,
  },
  {
    id: 'q2',
    type: 'true_false',
    text: 'The mitochondria is the powerhouse of the cell.',
    correct: 'true',
    points: 1,
  },
  {
    id: 'q3',
    type: 'short_answer',
    text: 'Simplify: $\\dfrac{x^2 \\cdot x^3}{x^4}$',
    correct: 'x',
    points: 1,
  },
  {
    id: 'q4',
    type: 'fill_blank',
    text: 'The capital of Jamaica is ______.',
    correct: 'kingston',
    points: 1,
  },
  {
    id: 'q5',
    type: 'multiple_choice',
    text: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correct: 'Mars',
    points: 1,
    readAloud: true,
  },
]

const DEMO_SECONDS = 180

function gradeDemo(question: Question, answer: string): boolean {
  return answer.trim().toLowerCase() === question.correct.trim().toLowerCase()
}

export default function DemoExam() {
  const [step, setStep] = useState<'intro' | 'exam' | 'done'>('intro')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [secondsLeft, setSecondsLeft] = useState(DEMO_SECONDS)
  const [toast, setToast] = useState('')
  const [inFullscreen, setInFullscreen] = useState(false)

  const hasBeenFullscreenRef = useRef(false)
  const finishedRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 4500)
  }, [])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setStep('done')
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    if (step !== 'exam') return
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); finish(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [step, finish])

  useEffect(() => {
    if (step !== 'exam') return
    function handleVisibilityChange() {
      if (document.hidden) {
        showToast("👀 We noticed that. In a real exam, switching away gets logged and flagged for teacher review.")
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [step, showToast])

  useEffect(() => {
    function handleFullscreenChange() {
      const isFull = !!document.fullscreenElement
      setInFullscreen(isFull)
      if (isFull) hasBeenFullscreenRef.current = true
      if (!isFull && hasBeenFullscreenRef.current && step === 'exam') {
        showToast('🔒 Exiting fullscreen mid-exam would also be flagged. This is what real exam integrity monitoring looks like.')
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [step, showToast])

  // Same in-page shortcut blocking the real exam uses. Note what this can
  // and can't do: it can stop the browser's own copy/paste, right-click,
  // and closing/opening tabs from inside the page. It cannot stop the
  // operating system's own app switcher (Cmd+Tab on macOS, Alt+Tab on
  // Windows) — the OS intercepts that keystroke before any webpage ever
  // sees it, on every browser, by design. No website can block that.
  useEffect(() => {
    if (step !== 'exam') return
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.altKey) && e.key === 'Tab') { e.preventDefault(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'w' || e.key === 'q')) { e.preventDefault(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 't')) { e.preventDefault(); return }
      if (e.key === 'F11') { e.preventDefault(); return }
      if (e.key === 'Escape') { e.preventDefault(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'x')) { e.preventDefault(); return }
    }
    function handleContextMenu(e: MouseEvent) { e.preventDefault() }
    function handleSelectStart(e: Event) { e.preventDefault() }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('selectstart', handleSelectStart)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('selectstart', handleSelectStart)
    }
  }, [step])

  function updateAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function startDemo() {
    setStep('exam')
    setSecondsLeft(DEMO_SECONDS)
    finishedRef.current = false
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  function tryAgain() {
    setAnswers({})
    setToast('')
    startDemo()
  }

  const answeredCount = QUESTIONS.filter((q) => answers[q.id]?.trim()).length
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeLow = secondsLeft < 30
  const score = QUESTIONS.filter((q) => gradeDemo(q, answers[q.id] || '')).length

  if (step === 'intro') {
    return (
      <div className="page-container" style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Demo exam
        </div>
        <h1 style={{ marginBottom: 12 }}>See the platform, not just read about it.</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
          Five sample questions, the same question types, math rendering, and timer real students see.
          This opens in fullscreen, just like a real exam. Nothing here is saved or scored anywhere, and this page doesn&apos;t need an account.
        </p>
        <button onClick={startDemo} className="btn btn-primary" style={{ padding: '13px 28px', fontSize: 15 }}>
          Start the demo
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          Takes about 2 minutes.
        </p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="page-container" style={{ maxWidth: 480, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{score === QUESTIONS.length ? '🏆' : '✓'}</div>
        <h1 style={{ marginBottom: 8 }}>You scored {score} / {QUESTIONS.length}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
          That&apos;s the exam-taking experience end to end. The real platform adds question banks, review
          workflows, results and reporting, and the integrity monitoring you just saw a taste of.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={tryAgain} className="btn btn-secondary">Try again</button>
          <Link href="/build-my-school" className="btn btn-primary">Get started</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 640, position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: 'var(--sidebar-bg, #1A0E06)', color: '#FFF9F2', padding: '12px 20px', borderRadius: 10,
          maxWidth: 420, fontSize: 13.5, lineHeight: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}>
          {toast}
        </div>
      )}

      <div style={{ position: 'sticky', top: 0, background: 'var(--page-bg)', padding: '12px 0', borderBottom: '2px solid var(--border-strong)', marginBottom: 20, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>Demo Exam</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>{answeredCount} of {QUESTIONS.length} answered</p>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: timeLow ? 'var(--danger)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>🔒 Integrity monitoring active (demo)</span>
          {!inFullscreen && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fullscreen was blocked or exited.</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {QUESTIONS.map((q, i) => (
          <div key={q.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Q{i + 1} · {q.points} pt
              </div>
              {q.readAloud && <ReadAloudButton questionText={q.text} options={q.options} />}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>
              <MathRenderer text={q.text} />
            </div>

            {q.type === 'multiple_choice' && q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt) => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: answers[q.id] === opt ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === opt ? 'var(--accent)' : 'var(--border)'}` }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => updateAnswer(q.id, opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === 'true_false' && (
              <div style={{ display: 'flex', gap: 12 }}>
                {['true', 'false'].map((val) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 16px', borderRadius: 8, background: answers[q.id] === val ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === val ? 'var(--accent)' : 'var(--border)'}` }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === val} onChange={() => updateAnswer(q.id, val)} />
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </label>
                ))}
              </div>
            )}

            {(q.type === 'short_answer' || q.type === 'fill_blank') && (
              <input
                value={answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                style={{ width: '100%' }}
                placeholder="Your answer…"
              />
            )}
          </div>
        ))}
      </div>

      <button onClick={finish} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>
        Submit demo
      </button>
    </div>
  )
}
