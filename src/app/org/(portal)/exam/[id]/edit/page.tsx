'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank'

type OrgQuestion = {
  id: string
  question_type: QuestionType
  question_text: string
  options: string[] | null
  correct_answer: string | null
  points: number
  order_index: number
}

type RespondentField = {
  id: string
  label: string
  field_type: 'text' | 'number' | 'email'
  required: boolean
  order_index: number
}

export default function OrgExamEditPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [examCode, setExamCode] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [retentionDays, setRetentionDays] = useState(60)
  const [showScore, setShowScore] = useState(false)
  const [status, setStatus] = useState('draft')
  const [savingSettings, setSavingSettings] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive')

  const [questions, setQuestions] = useState<OrgQuestion[]>([])
  const [fields, setFields] = useState<RespondentField[]>([])

  const [qType, setQType] = useState<QuestionType>('multiple_choice')
  const [qText, setQText] = useState('')
  const [qPoints, setQPoints] = useState(1)
  const [qOptions, setQOptions] = useState(['', '', '', ''])
  const [qCorrectIndex, setQCorrectIndex] = useState(0)
  const [qTrueFalse, setQTrueFalse] = useState<'true' | 'false'>('true')
  const [qExactAnswer, setQExactAnswer] = useState('')
  const [addingQuestion, setAddingQuestion] = useState(false)

  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'email'>('text')
  const [fieldRequired, setFieldRequired] = useState(true)
  const [addingField, setAddingField] = useState(false)

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/org/login'); return }

    const { data: exam, error } = await supabase
      .from('org_exams')
      .select('title, instructions, exam_code, access_password, retention_days, show_score_to_respondent, status, organization_id')
      .eq('id', examId)
      .single()

    if (error || !exam) { router.push('/org/dashboard'); return }

    const { data: sub } = await supabase
      .from('organization_subscriptions')
      .select('subscription_status')
      .eq('organization_id', exam.organization_id)
      .maybeSingle()
    setSubscriptionStatus(sub?.subscription_status || 'inactive')

    setTitle(exam.title)
    setInstructions(exam.instructions || '')
    setExamCode(exam.exam_code)
    setAccessPassword(exam.access_password)
    setRetentionDays(exam.retention_days)
    setShowScore(exam.show_score_to_respondent)
    setStatus(exam.status)

    const { data: questionData } = await supabase
      .from('org_exam_questions')
      .select('id, question_type, question_text, options, correct_answer, points, order_index')
      .eq('org_exam_id', examId)
      .order('order_index', { ascending: true })
    setQuestions((questionData as OrgQuestion[]) || [])

    const { data: fieldData } = await supabase
      .from('org_respondent_fields')
      .select('id, label, field_type, required, order_index')
      .eq('org_exam_id', examId)
      .order('order_index', { ascending: true })
    setFields((fieldData as RespondentField[]) || [])

    setLoading(false)
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    setErrorMsg('')
    const { error } = await supabase
      .from('org_exams')
      .update({
        title: title.trim() || 'Untitled exam',
        instructions: instructions.trim() || null,
        access_password: accessPassword.trim(),
        retention_days: Math.min(90, Math.max(30, retentionDays)),
        show_score_to_respondent: showScore,
      })
      .eq('id', examId)
    if (error) setErrorMsg(error.message)
    setSavingSettings(false)
  }

  function resetQuestionForm() {
    setQText(''); setQPoints(1); setQOptions(['', '', '', '']); setQCorrectIndex(0); setQTrueFalse('true'); setQExactAnswer('')
  }

  async function handleAddQuestion() {
    if (!qText.trim()) { setErrorMsg('Enter question text first.'); return }
    setAddingQuestion(true)
    setErrorMsg('')

    const payload: {
      org_exam_id: string
      question_type: QuestionType
      question_text: string
      points: number
      order_index: number
      options?: string[]
      correct_answer?: string
    } = {
      org_exam_id: examId,
      question_type: qType,
      question_text: qText.trim(),
      points: qPoints,
      order_index: questions.length,
    }

    if (qType === 'multiple_choice') {
      if (qOptions.some((o) => !o.trim())) { setErrorMsg('Fill in all 4 options.'); setAddingQuestion(false); return }
      payload.options = qOptions
      payload.correct_answer = qOptions[qCorrectIndex]
    } else if (qType === 'true_false') {
      payload.correct_answer = qTrueFalse
    } else {
      if (!qExactAnswer.trim()) { setErrorMsg('Enter the correct answer.'); setAddingQuestion(false); return }
      payload.correct_answer = qExactAnswer.trim()
    }

    const { data, error } = await supabase.from('org_exam_questions').insert(payload).select().single()
    if (error) { setErrorMsg(error.message); setAddingQuestion(false); return }

    setQuestions((prev) => [...prev, data as OrgQuestion])
    resetQuestionForm()
    setAddingQuestion(false)
  }

  async function handleRemoveQuestion(id: string) {
    await supabase.from('org_exam_questions').delete().eq('id', id)
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  async function handleAddField() {
    if (!fieldLabel.trim()) { setErrorMsg('Enter a field label first.'); return }
    setAddingField(true)
    setErrorMsg('')

    const { data, error } = await supabase
      .from('org_respondent_fields')
      .insert({ org_exam_id: examId, label: fieldLabel.trim(), field_type: fieldType, required: fieldRequired, order_index: fields.length })
      .select()
      .single()

    if (error) { setErrorMsg(error.message); setAddingField(false); return }
    setFields((prev) => [...prev, data as RespondentField])
    setFieldLabel(''); setFieldType('text'); setFieldRequired(true)
    setAddingField(false)
  }

  async function handleRemoveField(id: string) {
    await supabase.from('org_respondent_fields').delete().eq('id', id)
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  async function handlePublish() {
    if (questions.length === 0) { setErrorMsg('Add at least one question before publishing.'); return }
    if (subscriptionStatus !== 'active') { setErrorMsg('An active subscription is required to publish. Visit Billing to subscribe.'); return }
    setPublishing(true)
    setErrorMsg('')
    const { error } = await supabase
      .from('org_exams')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', examId)
    if (error) { setErrorMsg(error.message); setPublishing(false); return }
    setStatus('published')
    setPublishing(false)
  }

  if (loading) return <div>Loading…</div>

  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/take-exam?code=${examCode}` : ''

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>{title || 'Untitled exam'}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${status === 'published' ? 'badge-success' : 'badge-default'}`}>
            {status === 'published' ? 'Published' : 'Draft'}
          </span>
          {status === 'published' && (
            <Link href={`/org/exam/${examId}/results`}><button className="btn btn-secondary">View results</button></Link>
          )}
        </div>
      </div>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Settings</h2>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Instructions (optional)</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} style={{ width: '100%', marginTop: 6 }} />
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Exam code</label><br />
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{examCode}</span>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Password</label>
            <input value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} style={{ width: 160, marginTop: 6, display: 'block' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Retention (days)</label>
            <input type="number" min={30} max={90} value={retentionDays} onChange={(e) => setRetentionDays(parseInt(e.target.value) || 60)} style={{ width: 100, marginTop: 6, display: 'block' }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={showScore} onChange={(e) => setShowScore(e.target.checked)} />
            Show score to respondent immediately after they submit
          </label>
        </div>

        {shareLink && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Share link: <span style={{ fontFamily: 'monospace' }}>{shareLink}</span>
          </div>
        )}

        <button onClick={handleSaveSettings} disabled={savingSettings} className="btn btn-secondary">
          {savingSettings ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Questions ({questions.length})</h2>

        {questions.map((q, i) => (
          <div key={q.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Q{i + 1} · {q.question_type.replace('_', ' ')} · {q.points} pt{q.points !== 1 ? 's' : ''}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{q.question_text}</div>
            </div>
            <button onClick={() => handleRemoveQuestion(q.id)} className="btn btn-ghost" style={{ fontSize: 11 }}>Remove</button>
          </div>
        ))}

        <div style={{ marginTop: 16, padding: 14, background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Question type</label>
            <select value={qType} onChange={(e) => setQType(e.target.value as QuestionType)} style={{ width: '100%', marginTop: 6 }}>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="true_false">True / False</option>
              <option value="short_answer">Short Answer</option>
              <option value="fill_blank">Fill in the Blank</option>
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Question text</label>
            <textarea value={qText} onChange={(e) => setQText(e.target.value)} rows={2} style={{ width: '100%', marginTop: 6 }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Points</label>
            <input type="number" min={1} value={qPoints} onChange={(e) => setQPoints(parseInt(e.target.value) || 1)} style={{ width: 100, marginTop: 6, display: 'block' }} />
          </div>

          {qType === 'multiple_choice' && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Options (select the correct one)</label>
              {qOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <input type="radio" checked={qCorrectIndex === i} onChange={() => setQCorrectIndex(i)} />
                  <input
                    value={opt}
                    onChange={(e) => { const updated = [...qOptions]; updated[i] = e.target.value; setQOptions(updated) }}
                    placeholder={`Option ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
            </div>
          )}

          {qType === 'true_false' && (
            <div style={{ marginBottom: 10, display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={qTrueFalse === 'true'} onChange={() => setQTrueFalse('true')} /> True
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={qTrueFalse === 'false'} onChange={() => setQTrueFalse('false')} /> False
              </label>
            </div>
          )}

          {(qType === 'short_answer' || qType === 'fill_blank') && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Correct answer (exact match)</label>
              <input value={qExactAnswer} onChange={(e) => setQExactAnswer(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
            </div>
          )}

          <button onClick={handleAddQuestion} disabled={addingQuestion} className="btn btn-primary" style={{ fontSize: 13 }}>
            {addingQuestion ? 'Adding…' : '+ Add question'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Respondent info fields</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Choose what respondents fill in before taking the exam (e.g. Name, Phone Number).
        </p>

        {fields.map((f) => (
          <div key={f.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14 }}>
              {f.label} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({f.field_type}{f.required ? ', required' : ', optional'})</span>
            </div>
            <button onClick={() => handleRemoveField(f.id)} className="btn btn-ghost" style={{ fontSize: 11 }}>Remove</button>
          </div>
        ))}

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Label</label><br />
            <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="e.g. Phone Number" style={{ marginTop: 6, width: 200 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Type</label><br />
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value as 'text' | 'number' | 'email')} style={{ marginTop: 6 }}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} /> Required
          </label>
          <button onClick={handleAddField} disabled={addingField} className="btn btn-secondary" style={{ fontSize: 13 }}>
            {addingField ? 'Adding…' : '+ Add field'}
          </button>
        </div>
      </div>

      {status !== 'published' && (
        <>
          {subscriptionStatus !== 'active' && (
            <div className="banner" style={{ marginBottom: 10, fontSize: 13 }}>
              An active subscription is required to publish. <Link href="/org/billing" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>Visit Billing</Link> to subscribe — you can keep building this exam in the meantime.
            </div>
          )}
          <button onClick={handlePublish} disabled={publishing} className="btn btn-primary" style={{ width: '100%' }}>
            {publishing ? 'Publishing…' : 'Publish exam'}
          </button>
        </>
      )}
    </div>
  )
}
