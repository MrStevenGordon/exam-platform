'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'

type BankQuestion = {
  id: string
  topic: string | null
  points: number
  subject: string
}

type TopicRow = {
  topic: string
  subject: string
  questionCount: number
  masteredPct: number | null // null = never attempted
  attemptCount: number
}

export default function TopicMasteryPage() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadSubjects() }, [])
  useEffect(() => { if (subject) loadTopics(subject) }, [subject])

  async function loadSubjects() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase.rpc('get_bank_question_subjects')

      const subjectSet = new Set<string>()
      ;(data || []).forEach((row: any) => { if (row.subject && row.topic) subjectSet.add(row.subject) })
      const list = Array.from(subjectSet).sort()
      setSubjects(list)
      if (list.length > 0) setSubject(list[0])
    } catch (err) {
      console.error('Failed to load mastery subjects', err)
      setErrorMsg('Something went wrong loading practice topics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function loadTopics(subj: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: allBank } = await supabase.rpc('get_bank_question_subjects')
      const bankQuestions = (allBank || []).filter((q: any) => q.subject === subj && q.topic)

      const byTopic = new Map<string, BankQuestion[]>()
      ;(bankQuestions || []).forEach((q: any) => {
        const list = byTopic.get(q.topic) || []
        list.push({ id: q.question_id, topic: q.topic, points: q.points, subject: subj })
        byTopic.set(q.topic, list)
      })

      // Mastery: this student's own accumulated accuracy across every past
      // self-mock question whose underlying question carries that topic --
      // computed live each visit, same "no materialized row" approach as
      // the report card grade computation.
      const { data: history } = await supabase
        .from('self_mock_questions')
        .select('points_awarded, questions(topic, points), self_mocks!inner(student_id, completed_at)')
        .eq('self_mocks.student_id', user.id)
        .not('self_mocks.completed_at', 'is', null)

      const scoreByTopic = new Map<string, { earned: number; possible: number; count: number }>()
      ;(history || []).forEach((row: any) => {
        const t = row.questions?.topic
        if (!t) return
        const entry = scoreByTopic.get(t) || { earned: 0, possible: 0, count: 0 }
        entry.earned += row.points_awarded || 0
        entry.possible += row.questions?.points || 0
        entry.count += 1
        scoreByTopic.set(t, entry)
      })

      const rows: TopicRow[] = Array.from(byTopic.entries()).map(([topic, qs]) => {
        const score = scoreByTopic.get(topic)
        return {
          topic,
          subject: subj,
          questionCount: qs.length,
          masteredPct: score && score.possible > 0 ? Math.round((score.earned / score.possible) * 100) : null,
          attemptCount: score?.count || 0,
        }
      }).sort((a, b) => a.topic.localeCompare(b.topic))

      setTopics(rows)
    } catch (err) {
      console.error('Failed to load topics', err)
      setErrorMsg('Something went wrong loading practice topics. Please try again.')
    }
  }

  async function handlePractice(topic: string) {
    setGeneratingTopic(topic)
    setErrorMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // subject lives on draft_exams, whose own RLS is scoped to
      // published+enrolled exams -- narrower than "is this a bank
      // question" -- so subject/topic filtering goes through the same
      // SECURITY DEFINER lookup the list view uses, not a direct join.
      const { data: allBank, error: qError } = await supabase.rpc('get_bank_question_subjects')
      if (qError) throw qError
      const bankQuestions = (allBank || []).filter((q: any) => q.subject === subject && q.topic === topic)
      if (bankQuestions.length === 0) {
        setErrorMsg('No practice questions found for this topic.')
        return
      }

      const shuffled = [...bankQuestions].sort(() => Math.random() - 0.5).slice(0, 10)
        .map((q: any) => ({ id: q.question_id, points: q.points }))

      const { data: mock, error: mockError } = await supabase
        .from('self_mocks')
        .insert({ student_id: user.id, subject, question_count: shuffled.length })
        .select()
        .single()
      if (mockError) throw mockError

      const rows = shuffled.map((q: any, i: number) => ({ self_mock_id: mock.id, question_id: q.id, order_index: i }))
      const { error: linkError } = await supabase.from('self_mock_questions').insert(rows)
      if (linkError) throw linkError

      router.push(`/student/self-mock/${mock.id}`)
    } catch (err) {
      console.error('Failed to generate topic practice', err)
      setErrorMsg('Something went wrong starting practice for this topic. Please try again.')
    } finally {
      setGeneratingTopic(null)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <p className="portal-page-title" style={{ margin: 0 }}>Topic Mastery</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>
        Practice by topic, at your own pace. Not graded, not proctored — just for you.
      </p>

      {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}

      {subjects.length === 0 && !errorMsg && (
        <EmptyState icon="🎯" title="No practice topics yet" description="Your teacher hasn't tagged any question-bank questions with a topic yet. Check back soon." />
      )}

      {subjects.length > 0 && (
        <>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginBottom: 20, minWidth: 220 }}>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topics.map((t) => {
              const pct = t.masteredPct
              const barColor = pct === null ? 'var(--border-strong)' : pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--danger)'
              return (
                <div key={t.topic} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{t.topic}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {t.questionCount} question{t.questionCount !== 1 ? 's' : ''} available
                        {t.attemptCount > 0 && ` · ${t.attemptCount} practiced so far`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: barColor }}>
                        {pct === null ? '—' : `${pct}%`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pct === null ? 'Not started' : 'Mastery'}</div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--page-bg)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', width: `${pct ?? 0}%`, background: barColor, transition: 'width 0.3s ease' }} />
                  </div>
                  <button
                    onClick={() => handlePractice(t.topic)}
                    disabled={generatingTopic === t.topic}
                    className="btn btn-primary"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                  >
                    {generatingTopic === t.topic ? 'Starting…' : pct === null ? 'Start practicing' : 'Practice again'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
