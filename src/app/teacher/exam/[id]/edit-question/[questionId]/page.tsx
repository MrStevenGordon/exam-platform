'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EssayRubricEditor from '@/components/EssayRubricEditor'
import { isEssayRubricAvailable } from '@/lib/essayRubric'
import { checkRubric, cleanRubric, parseStoredRubric, rubricTotal, writtenPoints, type EssayPointDraft } from '@/lib/essayRubricPure'
import MathToolbar from '@/components/MathToolbar'
import MathSymbolPicker from '@/components/MathSymbolPicker'

export default function EditQuestionPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const questionId = params.questionId as string

  const [questionType, setQuestionType] = useState('multiple_choice')
  const [questionText, setQuestionText] = useState('')
  const [points, setPoints] = useState(1)
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [markingPoints, setMarkingPoints] = useState<{ text: string; marks: number }[]>([])
  const [essayRows, setEssayRows] = useState<EssayPointDraft[]>([{ text: '', marks: 1 }])
  const [rubricOn, setRubricOn] = useState(false)
  useEffect(() => { isEssayRubricAvailable().then(setRubricOn) }, [])
  const essayTotal = rubricTotal(writtenPoints(essayRows).map((r) => ({ marks: Number(r.marks) || 0 })))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: q, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single()

      if (error || !q) {
        setErrorMsg(error?.message || 'Question not found.')
        setNotFound(true)
        setLoading(false)
        return
      }

      setQuestionType(q.question_type)
      setQuestionText(q.question_text || '')
      setPoints(q.points || 1)
      setOptions(q.options || ['', '', '', ''])
      setCorrectAnswer(q.correct_answer || '')
      setMarkingPoints(q.marking_points || [])
      const stored = parseStoredRubric(q.essay_rubric)
      setEssayRows(stored.length > 0 ? stored : [{ text: '', marks: 1 }])
      setLoading(false)
    }
    load()
  }, [questionId])

  async function handleSave() {
    if (!questionText.trim()) { setErrorMsg('Question text is required.'); return }
    setSaving(true)

    const stopWords = new Set(['a','an','the','is','are','was','were','and','or','of','in','to','for','on','with'])
    const updatedMarkingPoints = markingPoints.map((mp) => ({
      ...mp,
      keywords: mp.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w))
    }))

    // An essay never carries keyword marking points (exam scoring would mark them by keyword); its marking points are kept apart.
    const isEssay = questionType === 'essay'
    let essayRubric: ReturnType<typeof cleanRubric> = null
    if (isEssay && rubricOn) {
      const problem = checkRubric(essayRows)
      if (problem) { setErrorMsg(problem); setSaving(false); return }
      essayRubric = cleanRubric(essayRows)
    }
    const { data, error } = await supabase.from('questions').update({
      question_type: questionType,
      question_text: questionText.trim(),
      points: essayRubric ? rubricTotal(essayRubric) : points,
      options: ['multiple_choice', 'true_false'].includes(questionType) ? options.filter(Boolean) : null,
      correct_answer: correctAnswer.trim() || null,
      marking_points: !isEssay && updatedMarkingPoints.length > 0 ? updatedMarkingPoints : null,
      total_marks: !isEssay && updatedMarkingPoints.length > 0 ? updatedMarkingPoints.reduce((s, mp) => s + mp.marks, 0) : null,
      ...(rubricOn ? { essay_rubric: isEssay ? essayRubric : null } : {}),
    }).eq('id', questionId).select()

    if (error) { setErrorMsg(error.message); setSaving(false); return }
    if (!data || data.length === 0) { setErrorMsg('Could not save — this question may have been removed.'); setSaving(false); return }
    router.push(`/teacher/exam/${examId}`)
  }

  if (loading) return <div>Loading…</div>
  if (notFound) return <div style={{ maxWidth: 700, margin: '0 auto' }}><div className="banner banner-danger">{errorMsg}</div></div>

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Link href={`/teacher/exam/${examId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        ← Back to exam
      </Link>
      <h1 className="portal-page-title" style={{ marginTop: 16, marginBottom: 4 }}>Edit question</h1>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Question type</label>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
            <option value="essay">Essay</option>
            <option value="fill_blank">Fill in the Blank</option>
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Question text</label>
          <MathToolbar textareaId="edit-question-text" value={questionText} onChange={setQuestionText} />
          <textarea id="edit-question-text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={4} style={{ width: '100%', borderRadius: '0 0 8px 8px', marginTop: 0 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Points</label>
          <input type="number" value={questionType === 'essay' && rubricOn && essayTotal > 0 ? essayTotal : points} disabled={questionType === 'essay' && rubricOn && essayTotal > 0} onChange={(e) => setPoints(parseInt(e.target.value))} min={1} style={{ width: 80, marginTop: 4 }} />
          {questionType === 'essay' && rubricOn && essayTotal > 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 10 }}>Set by the marking points below</span>}
        </div>

        {questionType === 'multiple_choice' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Options</label>
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, minWidth: 20 }}>{String.fromCharCode(65 + i)}.</span>
                <input id={`edit-option-${i}`} value={opt} onChange={(e) => { const updated = [...options]; updated[i] = e.target.value; setOptions(updated) }} style={{ flex: 1 }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                <MathSymbolPicker inputId={`edit-option-${i}`} value={opt} onChange={(val) => { const updated = [...options]; updated[i] = val; setOptions(updated) }} />
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Correct answer</label>
              <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Select correct answer…</option>
                {options.filter(Boolean).map((opt, i) => (
                  <option key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {questionType === 'true_false' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Correct answer</label>
            <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
              <option value="">Select…</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>
        )}

        {questionType === 'essay' && rubricOn && <EssayRubricEditor rows={essayRows} onChange={setEssayRows} idPrefix="edit-essay-point" />}

        {(questionType === 'short_answer' || questionType === 'fill_blank') && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Marking points</label>
            {markingPoints.map((mp, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <input value={mp.text} onChange={(e) => { const updated = [...markingPoints]; updated[i] = { ...updated[i], text: e.target.value }; setMarkingPoints(updated) }} style={{ flex: 1 }} placeholder="Expected answer" />
                <input type="number" value={mp.marks} onChange={(e) => { const updated = [...markingPoints]; updated[i] = { ...updated[i], marks: parseInt(e.target.value) }; setMarkingPoints(updated) }} style={{ width: 60 }} min={1} />
                <button onClick={() => setMarkingPoints(markingPoints.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setMarkingPoints([...markingPoints, { text: '', marks: 1 }])} className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }}>
              + Add marking point
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link href={`/teacher/exam/${examId}`}>
            <button className="btn btn-ghost">Cancel</button>
          </Link>
        </div>
      </div>
    </div>
  )
}
