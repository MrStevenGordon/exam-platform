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

  // Save to personal question bank
  const [saveToBank, setSaveToBank] = useState(false)

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
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto' }}>
      <h1>Add Question</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>Question Type</label><br />
          <select
            value={questionType}
            onChange={(e) => {
              setQuestionType(e.target.value as QuestionType)
              resetTypeSpecificFields()
            }}
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
            <option value="fill_blank">Fill in the Blank</option>
            <option value="essay">Essay</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>
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
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Points</label><br />
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
            style={{ width: 100, padding: 8, fontSize: 16 }}
          />
        </div>

        {questionType === 'multiple_choice' && (
          <div style={{ marginBottom: 16 }}>
            <label>Options (select the correct one)</label>
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
                  style={{ flex: 1, padding: 8, fontSize: 16 }}
                />
              </div>
            ))}
          </div>
        )}

        {questionType === 'true_false' && (
          <div style={{ marginBottom: 16 }}>
            <label>Correct Answer</label><br />
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
            <label>Correct Answer (must match exactly, case-sensitive)</label><br />
            <input
              value={exactAnswer}
              onChange={(e) => setExactAnswer(e.target.value)}
              required
              style={{ width: '100%', padding: 8, fontSize: 16 }}
            />
          </div>
        )}

        {questionType === 'essay' && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f0f0f0', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#555' }}>
              Essay questions are graded manually by a teacher after the exam — no correct answer needed here.
            </p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />
            Save this question to my personal question bank for reuse
          </label>
        </div>

        {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

        <button type="submit" disabled={saving} style={{ padding: '10px 20px', fontSize: 16 }}>
          {saving ? 'Saving...' : 'Save Question'}
        </button>
      </form>
    </div>
  )
}
