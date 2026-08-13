'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReportCardView from '@/components/ReportCardView'
import EmptyState from '@/components/EmptyState'

type Term = { id: string; name: string; academic_year: string }

export default function StudentReportCardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedTerm, setSelectedTerm] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setStudentId(user.id)

      const { data } = await supabase
        .from('academic_terms')
        .select('id, name, academic_year, report_cards_released')
        .eq('report_cards_released', true)
        .order('start_date', { ascending: false })

      const released = (data || []).map(({ id, name, academic_year }) => ({ id, name, academic_year }))
      setTerms(released)
      if (released.length > 0) setSelectedTerm(released[0].id)
      setLoading(false)
    }
    loadData()
  }, [router])

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 700 }}>
      <p className="portal-page-title" style={{ margin: 0 }}>My Report Card</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>{terms.length} term(s) available</p>

      {terms.length === 0 ? (
        <EmptyState icon="🎓" title="No report card available yet" description="Your school hasn't released a report card yet. Check back later." />
      ) : (
        <>
          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} style={{ marginBottom: 20, minWidth: 220 }}>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>)}
          </select>

          {selectedTerm && <ReportCardView studentId={studentId} termId={selectedTerm} mode="student" />}
        </>
      )}
    </div>
  )
}
