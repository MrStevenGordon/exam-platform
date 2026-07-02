'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank' | 'essay'

export default function AddQuestionPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice')
  const [questionText, setQuestionText] = useState('')
  const [points, setPoints] = useState(1)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // Multiple choice fields
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0)

  // True/False field
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<'true' | 'false'>('true')

  // Short answer / fill in the blank field
  const [exactAnswer, setExactAnswer] = useState('')

  // Marking points for multi-point short answer
  const [markingPoints, setMarkingPoints] = useState([{ text: '', keywords: '', marks: 1 }])

  // Save to personal question bank
  const [saveToBank, setSaveToBank] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [polishError, setPolishError] = useState('')

  function addMarkingPoint() {
    setMarkingPoints([...markingPoints, { text: '', keywords: '', marks: 1 }])
  }

  function updateMarkingPoint(index: number, field: string, value: any) {
    const updated = [...markingPoints]
    updated[index] = { ...updated[index], [field]: value }
    setMarkingPoints(updated)
  }

  function removeMarkingPoint(index: number) {
    setMarkingPoints(markingPoints.filter((_, i) => i !== index))
  }

  async function handlePolish() {
    if (!questionText.trim()) {
      setPolishError('Write a draft question first.')
      return
    }
    setPolishing(true)
    setPolishError('')

    try {
      const res = await fetch('/api/polish-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionType,
          questionText,
          options: questionType === 'multiple_choice' ? options : undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPolishError(data.error || 'Something went wrong.')
        setPolishing(false)
        return
      }

      if (data.improved_question) setQuestionText(data.improved_question)
      if (data.improved_options && questionType === 'multiple_choice') {
        setOptions(data.improved_options)
      }
    } catch (err) {
      setPolishError('Could not reach the AI service. Try again.')
    }

    setPolishing(false)
  }

  function updateOption(index: number, value: string) {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  function resetTypeSpecificFields() {
    setOptions(['', '', '', ''])
    setCorrectOptionIndex(0)
    setTrueFalseAnswer('true')
    setExactAnswer('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('draft_exam_id', examId)

    let payload: any = {
      draft_exam_id: examId,
      created_by: user.id,
      question_type: questionType,
      question_text: questionText,
      points,
      order_index: count || 0,
      is_bank_question: saveToBank,
      marking_points: (questionType === 'short_answer' || questionType === 'fill_blank') && markingPoints.some(p => p.text)
        ? markingPoints.map(p => ({ text: p.text, keywords: p.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean), marks: Number(p.marks) }))
        : null,
      total_marks: (questionType === 'short_answer' || questionType === 'fill_blank') && markingPoints.some(p => p.text)
        ? markingPoints.reduce((sum, p) => sum + Number(p.marks), 0)
        : null,
    }

    if (questionType === 'multiple_choice') {
      if (options.some((o) => o.trim() === '')) {
        setErrorMsg('Please fill in all 4 options.')
        setSaving(false)
        return
      }
      payload.options = options
      payload.correct_answer = options[correctOptionIndex]
    }

    if (questionType === 'true_false') {
      payload.correct_answer = trueFalseAnswer
    }

    if (questionType === 'short_answer' || questionType === 'fill_blank') {
      if (exactAnswer.trim() === '') {
        setErrorMsg('Please provide the correct answer.')
        setSaving(false)
        return
      }
      payload.correct_answer = exactAnswer.trim()
    }

    // essay: no correct_answer needed, manually graded later

    const { error } = await supabase.from('questions').insert(payload)

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
    } else {
      router.push(`/teacher/exam/${examId}`)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <h1>Add question</h1>

      <div className="card" style={{ marginTop: 20 }}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Question type</label><br />
          <select
            value={questionType}
            onChange={(e) => {
              setQuestionType(e.target.value as QuestionType)
              resetTypeSpecificFields()
            }}
            style={{ width: '100%', marginTop: 6 }}
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
            <option value="fill_blank">Fill in the Blank</option>
            <option value="essay">Essay</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {questionType === 'fill_blank'
              ? 'Question (use ___ to mark the blank)'
              : 'Question'}
          </label><br />
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
            rows={3}
            placeholder={questionType === 'fill_blank' ? 'The capital of France is ___.' : ''}
            style={{ width: '100%', marginTop: 6 }}
          />
          {questionType !== 'essay' && (
            <button
              type="button"
              onClick={handlePolish}
              disabled={polishing}
              className="btn btn-secondary"
              style={{ marginTop: 8, fontSize: 13, padding: '6px 14px' }}
            >
              {polishing ? 'Polishing…' : '✨ Polish with AI'}
            </button>
          )}
          {polishError && <p className="banner banner-danger" style={{ marginTop: 8, fontSize: 13 }}>{polishError}</p>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Points</label><br />
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
            style={{ width: 100, marginTop: 6 }}
          />
        </div>

        {questionType === 'multiple_choice' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Options (select the correct one)</label>
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="radio"
                  checked={correctOptionIndex === i}
                  onChange={() => setCorrectOptionIndex(i)}
                />
                <input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  required
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </div>
        )}

        {questionType === 'true_false' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Correct answer</label><br />
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  checked={trueFalseAnswer === 'true'}
                  onChange={() => setTrueFalseAnswer('true')}
                />
                True
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  checked={trueFalseAnswer === 'false'}
                  onChange={() => setTrueFalseAnswer('false')}
                />
                False
              </label>
            </div>
          </div>
        )}

        {(questionType === 'short_answer' || questionType === 'fill_blank') && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Single correct answer (for exact match grading)</label><br />
            <input
              value={exactAnswer}
              onChange={(e) => setExactAnswer(e.target.value)}
              style={{ width: '100%', marginTop: 6 }}
              placeholder="Leave blank if using marking points below"
            />
          </div>
        )}

        {(questionType === 'short_answer' || questionType === 'fill_blank') && (
          <div style={{ marginBottom: 16, padding: 14, background: 'var(--page-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Marking points (for multi-part answers)</label>
              <button type="button" onClick={addMarkingPoint} className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                + Add point
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
              Each marking point has its own mark value and keywords. Auto-grading checks if the student's answer contains any keyword — teacher can override.
            </p>
            {markingPoints.map((point, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 10, background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Point {i + 1}</span>
                  {markingPoints.length > 1 && (
                    <button type="button" onClick={() => removeMarkingPoint(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                  )}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Expected answer / marking guide</label>
                  <input
                    value={point.text}
                    onChange={(e) => updateMarkingPoint(i, 'text', e.target.value)}
                    placeholder="e.g. double coincidence of wants"
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Keywords for auto-grading (comma separated)</label>
                  <input
                    value={point.keywords}
                    onChange={(e) => updateMarkingPoint(i, 'keywords', e.target.value)}
                    placeholder="e.g. coincidence, wants, barter, trade"
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Marks for this point</label>
                  <input
                    type="number"
                    min={1}
                    value={point.marks}
                    onChange={(e) => updateMarkingPoint(i, 'marks', e.target.value)}
                    style={{ width: 80, marginTop: 4 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {questionType === 'essay' && (
          <div className="banner" style={{ marginBottom: 16, background: 'var(--border)', color: 'var(--text-secondary)' }}>
            Essay questions are graded manually by a teacher after the exam — no correct answer needed here.
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />
            Save this question to my personal question bank for reuse
          </label>
        </div>

        {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save question'}
        </button>
      </form>
      </div>
    </div>
  )
}
