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
  const [search, setSearch] = useState('')
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
    <div className="page-container" style={{ maxWidth: 640 }}>
      <Link href={`/teacher/exam/${examId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to exam</Link>

      <h1 style={{ marginTop: 16 }}>Add from question bank</h1>

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}
      {bankQuestions.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No saved questions in your bank yet. Check "Save to bank" when creating a question to build one up.</p>
        </div>
      )}

      <input
        type="text"
        placeholder="Search questions…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bankQuestions.filter((q) => !search || q.question_text.toLowerCase().includes(search.toLowerCase())).map((q) => (
          <label
            key={q.id}
            className="card"
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
              background: selectedIds.has(q.id) ? 'var(--accent-light)' : 'var(--card-bg)',
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(q.id)}
              onChange={() => toggle(q.id)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div className="section-label" style={{ fontSize: 11 }}>
                {q.question_type.replace('_', ' ')} — {q.points} pt{q.points !== 1 ? 's' : ''}
              </div>
              <p style={{ margin: '4px 0 0' }}>{q.question_text}</p>
            </div>
          </label>
        ))}
      </div>

      {bankQuestions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button onClick={handleAddSelected} disabled={saving} className="btn btn-primary">
            {saving ? 'Adding…' : `Add ${selectedIds.size} question(s)`}
          </button>
        </div>
      )}
    </div>
  )
}
