'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Question = { id: string; question_text: string; question_type: string; points: number; created_at: string }

export default function TeacherBankPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('questions').select('id, question_text, question_type, points, created_at').eq('created_by', user.id).eq('is_bank_question', true).order('created_at', { ascending: false })
      setQuestions(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const filtered = questions.filter((q) => !search || q.question_text.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <p className="portal-page-title">Question Bank</p>
      <p className="portal-page-sub">{questions.length} saved questions</p>
      <input type="text" placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
      {filtered.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No saved questions yet. Check "Save to bank" when creating questions.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((q) => (
          <div key={q.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, flex: 1 }}>{q.question_text}</p>
              <span className="badge badge-default" style={{ whiteSpace: 'nowrap' }}>{q.question_type.replace('_', ' ')}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{q.points} pt{q.points !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
