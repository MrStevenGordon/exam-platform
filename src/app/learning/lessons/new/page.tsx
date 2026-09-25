'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { lessonsForPlan } from '@/lib/lessonPlan'
import { lessonFromPlan, emptySteps, type PlanForLesson } from '@/lib/learning'
import { GRADES } from '@/lib/topics'

type Plan = PlanForLesson & { id: string; updated_at: string }

// Start a student lesson: from one lesson of a lesson plan (its 5E text is copied in for
// the teacher to reword), or from a blank page.
export default function NewLessonPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'plan' | 'blank'>('plan')
  const [planId, setPlanId] = useState('')
  const [lessonIndex, setLessonIndex] = useState(0)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState<number>(9)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('lesson_plans').select('*').eq('teacher_id', (await supabase.auth.getSession()).data.session?.user?.id ?? '').order('updated_at', { ascending: false })
      if (cancelled) return
      const list = (data as Plan[]) || []
      setPlans(list)
      if (list.length === 0) setMode('blank')
      else setPlanId(list[0].id)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const plan = plans.find((p) => p.id === planId)
  const planLessons = plan ? lessonsForPlan(plan) : []
  const preview = plan ? lessonFromPlan(plan, lessonIndex) : null

  async function create() {
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) { setError('Please sign in again.'); return }

    let row
    if (mode === 'plan') {
      if (!plan || !preview) { setError('Choose a lesson plan first'); return }
      row = { ...preview, lesson_plan_id: plan.id, plan_lesson_index: lessonIndex }
    } else {
      if (!title.trim()) { setError('Give the lesson a title'); return }
      if (!subject.trim()) { setError('Enter the subject'); return }
      row = { title: title.trim(), subject: subject.trim(), grade, topic_id: null, key_terms: '', steps: emptySteps(), lesson_plan_id: null, plan_lesson_index: null }
    }
    setSaving(true)
    const { data, error: e } = await supabase.from('learning_lessons').insert({ ...row, teacher_id: uid }).select('id').single()
    setSaving(false)
    if (e || !data) { setError(e?.message || 'Could not create the lesson. Please try again.'); return }
    router.push(`/learning/lessons/${data.id}`)
  }

  if (loading) return <div>Loading…</div>

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href="/learning" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; My lessons</Link>
      <p className="portal-page-title" style={{ marginTop: 8 }}>New lesson</p>

      {plans.length > 0 && (
        <div role="group" aria-label="Start from" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <button type="button" aria-pressed={mode === 'plan'} className={mode === 'plan' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setMode('plan')}>From a lesson plan</button>
          <button type="button" aria-pressed={mode === 'blank'} className={mode === 'blank' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setMode('blank')}>Start blank</button>
        </div>
      )}

      {mode === 'plan' ? (
        <div className="card">
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }} htmlFor="plan">Lesson plan</label>
          <select id="plan" value={planId} onChange={(e) => { setPlanId(e.target.value); setLessonIndex(0) }} style={{ width: '100%', margin: '4px 0 14px' }}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.topic} · {p.subject} · {p.grade}</option>)}
          </select>
          {planLessons.length > 1 && (
            <>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }} htmlFor="lesson">Which lesson?</label>
              <select id="lesson" value={lessonIndex} onChange={(e) => setLessonIndex(Number(e.target.value))} style={{ width: '100%', margin: '4px 0 14px' }}>
                {planLessons.map((l, i) => <option key={i} value={i}>Lesson {i + 1}{l.title ? `: ${l.title}` : ''}</option>)}
              </select>
            </>
          )}
          {preview && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              &ldquo;{preview.title}&rdquo;: {preview.steps.filter((s) => s.text).length} of 5 steps already have text from your plan. It&rsquo;s written for you, so you&rsquo;ll reword it for students and approve each step before anyone sees it.
            </p>
          )}
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }} htmlFor="t">Title</label><input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Simple interest: introduction" style={{ width: '100%', marginTop: 4 }} /></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}><label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }} htmlFor="s">Subject</label><input id="s" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" style={{ width: '100%', marginTop: 4 }} /></div>
            <div><label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }} htmlFor="g">Grade</label><br /><select id="g" value={grade} onChange={(e) => setGrade(Number(e.target.value))} style={{ marginTop: 4 }}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select></div>
          </div>
        </div>
      )}

      {error && <p className="banner banner-danger" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create lesson'}</button>
      </div>
    </div>
  )
}
