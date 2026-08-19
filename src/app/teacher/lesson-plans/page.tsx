'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSchoolFeatures } from '@/lib/schoolFeatures'

type LessonPlan = {
  id: string
  subject: string
  grade: string
  term: string | null
  unit_theme: string | null
  focus_strand: string | null
  topic: string
  focus_question: string | null
  duration: string | null
  attainment_target: string | null
  specific_objective: string | null
  skills: string | null
  prior_learning: string | null
  materials: string | null
  engage: string | null
  explore: string | null
  explain: string | null
  elaborate: string | null
  evaluate: string | null
  success_criteria: string | null
  created_at: string
}

type SharedPlan = {
  id: string
  school_name: string
  teacher_name: string | null
  subject: string
  grade: string
  term: string | null
  unit_theme: string | null
  focus_strand: string | null
  topic: string
  focus_question: string | null
  duration: string | null
  attainment_target: string | null
  specific_objective: string | null
  skills: string | null
  prior_learning: string | null
  materials: string | null
  engage: string | null
  explore: string | null
  explain: string | null
  elaborate: string | null
  evaluate: string | null
  success_criteria: string | null
  published_at: string
}

const BODY_FIELDS: { key: keyof LessonPlan; label: string }[] = [
  { key: 'specific_objective', label: 'Specific Objective' },
  { key: 'skills', label: 'Skills' },
  { key: 'prior_learning', label: 'Prior Learning' },
  { key: 'materials', label: 'Materials' },
  { key: 'engage', label: 'Engage' },
  { key: 'explore', label: 'Explore' },
  { key: 'explain', label: 'Explain' },
  { key: 'elaborate', label: 'Elaborate / Extend' },
  { key: 'evaluate', label: 'Evaluate' },
  { key: 'success_criteria', label: 'Success Criteria' },
]

function emptyForm() {
  return {
    subject: '', grade: '', term: '', unit_theme: '', focus_strand: '', topic: '',
    focus_question: '', duration: '', attainment_target: '',
    specific_objective: '', skills: '', prior_learning: '', materials: '',
    engage: '', explore: '', explain: '', elaborate: '', evaluate: '', success_criteria: '',
  }
}

export default function LessonPlansPage() {
  const router = useRouter()
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [tab, setTab] = useState<'my-plans' | 'browse'>('my-plans')
  const [view, setView] = useState<'list' | 'form'>('list')
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [libraryPlans, setLibraryPlans] = useState<SharedPlan[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [viewingPlan, setViewingPlan] = useState<SharedPlan | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishedId, setPublishedId] = useState<string | null>(null)

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const features = await getSchoolFeatures()
      if (!features.lessonPlanLibraryEnabled) { router.push('/teacher'); return }
      setHasAccess(true)
      setCheckingAccess(false)
      loadPlans()
    }
    checkAccess()
  }, [router])

  async function loadPlans() {
    setLoading(true)
    const { data } = await supabase.from('lesson_plans').select('*').order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  function startNew() {
    setEditingId(null)
    setForm(emptyForm())
    setGenerateError('')
    setErrorMsg('')
    setView('form')
  }

  function startEdit(plan: LessonPlan) {
    setEditingId(plan.id)
    setForm({
      subject: plan.subject, grade: plan.grade, term: plan.term || '', unit_theme: plan.unit_theme || '',
      focus_strand: plan.focus_strand || '', topic: plan.topic, focus_question: plan.focus_question || '',
      duration: plan.duration || '', attainment_target: plan.attainment_target || '',
      specific_objective: plan.specific_objective || '', skills: plan.skills || '',
      prior_learning: plan.prior_learning || '', materials: plan.materials || '',
      engage: plan.engage || '', explore: plan.explore || '', explain: plan.explain || '',
      elaborate: plan.elaborate || '', evaluate: plan.evaluate || '', success_criteria: plan.success_criteria || '',
    })
    setGenerateError('')
    setErrorMsg('')
    setView('form')
  }

  function updateField(key: keyof ReturnType<typeof emptyForm>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleGenerate() {
    if (!form.subject.trim() || !form.grade.trim() || !form.topic.trim()) {
      setGenerateError('Fill in Subject, Grade, and Topic first.')
      return
    }
    setGenerating(true)
    setGenerateError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/lesson-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject,
          grade: form.grade,
          topic: form.topic,
          focusQuestion: form.focus_question || undefined,
          attainmentTarget: form.attainment_target || undefined,
          accessToken: session?.access_token,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error || 'Something went wrong.')
        setGenerating(false)
        return
      }
      setForm((prev) => ({
        ...prev,
        specific_objective: data.specificObjective || prev.specific_objective,
        skills: data.skills || prev.skills,
        prior_learning: data.priorLearning || prev.prior_learning,
        materials: data.materials || prev.materials,
        engage: data.engage || prev.engage,
        explore: data.explore || prev.explore,
        explain: data.explain || prev.explain,
        elaborate: data.elaborate || prev.elaborate,
        evaluate: data.evaluate || prev.evaluate,
        success_criteria: data.successCriteria || prev.success_criteria,
      }))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.grade.trim() || !form.topic.trim()) {
      setErrorMsg('Subject, Grade, and Topic are required.')
      return
    }
    setSaving(true)
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const payload = { ...form, teacher_id: user.id, updated_at: new Date().toISOString() }

    const { error } = editingId
      ? await supabase.from('lesson_plans').update(payload).eq('id', editingId)
      : await supabase.from('lesson_plans').insert(payload)

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setView('list')
    loadPlans()
  }

  async function loadLibrary(search?: string) {
    setLibraryLoading(true)
    setLibraryError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const params = new URLSearchParams({ accessToken: session?.access_token || '' })
      if (search?.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/lesson-plans/library?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setLibraryError(data.error || 'Could not load the library.')
        setLibraryPlans([])
      } else {
        setLibraryPlans(data.plans || [])
      }
    } catch {
      setLibraryError('Could not load the library.')
    } finally {
      setLibraryLoading(false)
      setLibraryLoaded(true)
    }
  }

  function openBrowse() {
    setTab('browse')
    if (!libraryLoaded) loadLibrary()
  }

  function copyToMyPlans(plan: SharedPlan) {
    setEditingId(null)
    setForm({
      subject: plan.subject, grade: plan.grade, term: plan.term || '', unit_theme: plan.unit_theme || '',
      focus_strand: plan.focus_strand || '', topic: plan.topic, focus_question: plan.focus_question || '',
      duration: plan.duration || '', attainment_target: plan.attainment_target || '',
      specific_objective: plan.specific_objective || '', skills: plan.skills || '',
      prior_learning: plan.prior_learning || '', materials: plan.materials || '',
      engage: plan.engage || '', explore: plan.explore || '', explain: plan.explain || '',
      elaborate: plan.elaborate || '', evaluate: plan.evaluate || '', success_criteria: plan.success_criteria || '',
    })
    setViewingPlan(null)
    setGenerateError('')
    setErrorMsg('')
    setTab('my-plans')
    setView('form')
  }

  async function handlePublish(plan: LessonPlan) {
    setPublishingId(plan.id)
    setPublishedId(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/lesson-plans/library/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session?.access_token,
          subject: plan.subject, grade: plan.grade, term: plan.term || undefined,
          unitTheme: plan.unit_theme || undefined, focusStrand: plan.focus_strand || undefined,
          topic: plan.topic, focusQuestion: plan.focus_question || undefined,
          duration: plan.duration || undefined, attainmentTarget: plan.attainment_target || undefined,
          specificObjective: plan.specific_objective || undefined, skills: plan.skills || undefined,
          priorLearning: plan.prior_learning || undefined, materials: plan.materials || undefined,
          engage: plan.engage || undefined, explore: plan.explore || undefined, explain: plan.explain || undefined,
          elaborate: plan.elaborate || undefined, evaluate: plan.evaluate || undefined,
          successCriteria: plan.success_criteria || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPublishedId(plan.id)
        setLibraryLoaded(false)
      } else {
        setErrorMsg(data.error || 'Could not publish this plan.')
      }
    } finally {
      setPublishingId(null)
    }
  }

  if (checkingAccess) return <div className="page-container">Loading…</div>
  if (!hasAccess) return null

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <h1 style={{ marginBottom: 4 }}>Lesson Plans</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Build and AI-assist NSC-style lesson plans, or browse plans shared by other schools.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setTab('my-plans')}
          className="btn btn-ghost"
          style={{ borderBottom: tab === 'my-plans' ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 0 }}
        >
          My Plans
        </button>
        <button
          onClick={openBrowse}
          className="btn btn-ghost"
          style={{ borderBottom: tab === 'browse' ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 0 }}
        >
          Browse Library
        </button>
      </div>

      {tab === 'browse' && !viewingPlan && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadLibrary(librarySearch) }}
              placeholder="Search by topic…"
              style={{ flex: 1 }}
            />
            <button onClick={() => loadLibrary(librarySearch)} className="btn btn-secondary">Search</button>
          </div>

          {libraryLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
          ) : libraryError ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
              {libraryError}
            </div>
          ) : libraryPlans.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
              No plans shared yet. Publish one of your own from My Plans to get the library started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {libraryPlans.map((plan) => (
                <div key={plan.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setViewingPlan(plan)}>
                  <div style={{ fontWeight: 600 }}>{plan.topic}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {plan.subject} · {plan.grade}{plan.term ? ` · ${plan.term}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Shared by {plan.school_name}{plan.teacher_name ? ` · ${plan.teacher_name}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'browse' && viewingPlan && (
        <div>
          <button type="button" onClick={() => setViewingPlan(null)} className="btn btn-ghost" style={{ marginBottom: 16, padding: 0 }}>
            &larr; Back to Browse Library
          </button>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{viewingPlan.topic}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {viewingPlan.subject} · {viewingPlan.grade}{viewingPlan.term ? ` · ${viewingPlan.term}` : ''}{viewingPlan.duration ? ` · ${viewingPlan.duration}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Shared by {viewingPlan.school_name}{viewingPlan.teacher_name ? ` · ${viewingPlan.teacher_name}` : ''}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            {BODY_FIELDS.map(({ key, label }) => {
              const value = viewingPlan[key as keyof SharedPlan]
              if (!value) return null
              return (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
                  <div style={{ fontSize: 14, marginTop: 4, whiteSpace: 'pre-wrap' }}>{String(value)}</div>
                </div>
              )
            })}
          </div>
          <button onClick={() => copyToMyPlans(viewingPlan)} className="btn btn-primary">
            Copy to My Plans
          </button>
        </div>
      )}

      {tab === 'my-plans' && view === 'list' && (
        <>
          <button onClick={startNew} className="btn btn-primary" style={{ marginBottom: 20 }}>
            + New Lesson Plan
          </button>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
          ) : plans.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
              No lesson plans yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {plans.map((plan) => (
                <div key={plan.id} className="card" style={{ cursor: 'pointer' }} onClick={() => startEdit(plan)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{plan.topic}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {plan.subject} · {plan.grade}{plan.term ? ` · ${plan.term}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePublish(plan) }}
                      disabled={publishingId === plan.id}
                      className="btn btn-secondary"
                      style={{ fontSize: 12.5, flex: 'none' }}
                    >
                      {publishingId === plan.id ? 'Publishing…' : publishedId === plan.id ? '✓ Published' : 'Publish to Library'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'my-plans' && view === 'form' && (
        <form onSubmit={handleSave}>
          <button type="button" onClick={() => setView('list')} className="btn btn-ghost" style={{ marginBottom: 16, padding: 0 }}>
            &larr; Back to My Plans
          </button>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Subject *</label>
                <input value={form.subject} onChange={(e) => updateField('subject', e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Grade *</label>
                <input value={form.grade} onChange={(e) => updateField('grade', e.target.value)} placeholder="e.g. Grade 5" required style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Term</label>
                <input value={form.term} onChange={(e) => updateField('term', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Duration</label>
                <input value={form.duration} onChange={(e) => updateField('duration', e.target.value)} placeholder="e.g. 1 hour" style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Unit & Theme</label>
                <input value={form.unit_theme} onChange={(e) => updateField('unit_theme', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Focus Strand</label>
                <input value={form.focus_strand} onChange={(e) => updateField('focus_strand', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Topic *</label>
              <input value={form.topic} onChange={(e) => updateField('topic', e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Focus Question</label>
              <input value={form.focus_question} onChange={(e) => updateField('focus_question', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Attainment Target</label>
              <textarea value={form.attainment_target} onChange={(e) => updateField('attainment_target', e.target.value)} rows={2} style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Lesson Body</div>
            <button type="button" onClick={handleGenerate} disabled={generating} className="btn btn-secondary" style={{ fontSize: 13 }}>
              {generating ? 'Drafting…' : '✨ AI-assist all sections'}
            </button>
          </div>
          {generateError && <p className="banner banner-danger" style={{ marginBottom: 14 }}>{generateError}</p>}

          <div className="card" style={{ marginBottom: 16 }}>
            {BODY_FIELDS.map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
                <textarea
                  value={form[key as keyof ReturnType<typeof emptyForm>]}
                  onChange={(e) => updateField(key as keyof ReturnType<typeof emptyForm>, e.target.value)}
                  rows={3}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
            ))}
          </div>

          {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save lesson plan'}
          </button>
        </form>
      )}
    </div>
  )
}
