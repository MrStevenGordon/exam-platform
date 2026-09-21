'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSchoolFeatures } from '@/lib/schoolFeatures'
import { downloadLessonPlanDocx } from '@/lib/lessonPlanDocx'
import { downloadLessonPlanPdf } from '@/lib/lessonPlanPdf'
import type { PlanForDoc } from '@/lib/lessonPlanContent'
import { Lesson, LESSON_FIELDS, UNIT_FIELDS, emptyLesson, lessonsForPlan, legacyFieldsFromLessons, cleanLessons } from '@/lib/lessonPlan'

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
  sub_topics: string | null
  prerequisite_knowledge: string | null
  four_cs: string | null
  subject_practices: string | null
  general_objectives: string | null
  key_terms_formulae: string | null
  lessons: Lesson[] | null
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
  sub_topics?: string | null
  prerequisite_knowledge?: string | null
  four_cs?: string | null
  subject_practices?: string | null
  general_objectives?: string | null
  key_terms_formulae?: string | null
  lessons?: Lesson[] | null
  published_at: string
}

// Fields from the original single-lesson format that aren't part of the unit
// layout. Kept (under "More NSC details") so nothing already written is lost.
const NSC_EXTRA_FIELDS: { key: 'specific_objective' | 'skills' | 'prior_learning' | 'materials' | 'success_criteria'; label: string }[] = [
  { key: 'specific_objective', label: 'Specific Objective' },
  { key: 'skills', label: 'Skills' },
  { key: 'prior_learning', label: 'Prior Learning' },
  { key: 'materials', label: 'Materials' },
  { key: 'success_criteria', label: 'Success Criteria' },
]

type PlanForm = {
  subject: string; grade: string; term: string; unit_theme: string; focus_strand: string; topic: string
  focus_question: string; duration: string; attainment_target: string
  specific_objective: string; skills: string; prior_learning: string; materials: string; success_criteria: string
  sub_topics: string; prerequisite_knowledge: string; four_cs: string; subject_practices: string; general_objectives: string; key_terms_formulae: string
  lessons: Lesson[]
}

function emptyForm(): PlanForm {
  return {
    subject: '', grade: '', term: '', unit_theme: '', focus_strand: '', topic: '',
    focus_question: '', duration: '', attainment_target: '',
    specific_objective: '', skills: '', prior_learning: '', materials: '', success_criteria: '',
    sub_topics: '', prerequisite_knowledge: '', four_cs: '', subject_practices: '', general_objectives: '', key_terms_formulae: '',
    lessons: [emptyLesson()],
  }
}

// Works for both a saved plan and a library plan (same shape, nulls allowed).
function formFromPlan(plan: LessonPlan | SharedPlan): PlanForm {
  return {
    subject: plan.subject, grade: plan.grade, term: plan.term || '', unit_theme: plan.unit_theme || '',
    focus_strand: plan.focus_strand || '', topic: plan.topic, focus_question: plan.focus_question || '',
    duration: plan.duration || '', attainment_target: plan.attainment_target || '',
    specific_objective: plan.specific_objective || '', skills: plan.skills || '',
    prior_learning: plan.prior_learning || '', materials: plan.materials || '', success_criteria: plan.success_criteria || '',
    sub_topics: plan.sub_topics || '', prerequisite_knowledge: plan.prerequisite_knowledge || '', four_cs: plan.four_cs || '',
    subject_practices: plan.subject_practices || '', general_objectives: plan.general_objectives || '', key_terms_formulae: plan.key_terms_formulae || '',
    lessons: lessonsForPlan(plan),
  }
}

// Read-only view of a plan (used for library plans): unit overview, then each
// lesson. A plan from before units existed shows as a single lesson.
function PlanBody({ plan }: { plan: SharedPlan }) {
  const lessons = lessonsForPlan(plan)
  const show = (label: string, value: string | null | undefined) =>
    value ? (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: 14, marginTop: 4, whiteSpace: 'pre-wrap' }}>{value}</div>
      </div>
    ) : null
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        {UNIT_FIELDS.map(({ key, label }) => <div key={key}>{show(label, plan[key])}</div>)}
        {NSC_EXTRA_FIELDS.map(({ key, label }) => <div key={key}>{show(label, plan[key])}</div>)}
      </div>
      {lessons.map((lesson, i) => (
        <div key={i} className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Lesson {i + 1}{lesson.title ? ` – ${lesson.title}` : ''}</div>
          {LESSON_FIELDS.map(({ key, label }) => <div key={key}>{show(label, lesson[key])}</div>)}
        </div>
      ))}
    </>
  )
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
  const [form, setForm] = useState<PlanForm>(emptyForm())
  const [lessonCount, setLessonCount] = useState(1)
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
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const features = await getSchoolFeatures()
      if (!features.lessonPlanLibraryEnabled) { router.push('/teacher'); return }
      setHasAccess(true)
      setCheckingAccess(false)
      loadPlans(user.id)
    }
    checkAccess()
  }, [router])

  // "My Plans" is the signed-in person's own plans only. Row-level security
  // also lets HODs/admins read every plan, so it must be filtered here too.
  async function loadPlans(userId: string) {
    setLoading(true)
    const { data } = await supabase.from('lesson_plans').select('*').eq('teacher_id', userId).order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  function startNew() {
    setActionError('')
    setEditingId(null)
    setForm(emptyForm())
    setGenerateError('')
    setErrorMsg('')
    setView('form')
  }

  function startEdit(plan: LessonPlan) {
    setEditingId(plan.id)
    const next = formFromPlan(plan)
    setForm(next)
    setLessonCount(Math.min(5, Math.max(1, next.lessons.length)))
    setGenerateError('')
    setErrorMsg('')
    setView('form')
  }

  function updateField(key: Exclude<keyof PlanForm, 'lessons'>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateLesson(index: number, key: keyof Lesson, value: string) {
    setForm((prev) => ({ ...prev, lessons: prev.lessons.map((l, i) => (i === index ? { ...l, [key]: value } : l)) }))
  }

  function addLesson() {
    setForm((prev) => (prev.lessons.length >= 12 ? prev : { ...prev, lessons: [...prev.lessons, emptyLesson()] }))
  }

  function removeLesson(index: number) {
    const lesson = form.lessons[index]
    const hasContent = Object.values(lesson).some((v) => v.trim())
    if (hasContent && !confirm(`Remove Lesson ${index + 1}${lesson.title ? ` (${lesson.title})` : ''}? Its content will be lost.`)) return
    setForm((prev) => ({ ...prev, lessons: prev.lessons.length > 1 ? prev.lessons.filter((_, i) => i !== index) : prev.lessons }))
  }

  async function handleGenerate() {
    if (!form.subject.trim() || !form.grade.trim() || !form.topic.trim()) {
      setGenerateError('Fill in Subject, Grade, and Topic first.')
      return
    }
    const hasWrittenLessons = form.lessons.some((l) => Object.values(l).some((v) => v.trim()))
    if (hasWrittenLessons && !confirm('The AI draft will replace the lessons you have already written. Continue?')) return
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
          duration: form.duration || undefined,
          lessonCount,
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
        sub_topics: data.subTopics || prev.sub_topics,
        prerequisite_knowledge: data.prerequisiteKnowledge || prev.prerequisite_knowledge,
        four_cs: data.fourCs || prev.four_cs,
        subject_practices: data.subjectPractices || prev.subject_practices,
        general_objectives: data.generalObjectives || prev.general_objectives,
        key_terms_formulae: data.keyTermsFormulae || prev.key_terms_formulae,
        specific_objective: data.specificObjective || prev.specific_objective,
        skills: data.skills || prev.skills,
        success_criteria: data.successCriteria || prev.success_criteria,
        lessons: Array.isArray(data.lessons) && data.lessons.length > 0 ? cleanLessons(data.lessons) : prev.lessons,
      }))
    } catch {
      setGenerateError('Could not reach the AI service. Please try again.')
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

    // Lesson 1 is mirrored onto the original 5E columns so older screens and
    // the shared library keep working.
    const lessons = cleanLessons(form.lessons)
    const payload = { ...form, lessons, ...legacyFieldsFromLessons(lessons), teacher_id: user.id, updated_at: new Date().toISOString() }

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
    loadPlans(user.id)
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
    const next = formFromPlan(plan)
    setForm(next)
    setLessonCount(Math.min(5, Math.max(1, next.lessons.length)))
    setViewingPlan(null)
    setGenerateError('')
    setErrorMsg('')
    setTab('my-plans')
    setView('form')
  }

  // Saves the plan as a Word or PDF file (works for saved plans, the plan
  // being edited, and library plans alike).
  async function handleDownload(plan: PlanForDoc, key: string, format: 'docx' | 'pdf') {
    const busyKey = `${key}:${format}`
    setDownloadingKey(busyKey)
    setActionError('')
    try {
      await (format === 'pdf' ? downloadLessonPlanPdf(plan) : downloadLessonPlanDocx(plan))
    } catch (err) {
      console.error('Lesson plan download failed', err)
      setActionError(`Could not create the ${format === 'pdf' ? 'PDF' : 'Word'} file. Please try again.`)
    } finally {
      setDownloadingKey(null)
    }
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
          subTopics: plan.sub_topics || undefined, prerequisiteKnowledge: plan.prerequisite_knowledge || undefined,
          fourCs: plan.four_cs || undefined, subjectPractices: plan.subject_practices || undefined,
          generalObjectives: plan.general_objectives || undefined, keyTermsFormulae: plan.key_terms_formulae || undefined,
          lessons: lessonsForPlan(plan),
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
          <PlanBody plan={viewingPlan} />
          {actionError && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{actionError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => copyToMyPlans(viewingPlan)} className="btn btn-primary">
              Copy to My Plans
            </button>
            {(['docx', 'pdf'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => handleDownload(viewingPlan, 'library-' + viewingPlan.id, format)}
                disabled={downloadingKey !== null}
                className="btn btn-secondary"
              >
                {downloadingKey === `library-${viewingPlan.id}:${format}` ? 'Preparing…' : `Download ${format === 'pdf' ? 'PDF' : 'Word'}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'my-plans' && view === 'list' && (
        <>
          <button onClick={startNew} className="btn btn-primary" style={{ marginBottom: 20 }}>
            + New Lesson Plan
          </button>
          {actionError && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{actionError}</p>}
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
                        {plan.subject} · {plan.grade}{plan.term ? ` · ${plan.term}` : ''}{Array.isArray(plan.lessons) && plan.lessons.length > 1 ? ` · ${plan.lessons.length} lessons` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                      {(['docx', 'pdf'] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDownload(plan, plan.id, format) }}
                          disabled={downloadingKey !== null && downloadingKey.startsWith(plan.id)}
                          aria-label={`Download as ${format === 'pdf' ? 'PDF' : 'Word'}`}
                          className="btn btn-secondary"
                          style={{ fontSize: 12.5, flex: 'none' }}
                        >
                          {downloadingKey === `${plan.id}:${format}` ? 'Preparing…' : format === 'pdf' ? 'PDF' : 'Word'}
                        </button>
                      ))}
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
                <input value={form.grade} onChange={(e) => updateField('grade', e.target.value)} placeholder="e.g. Grade 9" required style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Term</label>
                <input value={form.term} onChange={(e) => updateField('term', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Duration</label>
                <input value={form.duration} onChange={(e) => updateField('duration', e.target.value)} placeholder="e.g. 4 lessons × 60 minutes" style={{ width: '100%', marginTop: 4 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Topic *</label>
              <input value={form.topic} onChange={(e) => updateField('topic', e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Unit overview</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }} htmlFor="lesson-count">Lessons</label>
              <select id="lesson-count" value={lessonCount} onChange={(e) => setLessonCount(Number(e.target.value))} disabled={generating}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button" onClick={handleGenerate} disabled={generating} className="btn btn-secondary" style={{ fontSize: 13 }}>
                {generating ? 'Drafting…' : '✨ AI-assist plan'}
              </button>
            </div>
          </div>
          {generateError && <p className="banner banner-danger" style={{ marginBottom: 14 }}>{generateError}</p>}

          <div className="card" style={{ marginBottom: 16 }}>
            {UNIT_FIELDS.map(({ key, label, rows, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
                <textarea value={form[key]} onChange={(e) => updateField(key, e.target.value)} rows={rows} placeholder={placeholder} style={{ width: '100%', marginTop: 4 }} />
              </div>
            ))}
          </div>

          <details style={{ marginBottom: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>More NSC details (optional)</summary>
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
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
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Focus Question</label>
                <input value={form.focus_question} onChange={(e) => updateField('focus_question', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Attainment Target</label>
                <textarea value={form.attainment_target} onChange={(e) => updateField('attainment_target', e.target.value)} rows={2} style={{ width: '100%', marginTop: 4 }} />
              </div>
              {NSC_EXTRA_FIELDS.map(({ key, label }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
                  <textarea value={form[key]} onChange={(e) => updateField(key, e.target.value)} rows={2} style={{ width: '100%', marginTop: 4 }} />
                </div>
              ))}
            </div>
          </details>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
            Lessons ({form.lessons.length})
          </div>
          {form.lessons.map((lesson, i) => (
            <div key={i} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Lesson {i + 1}</div>
                <input
                  value={lesson.title}
                  onChange={(e) => updateLesson(i, 'title', e.target.value)}
                  placeholder="Lesson title, e.g. Introduction to Simple Interest"
                  aria-label={`Lesson ${i + 1} title`}
                  style={{ flex: 1 }}
                />
                {form.lessons.length > 1 && (
                  <button type="button" onClick={() => removeLesson(i)} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }}>
                    Remove
                  </button>
                )}
              </div>
              {LESSON_FIELDS.map(({ key, label, rows }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
                  <textarea value={lesson[key]} onChange={(e) => updateLesson(i, key, e.target.value)} rows={rows} style={{ width: '100%', marginTop: 4 }} />
                </div>
              ))}
            </div>
          ))}
          <button type="button" onClick={addLesson} className="btn btn-secondary" style={{ marginBottom: 20 }} disabled={form.lessons.length >= 12}>
            + Add lesson
          </button>

          {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}
          {actionError && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{actionError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save lesson plan'}
            </button>
            {(['docx', 'pdf'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => handleDownload(form, 'form', format)}
                disabled={downloadingKey !== null || !form.topic.trim()}
                className="btn btn-secondary"
              >
                {downloadingKey === `form:${format}` ? 'Preparing…' : `Download ${format === 'pdf' ? 'PDF' : 'Word'}`}
              </button>
            ))}
          </div>
        </form>
      )}
    </div>
  )
}
