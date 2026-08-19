'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import MathRenderer from '@/components/MathRenderer'
import ReadAloudButton from '@/components/ReadAloudButton'

export type Question = {
  id: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank'
  text: string
  options?: string[]
  correct: string
  points: number
  readAloud?: boolean
}

const DEFAULT_QUESTIONS: Question[] = [
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

type LeaderboardEntry = {
  firstName: string
  score: number
  totalQuestions: number
  timeSeconds: number
}

function scoreLabel(score: number, total: number): string {
  const pct = total > 0 ? score / total : 0
  if (pct === 1) return 'OCBN Insider'
  if (pct >= 0.7) return 'Sharp, well done'
  if (pct >= 0.4) return 'Getting there'
  return 'Time to read the newsletter'
}

const CONFETTI_COLORS = ['var(--accent)', '#D4762A', '#8C6020', '#3D7A5B', '#1E1208']

// A one-shot burst on a strong score. Pieces animate to a resting, faded-out
// state and stay mounted there (animation-fill-mode: forwards) rather than
// looping, so it reads as a moment, not a decoration.
function ConfettiBurst() {
  const pieces = Array.from({ length: 28 }, (_, i) => i)
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true">
      <style>{`
        @keyframes demo-confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(340px) rotate(540deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((i) => {
        const left = (i * 37) % 100
        const delay = (i % 7) * 0.08
        const duration = 1.6 + (i % 5) * 0.15
        const size = 6 + (i % 3) * 3
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        return (
          <span
            key={i}
            style={{
              position: 'absolute', top: 0, left: `${left}%`, width: size, height: size * 0.4,
              background: color, borderRadius: 2,
              animation: `demo-confetti-fall ${duration}s ease-in ${delay}s forwards`,
            }}
          />
        )
      })}
    </div>
  )
}

const ICE_BREAK_MS = 900

// Plays once over the exam screen the instant it mounts, shattering to
// reveal the real content underneath -- literal enough to earn the pun.
// step is already 'exam' and the fullscreen/timer are already running by
// the time this renders, so nothing here delays the actual start.
function IceBreakOverlay() {
  const shards = Array.from({ length: 16 }, (_, i) => i)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }} aria-hidden="true">
      <style>{`
        @keyframes ice-shard-fly {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.4); opacity: 0; }
        }
        @keyframes ice-caption-fade {
          0%, 45% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.08); }
        }
      `}</style>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}>
        {shards.map((i) => {
          const row = Math.floor(i / 4)
          const col = i % 4
          const angle = (i * 47) % 360
          const dist = 55 + (i % 5) * 16
          const tx = `${Math.cos((angle * Math.PI) / 180) * dist}vw`
          const ty = `${Math.sin((angle * Math.PI) / 180) * dist}vh`
          const rot = `${(i % 2 === 0 ? 1 : -1) * (130 + i * 11)}deg`
          const delay = 90 + (row + col) * 28
          return (
            <div
              key={i}
              style={{
                background: 'linear-gradient(135deg, rgba(220,238,247,0.96), rgba(163,204,224,0.88))',
                borderRight: col < 3 ? '1px solid rgba(255,255,255,0.55)' : 'none',
                borderBottom: row < 3 ? '1px solid rgba(255,255,255,0.55)' : 'none',
                animation: `ice-shard-fly 600ms ease-in ${delay}ms forwards`,
                ['--tx' as string]: tx,
                ['--ty' as string]: ty,
                ['--rot' as string]: rot,
              } as React.CSSProperties}
            />
          )
        })}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ice-caption-fade 650ms ease-out forwards' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1E1208', letterSpacing: 0.3 }}>
          🧊 Breaking the ice…
        </div>
      </div>
    </div>
  )
}

// Shared between the intro-screen peek and the results screen -- the only
// difference is whether there's a "you" row to highlight yet.
function LeaderboardPanel({ entries, loading, highlight }: {
  entries: LeaderboardEntry[]
  loading: boolean
  highlight?: { name: string; score: number }
}) {
  return (
    <div className="card" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Live leaderboard
        </div>
        {loading && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updating…</div>}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Be the first one on the board.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((entry, i) => {
            const isMe = !!highlight
              && entry.firstName.trim().toLowerCase() === highlight.name.trim().toLowerCase()
              && entry.score === highlight.score
            return (
              <div key={`${entry.firstName}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: isMe ? 'var(--accent-light)' : 'transparent' }}>
                <span style={{ width: 20, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500 }}>
                  {entry.firstName}{isMe ? ' (you)' : ''}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {entry.score}/{entry.totalQuestions}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', width: 34, textAlign: 'right' }}>
                  {entry.timeSeconds}s
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const NAME_PATTERN = /^[\p{L}\p{M}\s'-]{1,24}$/u

type DemoExamProps = {
  questions?: Question[]
  introKicker?: string
  introHeadline?: string
  introBody?: string
  introPoints?: string[]
  examTitle?: string
  enforceStrikes?: boolean
  revealAnswers?: boolean
  ctaHref?: string
  ctaLabel?: string
  passcode?: string
  leaderboardEnabled?: boolean
  leaderboardEventKey?: string
}

const MAX_VIOLATIONS = 3
const LEADERBOARD_POLL_MS = 5000

export default function DemoExam({
  questions = DEFAULT_QUESTIONS,
  introKicker = 'Demo exam',
  introHeadline = 'See the platform, not just read about it.',
  introBody = "Five sample questions, the same question types, math rendering, and timer real students see. This opens in fullscreen, just like a real exam. Nothing here is saved or scored anywhere, and this page doesn't need an account.",
  introPoints,
  examTitle = 'Demo Exam',
  enforceStrikes = false,
  revealAnswers = false,
  ctaHref = '/build-my-school',
  ctaLabel = 'Get started',
  passcode,
  leaderboardEnabled = false,
  leaderboardEventKey = 'ocbn-2026',
}: DemoExamProps = {}) {
  const storageKey = passcode ? `demoExamUnlock:${examTitle}` : ''
  const [step, setStep] = useState<'gate' | 'intro' | 'exam' | 'done'>(passcode ? 'gate' : 'intro')
  const [passcodeInput, setPasscodeInput] = useState('')
  const [passcodeError, setPasscodeError] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [secondsLeft, setSecondsLeft] = useState(DEMO_SECONDS)
  const [toast, setToast] = useState('')
  const [inFullscreen, setInFullscreen] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showIceBreak, setShowIceBreak] = useState(false)
  const [showIntroLeaderboard, setShowIntroLeaderboard] = useState(false)

  const hasBeenFullscreenRef = useRef(false)
  const finishedRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaderboardSubmittedRef = useRef(false)

  useEffect(() => {
    if (!passcode) return
    if (window.localStorage.getItem(storageKey) === 'true') setStep('intro')
  }, [passcode, storageKey])

  const refreshLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true)
    try {
      const res = await fetch(`/api/ocbn-demo/leaderboard?eventKey=${encodeURIComponent(leaderboardEventKey)}`)
      const data = await res.json()
      if (Array.isArray(data.entries)) setLeaderboard(data.entries)
    } catch {
      // Leave whatever leaderboard state we already had.
    } finally {
      setLeaderboardLoading(false)
    }
  }, [leaderboardEventKey])

  // Lets people peek at the board from the intro screen, before playing --
  // click to reveal, polls only while it's actually open.
  useEffect(() => {
    if (!showIntroLeaderboard) return
    refreshLeaderboard()
    const interval = setInterval(refreshLeaderboard, LEADERBOARD_POLL_MS)
    return () => clearInterval(interval)
  }, [showIntroLeaderboard, refreshLeaderboard])

  function submitPasscode(e: React.FormEvent) {
    e.preventDefault()
    if (passcode && passcodeInput.trim().toLowerCase() === passcode.trim().toLowerCase()) {
      window.localStorage.setItem(storageKey, 'true')
      setPasscodeError(false)
      setStep('intro')
    } else {
      setPasscodeError(true)
    }
  }

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

  const registerViolation = useCallback((label: string) => {
    if (!enforceStrikes) {
      showToast(`👀 ${label} In a real exam, this gets logged and flagged for teacher review.`)
      return
    }
    setViolationCount((prev) => {
      const count = prev + 1
      if (count >= MAX_VIOLATIONS) {
        setAutoSubmitted(true)
        showToast(`🚫 Violation ${count}/${MAX_VIOLATIONS}: ${label} Auto-submitting now, exactly like a real exam would.`)
        finish()
      } else {
        showToast(`⚠️ Warning ${count}/${MAX_VIOLATIONS}: ${label} Reaching ${MAX_VIOLATIONS} auto-submits the exam.`)
      }
      return count
    })
  }, [enforceStrikes, showToast, finish])

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
        registerViolation('Switched away from the exam tab.')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [step, registerViolation])

  useEffect(() => {
    function handleFullscreenChange() {
      const isFull = !!document.fullscreenElement
      setInFullscreen(isFull)
      if (isFull) hasBeenFullscreenRef.current = true
      if (!isFull && hasBeenFullscreenRef.current && step === 'exam') {
        registerViolation('Exited fullscreen.')
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [step, registerViolation])

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
    // requestFullscreen must fire synchronously in this click handler or
    // the browser drops it for losing the user-gesture window -- so it goes
    // first, before anything else, animation included.
    document.documentElement.requestFullscreen?.().catch(() => {})
    setStep('exam')
    setSecondsLeft(DEMO_SECONDS)
    setViolationCount(0)
    setAutoSubmitted(false)
    finishedRef.current = false
    hasBeenFullscreenRef.current = false
    if (leaderboardEnabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShowIceBreak(true)
      setTimeout(() => setShowIceBreak(false), ICE_BREAK_MS)
    }
  }

  function tryAgain() {
    setAnswers({})
    setToast('')
    leaderboardSubmittedRef.current = false
    setShowConfetti(false)
    startDemo()
  }

  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeLow = secondsLeft < 30
  const score = questions.filter((q) => gradeDemo(q, answers[q.id] || '')).length

  // Submit this attempt's score once the exam ends, then poll the shared
  // leaderboard so it visibly moves while people are still finishing at the
  // event -- this only runs once per attempt (leaderboardSubmittedRef),
  // reset by tryAgain() below for a fresh attempt.
  useEffect(() => {
    if (step !== 'done' || !leaderboardEnabled || leaderboardSubmittedRef.current) return
    leaderboardSubmittedRef.current = true

    const elapsedSeconds = DEMO_SECONDS - secondsLeft
    const name = firstName.trim()

    async function submitAndPoll() {
      if (name && NAME_PATTERN.test(name)) {
        try {
          await fetch('/api/ocbn-demo/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventKey: leaderboardEventKey,
              firstName: name,
              score,
              totalQuestions: questions.length,
              timeSeconds: elapsedSeconds,
            }),
          })
        } catch {
          // Leaderboard is a bonus, not the point of the demo -- a failed
          // submit shouldn't block or alarm anyone at a live event.
        }
      }

      if (questions.length > 0 && score / questions.length >= 0.8 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setShowConfetti(true)
      }

      await refreshLeaderboard()
    }

    submitAndPoll()
    const interval = setInterval(refreshLeaderboard, LEADERBOARD_POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, leaderboardEnabled])

  if (step === 'gate') {
    return (
      <div className="page-container" style={{ maxWidth: 400, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
        <h1 style={{ marginBottom: 8, fontSize: 22 }}>This demo requires a passcode</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          Enter the passcode you were given to continue.
        </p>
        <form onSubmit={submitPasscode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={passcodeInput}
            onChange={(e) => { setPasscodeInput(e.target.value); setPasscodeError(false) }}
            placeholder="Passcode"
            autoFocus
            style={{ width: '100%', textAlign: 'center', letterSpacing: 1 }}
          />
          {passcodeError && (
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>That passcode isn&apos;t right. Try again.</div>
          )}
          <button type="submit" className="btn btn-primary" style={{ padding: '11px 24px' }}>
            Continue
          </button>
        </form>
      </div>
    )
  }

  if (step === 'intro') {
    return (
      <div className="page-container" style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          {introKicker}
        </div>
        <h1 style={{ marginBottom: 12 }}>{introHeadline}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: introPoints ? 20 : 28 }}>
          {introBody}
        </p>
        {introPoints && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            {introPoints.map((point, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--accent)', flex: 'none' }}>✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
        {leaderboardEnabled && (
          <div style={{ marginBottom: 20, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto', textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
              Your first name, for the leaderboard
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="e.g. Steven"
              maxLength={24}
              autoFocus
              style={{ width: '100%' }}
            />
            {nameTouched && !NAME_PATTERN.test(firstName.trim()) && (
              <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 5 }}>
                Enter your first name to join the leaderboard.
              </div>
            )}
          </div>
        )}
        {leaderboardEnabled && (
          <div style={{ maxWidth: 360, marginLeft: 'auto', marginRight: 'auto', marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => setShowIntroLeaderboard((v) => !v)}
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: '8px 16px' }}
            >
              🏆 {showIntroLeaderboard ? 'Hide leaderboard' : 'View live leaderboard'}
            </button>
            {showIntroLeaderboard && (
              <div style={{ marginTop: 12 }}>
                <LeaderboardPanel entries={leaderboard} loading={leaderboardLoading} />
              </div>
            )}
          </div>
        )}
        <button
          onClick={startDemo}
          className="btn btn-primary"
          style={{ padding: '13px 28px', fontSize: 15 }}
          disabled={leaderboardEnabled && !NAME_PATTERN.test(firstName.trim())}
        >
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
      <div className="page-container" style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60, position: 'relative' }}>
        {showConfetti && <ConfettiBurst />}
        {autoSubmitted && (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 20, textAlign: 'left' }}>
            🚫 This exam was auto-submitted after {MAX_VIOLATIONS} integrity violations, exactly what happens on a real exam.
          </div>
        )}
        <div style={{ fontSize: 40, marginBottom: 12 }}>{score === questions.length ? '🏆' : '✓'}</div>
        <h1 style={{ marginBottom: 4 }}>You scored {score} / {questions.length}</h1>
        {leaderboardEnabled && (
          <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14.5, marginBottom: 8 }}>
            {scoreLabel(score, questions.length)}
          </p>
        )}
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
          That&apos;s the exam-taking experience end to end. The real platform adds question banks, review
          workflows, results and reporting, and the integrity monitoring you just saw a taste of.
        </p>

        {leaderboardEnabled && (
          <div style={{ marginBottom: 28 }}>
            <LeaderboardPanel entries={leaderboard} loading={leaderboardLoading} highlight={{ name: firstName, score }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: revealAnswers ? 32 : 0 }}>
          <button onClick={tryAgain} className="btn btn-secondary">Try again</button>
          <Link href={ctaHref} className="btn btn-primary">{ctaLabel}</Link>
        </div>

        {revealAnswers && (
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              Answer review
            </div>
            {questions.map((q, i) => {
              const given = answers[q.id] || ''
              const isCorrect = gradeDemo(q, given)
              return (
                <div key={q.id} className="card" style={{ borderColor: isCorrect ? 'var(--success)' : 'var(--danger)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                    <span>Q{i + 1}</span>
                    <span style={{ color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    <MathRenderer text={q.text} />
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                    Your answer: <strong style={{ color: 'var(--text-primary)' }}>{given ? given.charAt(0).toUpperCase() + given.slice(1) : '(no answer)'}</strong>
                  </div>
                  {!isCorrect && (
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Correct answer: <strong style={{ color: 'var(--success)' }}>{q.correct.charAt(0).toUpperCase() + q.correct.slice(1)}</strong>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 640, position: 'relative' }}>
      {showIceBreak && <IceBreakOverlay />}
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
            <h1 style={{ margin: 0, fontSize: 20 }}>{examTitle}</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>{answeredCount} of {questions.length} answered</p>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: timeLow ? 'var(--danger)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
            🔒 Integrity monitoring active{enforceStrikes ? ` · ${violationCount}/${MAX_VIOLATIONS} violations` : ' (demo)'}
          </span>
          {!inFullscreen && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fullscreen was blocked or exited.</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q, i) => (
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
