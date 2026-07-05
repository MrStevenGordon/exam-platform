'use client'

import { useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ParsedQuestion = {
  question_text: string
  question_type: string
  options: string[] | null
  correct_answer: string | null
  points: number
  marking_points: { text: string; marks: number }[] | null
  selected: boolean
  editing: boolean
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  short_answer: 'Short Answer',
  essay: 'Essay',
  fill_blank: 'Fill in the Blank',
}

export default function ImportPDFPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [examTitle, setExamTitle] = useState('')
  const [examSubject, setExamSubject] = useState('')
  const [questions, setQuestions] = useState<ParsedQuestion[]>([])
  const [savedCount, setSavedCount] = useState(0)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setErrorMsg('Please select a PDF file.'); return }
    if (file.type !== 'application/pdf') { setErrorMsg('Only PDF files are supported.'); return }
    if (file.size > 10 * 1024 * 1024) { setErrorMsg('File too large. Maximum size is 10MB.'); return }

    setLoading(true)
    setErrorMsg('')

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]

      try {
        const res = await fetch('/api/import-pdf-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        })

        const data = await res.json()

        if (!res.ok || data.error) {
          setErrorMsg(data.error || 'Failed to process PDF.')
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setErrorMsg('No questions found in this PDF. Make sure it contains a clearly formatted exam.')
          setLoading(false)
          return
        }

        setExamTitle(data.title || '')
        setExamSubject(data.subject || '')
        setQuestions(data.questions.map((q: any) => ({
          ...q,
          selected: true,
          editing: false,
        })))
        setStep('review')
      } catch (err) {
        setErrorMsg('Something went wrong. Please try again.')
      }
      setLoading(false)
    }
    reader.readAsDataURL(file)
  }

  function updateQuestion(index: number, field: string, value: any) {
    setQuestions((prev) => prev.map((q, i) => i === index ? { ...q, [field]: value } : q))
  }

  function toggleSelected(index: number) {
    setQuestions((prev) => prev.map((q, i) => i === index ? { ...q, selected: !q.selected } : q))
  }

  function selectAll() {
    setQuestions((prev) => prev.map((q) => ({ ...q, selected: true })))
  }

  function deselectAll() {
    setQuestions((prev) => prev.map((q) => ({ ...q, selected: false })))
  }

  async function handleSave() {
    setStep('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const selectedQuestions = questions.filter((q) => q.selected)
    let saved = 0

    // Get current max order_index
    const { data: existing } = await supabase
      .from('questions')
      .select('order_index')
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: false })
      .limit(1)

    let orderIndex = (existing?.[0]?.order_index ?? -1) + 1

    for (const q of selectedQuestions) {
      // Extract keywords from marking points
      const markingPoints = q.marking_points?.map((mp) => {
        const stopWords = new Set(['a','an','the','is','are','was','were','and','or','of','in','to','for','on','with','that','this'])
        const keywords = mp.text.toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 2 && !stopWords.has(w))
        return { text: mp.text, keywords, marks: mp.marks }
      }) || null

      const { error } = await supabase.from('questions').insert({
        draft_exam_id: examId,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        points: q.points || 1,
        marking_points: markingPoints,
        total_marks: markingPoints ? markingPoints.reduce((s, mp) => s + mp.marks, 0) : null,
        order_index: orderIndex++,
        is_bank_question: false,
        created_by: user.id,
      })

      if (!error) saved++
    }

    setSavedCount(saved)
    router.push(`/teacher/exam/${examId}`)
  }

  if (step === 'upload') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Link href={`/teacher/exam/${examId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Back to exam
        </Link>
        <h1 style={{ marginTop: 16, marginBottom: 4 }}>Import from PDF</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Upload a PDF exam paper and Claude AI will extract the questions automatically. You'll review and edit before saving.
        </p>

        <div className="card">
          <h2 style={{ marginBottom: 8 }}>Upload exam PDF</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Works best with typed, well-formatted exam papers. Scanned handwritten papers may have lower accuracy.
          </p>

          <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 10, padding: 32, textAlign: 'center', marginBottom: 16, background: 'var(--page-bg)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <p style={{ fontWeight: 700, margin: '0 0 8px' }}>Select a PDF file</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Maximum size: 10MB</p>
            <input ref={fileRef} type="file" accept=".pdf" style={{ marginBottom: 8 }} />
          </div>

          {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

          <div style={{ background: 'var(--accent-light)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
            <strong>Tips for best results:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Use typed PDFs (not scanned/photographed papers)</li>
              <li>MCQ questions should have clearly labelled options (A, B, C, D)</li>
              <li>Questions should be numbered sequentially</li>
              <li>Include the answer key if you want correct answers imported automatically</li>
            </ul>
          </div>

          <button onClick={handleUpload} disabled={loading} className="btn btn-primary">
            {loading ? 'Processing PDF… this may take 15-30 seconds' : 'Upload and extract questions'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'saving') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💾</div>
        <h2>Saving questions…</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Please wait while we save your questions to the exam.</p>
      </div>
    )
  }

  const selectedCount = questions.filter((q) => q.selected).length

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Link href={`/teacher/exam/${examId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        ← Back to exam
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Review extracted questions</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            {questions.length} questions found · {selectedCount} selected to import
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={deselectAll} className="btn btn-ghost" style={{ fontSize: 12 }}>Deselect all</button>
          <button onClick={selectAll} className="btn btn-ghost" style={{ fontSize: 12 }}>Select all</button>
          <button onClick={handleSave} disabled={selectedCount === 0} className="btn btn-primary">
            Import {selectedCount} question{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="banner banner-warning" style={{ marginBottom: 20 }}>
        Review each question carefully — AI extraction is not perfect. Edit any questions that need fixing before importing.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map((q, i) => (
          <div key={i} className="card" style={{ borderLeft: `4px solid ${q.selected ? 'var(--accent)' : 'var(--border-strong)'}`, opacity: q.selected ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={q.selected}
                  onChange={() => toggleSelected(i)}
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Q{i + 1}</span>
                <span className="badge badge-default" style={{ fontSize: 10 }}>{TYPE_LABELS[q.question_type] || q.question_type}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
              </div>
              <button
                onClick={() => updateQuestion(i, 'editing', !q.editing)}
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
              >
                {q.editing ? 'Done editing' : 'Edit'}
              </button>
            </div>

            {q.editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Question text</label>
                  <textarea
                    value={q.question_text}
                    onChange={(e) => updateQuestion(i, 'question_text', e.target.value)}
                    rows={3}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Type</label>
                    <select value={q.question_type} onChange={(e) => updateQuestion(i, 'question_type', e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Points</label>
                    <input type="number" value={q.points} onChange={(e) => updateQuestion(i, 'points', parseInt(e.target.value))} min={1} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                </div>
                {q.correct_answer && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Correct answer</label>
                    <input value={q.correct_answer} onChange={(e) => updateQuestion(i, 'correct_answer', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="exam-content">
                <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>{q.question_text}</p>
                {q.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {q.options.map((opt, oi) => (
                      <div key={oi} style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, background: q.correct_answer && opt.startsWith(q.correct_answer.charAt(0)) ? 'var(--success-bg)' : 'var(--page-bg)' }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {q.correct_answer && !q.options && (
                  <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✓ {q.correct_answer}</div>
                )}
                {q.marking_points && q.marking_points.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Marking points</div>
                    {q.marking_points.map((mp, mi) => (
                      <div key={mi} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>
                        {mi + 1}. {mp.text} ({mp.marks} mark{mp.marks !== 1 ? 's' : ''})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Link href={`/teacher/exam/${examId}`}>
          <button className="btn btn-ghost">Cancel</button>
        </Link>
        <button onClick={handleSave} disabled={selectedCount === 0} className="btn btn-primary">
          Import {selectedCount} question{selectedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
