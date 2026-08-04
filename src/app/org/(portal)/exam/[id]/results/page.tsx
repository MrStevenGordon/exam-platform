'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'

type FieldDef = { id: string; label: string; order_index: number }
type ResultRow = {
  sessionId: string
  submittedAt: string
  totalScore: number | null
  maxScore: number | null
  values: Record<string, string>
}

export default function OrgExamResultsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [loading, setLoading] = useState(true)
  const [examTitle, setExamTitle] = useState('')
  const [fields, setFields] = useState<FieldDef[]>([])
  const [rows, setRows] = useState<ResultRow[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/org/login'); return }

    const { data: exam } = await supabase.from('org_exams').select('title').eq('id', examId).maybeSingle()
    if (!exam) { router.push('/org/dashboard'); return }
    setExamTitle(exam.title)

    const { data: fieldData } = await supabase
      .from('org_respondent_fields')
      .select('id, label, order_index')
      .eq('org_exam_id', examId)
      .order('order_index', { ascending: true })
    const fieldDefs = (fieldData as FieldDef[]) || []
    setFields(fieldDefs)

    const { data: sessions, error } = await supabase
      .from('org_exam_sessions')
      .select('id, submitted_at, total_score, max_possible_score')
      .eq('org_exam_id', examId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })

    if (error) { setErrorMsg(error.message); setLoading(false); return }

    const sessionIds = (sessions || []).map((s) => s.id)
    let valuesBySession: Record<string, Record<string, string>> = {}

    if (sessionIds.length > 0) {
      const { data: fieldValues } = await supabase
        .from('org_respondent_field_values')
        .select('session_id, field_id, value')
        .in('session_id', sessionIds)

      valuesBySession = (fieldValues || []).reduce((acc, fv) => {
        if (!acc[fv.session_id]) acc[fv.session_id] = {}
        acc[fv.session_id][fv.field_id] = fv.value
        return acc
      }, {} as Record<string, Record<string, string>>)
    }

    setRows((sessions || []).map((s) => ({
      sessionId: s.id,
      submittedAt: s.submitted_at,
      totalScore: s.total_score,
      maxScore: s.max_possible_score,
      values: valuesBySession[s.id] || {},
    })))

    setLoading(false)
  }

  function exportCsv() {
    const headers = [...fields.map((f) => f.label), 'Score', 'Max Score', 'Submitted At']
    const csvRows = rows.map((r) => [
      ...fields.map((f) => escapeCsv(r.values[f.id] || '')),
      r.totalScore ?? '',
      r.maxScore ?? '',
      new Date(r.submittedAt).toLocaleString(),
    ])
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${examTitle.replace(/\s+/g, '_') || 'results'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function escapeCsv(value: string) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <Link href="/org/dashboard" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to dashboard</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 20px' }}>
        <p className="portal-page-title" style={{ margin: 0 }}>{examTitle}: Results</p>
        <button onClick={exportCsv} disabled={rows.length === 0} className="btn btn-secondary">Export CSV</button>
      </div>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {rows.length === 0 ? (
        <EmptyState icon="🗳️" title="No submissions yet" description="Responses will show up here as respondents complete the exam." />
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {fields.map((f) => <th key={f.id} style={{ textAlign: 'left', padding: '8px 12px' }}>{f.label}</th>)}
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Score</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sessionId} style={{ borderBottom: '1px solid var(--border)' }}>
                  {fields.map((f) => <td key={f.id} style={{ padding: '8px 12px' }}>{r.values[f.id] || 'N/A'}</td>)}
                  <td style={{ padding: '8px 12px' }}>{r.totalScore ?? 'N/A'} / {r.maxScore ?? 'N/A'}</td>
                  <td style={{ padding: '8px 12px' }}>{new Date(r.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
