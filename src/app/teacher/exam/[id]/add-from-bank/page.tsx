'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type BankQuestion = {
  id: string
  question_type: string
  question_text: string
  points: number
  options: string[] | null
  correct_answer: string | null
}

export default function AddFromBankPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadBank() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('questions')
        .select('id, question_type, question_text, points, options, correct_answer')
        .eq('created_by', user.id)
        .eq('is_bank_question', true)
        .neq('draft_exam_id', examId)

      if (error) {
        setErrorMsg(error.message)
      } else {
        setBankQuestions(data || [])
      }
      setLoading(false)
    }
    loadBank()
  }, [examId, router])

  function toggle(id: string) {
    const updated = new Set(selectedIds)
    if (updated.has(id)) updated.delete(id)
    else updated.add(id)
    setSelectedIds(updated)
  }

  async function handleAddSelected() {
    if (selectedIds.size === 0) {
      alert('Select at least one question.')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('draft_exam_id', examId)

    let nextIndex = count || 0
    const toCopy = bankQuestions.filter((q) => selectedIds.has(q.id))

    const rows = toCopy.map((q) => ({
      draft_exam_id: examId,
      created_by: user?.id,
      question_type: q.question_type,
      question_text: q.question_text,
      points: q.points,
      options: q.options,
      correct_answer: q.correct_answer,
      order_index: nextIndex++,
      is_bank_question: true,
    }))

    const { error } = await supabase.from('questions').insert(rows)

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
    } else {
      router.push(`/teacher/exam/${examId}`)
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <Link href={`/teacher/exam/${examId}`} style={{ color: '#666' }}>&larr; Back to Exam</Link>

      <h1 style={{ marginTop: 16 }}>Add from Question Bank</h1>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
      {bankQuestions.length === 0 && !errorMsg && (
        <p>No saved questions in your bank yet. Check "Save to bank" when creating a question to build one up.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bankQuestions.map((q) => (
          <label
            key={q.id}
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              border: '1px solid #ddd', borderRadius: 8, padding: 12, cursor: 'pointer',
              background: selectedIds.has(q.id) ? '#eff6ff' : 'white',
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(q.id)}
              onChange={() => toggle(q.id)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                {q.question_type.replace('_', ' ')} — {q.points} pt{q.points !== 1 ? 's' : ''}
              </div>
              <p style={{ margin: '4px 0 0' }}>{q.question_text}</p>
            </div>
          </label>
        ))}
      </div>

      {bankQuestions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={handleAddSelected}
            disabled={saving}
            style={{ padding: '10px 20px', fontSize: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
          >
            {saving ? 'Adding...' : `Add ${selectedIds.size} Question(s)`}
          </button>
        </div>
      )}
    </div>
  )
}
