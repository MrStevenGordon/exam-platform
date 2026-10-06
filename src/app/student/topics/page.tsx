'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { createPracticeMock, loadMyTopics, loadTopicLessons } from '@/lib/studentTopics'
import { computeTopics, LEVEL_LABEL, lessonsForTopic, pickPractice, subjectsOf, TREND_LABEL, wantsLessons, type TopicLesson, type TopicLevel, type TopicResult } from '@/lib/studentTopicsPure'
import EmptyState from '@/components/EmptyState'

// A student's own results by topic, from released and marked questions only. It shows what to work on first and offers a
// practice mock built from past questions on that topic. It shows only topic names and marks, never question wording.

const TONE: Record<TopicLevel, { bar: string; badge: string }> = {
  weak: { bar: 'var(--danger)', badge: 'badge-danger' },
  getting_there: { bar: 'var(--warning)', badge: 'badge-warning' },
  strong: { bar: 'var(--success)', badge: 'badge-success' },
  too_few: { bar: 'var(--text-muted)', badge: 'badge-default' },
}

export default function MyTopicsPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicResult[]>([])
  const [untagged, setUntagged] = useState(0)
  const [lessons, setLessons] = useState<TopicLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [subject, setSubject] = useState('all')
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const res = await loadMyTopics()
      if (!res.ok) {
        setErrorMsg(res.reason === 'not_installed' ? 'My topics is not switched on for your school yet.' : 'Something went wrong loading your topics. Please try again.')
      } else {
        setTopics(computeTopics(res.rows))
        setUntagged(res.untagged)
        setLessons(await loadTopicLessons())
      }
      setLoading(false)
    }
    load()
  }, [router])

  const subjects = useMemo(() => subjectsOf(topics), [topics])
  const shown = subject === 'all' ? topics : topics.filter((t) => t.subject === subject)
  const judged = shown.filter((t) => t.level !== 'too_few')
  const tooFew = shown.filter((t) => t.level === 'too_few')
  const focus = judged.filter((t) => t.level === 'weak').slice(0, 3)

  async function practise(t: TopicResult) {
    setStarting(t.key)
    setErrorMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const res = await createPracticeMock(user.id, t.subject, pickPractice(t.practiceQuestionIds))
    if (!res.ok) { setErrorMsg(res.message); setStarting(null); return }
    router.push(`/student/self-mock/${res.id}`)
  }

  if (loading) return <div className="page-container">Loading…</div>

  const card = (t: TopicResult) => {
    const tone = TONE[t.level]
    return (
      <div key={t.key} className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {t.subject} · {t.questions} question{t.questions === 1 ? '' : 's'} in {t.exams} exam{t.exams === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`badge ${tone.badge}`}>{LEVEL_LABEL[t.level]}</span>
            {t.trend && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{TREND_LABEL[t.trend]}</div>}
          </div>
        </div>
        {t.level !== 'too_few' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div role="img" aria-label={`${t.pct} percent`} style={{ flex: 1, height: 10, borderRadius: 100, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ width: `${t.pct}%`, height: '100%', background: tone.bar }} />
            </div>
            <strong style={{ fontSize: 14, minWidth: 40, textAlign: 'right' }}>{t.pct}%</strong>
          </div>
        )}
        {wantsLessons(t) && lessonsForTopic(t, lessons).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Lessons on this topic</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {lessonsForTopic(t, lessons).map((l) => (
                <li key={l.id} style={{ fontSize: 14 }}><Link href={`/learning/lesson/${l.id}`}>{l.title}</Link>{l.done ? <span style={{ color: 'var(--success)', fontSize: 12 }}> · finished</span> : null}</li>
              ))}
            </ul>
          </div>
        )}
        {t.practiceQuestionIds.length > 0 && t.level !== 'too_few' && (
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12, fontSize: 13, padding: '6px 14px' }} onClick={() => practise(t)} disabled={starting !== null}>
            {starting === t.key ? 'Starting…' : 'Practise this topic'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <Link href="/student" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to home</Link>
      <h1 className="portal-page-title" style={{ marginTop: 16 }}>My topics</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        How you did on each topic, from the exams and tests your teachers have shared with you. Start with the ones that need work.
      </p>

      {errorMsg && <p role="alert" className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}

      {topics.length === 0 && !errorMsg && (
        <div style={{ marginTop: 20 }}>
          <EmptyState icon="🎯" title="No topic results yet"
            description={untagged > 0
              ? 'Your teachers have not added topics to your exam questions yet. Once they do, your results will show here by topic.'
              : 'When your teachers share results from an exam, your results by topic will show up here.'} />
        </div>
      )}

      {topics.length > 0 && (
        <>
          {subjects.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="subject" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Subject</label>
              <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ display: 'block', marginTop: 6, minWidth: 220 }}>
                <option value="all">All subjects</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {focus.length > 0 && (
            <section aria-label="Work on these first" className="card" style={{ marginTop: 20, background: 'var(--danger-bg)' }}>
              <h2 style={{ marginBottom: 8 }}>Work on these first</h2>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {focus.map((t) => <li key={t.key} style={{ fontSize: 14, marginBottom: 4 }}><strong>{t.name}</strong> ({t.subject}, {t.pct}%)</li>)}
              </ul>
            </section>
          )}
          {focus.length === 0 && judged.length > 0 && (
            <p className="banner banner-success" style={{ marginTop: 20 }}>No topic is under 50% right now. Keep it up.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>{judged.map(card)}</div>

          {tooFew.length > 0 && (
            <details style={{ marginTop: 24 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Topics with too few questions to judge ({tooFew.length})</summary>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 12px' }}>A topic needs at least 3 questions before we say how you are doing on it.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{tooFew.map(card)}</div>
            </details>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
            Only marked questions from shared results are counted. An essay still waiting for your teacher is left out until it is marked.
            {untagged > 0 ? ` ${untagged} question${untagged === 1 ? '' : 's'} had no topic and ${untagged === 1 ? 'is' : 'are'} not shown here.` : ''}
          </p>
        </>
      )}
    </div>
  )
}
