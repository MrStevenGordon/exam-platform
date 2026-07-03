'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Question = { id: string; question_text: string; question_type: string; points: number; created_at: string; draft_exams?: { subject: string } | null }

export default function TeacherBankPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterType, setFilterType] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('questions').select('id, question_text, question_type, points, created_at, draft_exams(subject)').eq('created_by', user.id).eq('is_bank_question', true).order('created_at', { ascending: false })
      setQuestions(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const subjects = [...new Set(questions.map((q) => (q.draft_exams as any)?.subject).filter(Boolean))]
  const questionTypes = [...new Set(questions.map((q) => q.question_type))]

  const typeLabels: Record<string, string> = {
    multiple_choice: 'Multiple Choice',
    true_false: 'True / False',
    short_answer: 'Short Answer',
    fill_blank: 'Fill in the Blank',
    essay: 'Essay',
  }

  const filtered = questions.filter((q) => {
    const matchSearch = !search || q.question_text.toLowerCase().includes(search.toLowerCase())
    const matchSubject = !filterSubject || (q.draft_exams as any)?.subject === filterSubject
    const matchType = !filterType || q.question_type === filterType
    return matchSearch && matchSubject && matchType
  })

  return (
    <div>
      <p className="portal-page-title">Question Bank</p>
      <p className="portal-page-sub">{filtered.length} of {questions.length} saved questions</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: 160 }}
        />
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          style={{ flex: 1, minWidth: 120 }}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        >
          <option value="">All types</option>
          {questionTypes.map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}
        </select>
        {(filterSubject || filterType || search) && (
          <button
            onClick={() => { setSearch(''); setFilterSubject(''); setFilterType('') }}
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
          >
            Clear
          </button>
        )}
      </div>
      {!search && !filterSubject && !filterType && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Search or filter to view questions</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Use the search box or dropdowns above to find questions in your bank.
          </p>
        </div>
      )}
      {(search || filterSubject || filterType) && filtered.length === 0 && (
        <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No questions match your search.</p></div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(search || filterSubject || filterType) && filtered.map((q) => (
          <div key={q.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, flex: 1 }}>{q.question_text}</p>
              <span className="badge badge-default" style={{ whiteSpace: 'nowrap' }}>{typeLabels[q.question_type] || q.question_type}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
              {(q.draft_exams as any)?.subject && (
                <span className="badge badge-warning" style={{ fontSize: 10 }}>{(q.draft_exams as any).subject}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
