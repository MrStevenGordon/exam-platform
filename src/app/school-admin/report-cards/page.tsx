'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { currentAcademicYear } from '@/lib/reportCard'
import ReportCardView from '@/components/ReportCardView'

type Term = { id: string; name: string; academic_year: string; start_date: string; end_date: string; report_cards_released: boolean }
type Student = { id: string; full_name: string; student_id: string | null }

export default function AdminReportCardsPage() {
  const [loading, setLoading] = useState(true)
  const [terms, setTerms] = useState<Term[]>([])
  const [students, setStudents] = useState<Student[]>([])

  const [showForm, setShowForm] = useState(false)
  const [termName, setTermName] = useState('')
  const [termYear, setTermYear] = useState(currentAcademicYear())
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: termData }, { data: studentData }] = await Promise.all([
      supabase.from('academic_terms').select('id, name, academic_year, start_date, end_date, report_cards_released').order('start_date', { ascending: false }),
      supabase.from('profiles').select('id, full_name, student_id').eq('role', 'student').order('full_name'),
    ])
    setTerms(termData || [])
    setStudents(studentData || [])
    setLoading(false)
  }

  async function handleCreateTerm() {
    if (!termName.trim() || !termYear.trim() || !termStart || !termEnd) return
    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase.from('academic_terms').insert({
      name: termName.trim(),
      academic_year: termYear.trim(),
      start_date: termStart,
      end_date: termEnd,
    })

    if (error) { setErrorMsg(error.message); setSaving(false); return }

    setTermName(''); setTermStart(''); setTermEnd('')
    setShowForm(false); setSaving(false)
    setSuccessMsg('Term created.')
    setTimeout(() => setSuccessMsg(''), 3000)
    loadData()
  }

  async function handleToggleRelease(term: Term) {
    const action = term.report_cards_released ? 'unrelease' : 'release'
    if (!confirm(`${action === 'release' ? 'Release' : 'Unrelease'} report cards for ${term.name}? ${action === 'release' ? 'Students will be able to see their report cards immediately.' : 'Students will no longer be able to see their report cards.'}`)) return
    await supabase.from('academic_terms').update({ report_cards_released: !term.report_cards_released }).eq('id', term.id)
    loadData()
  }

  async function handleDeleteTerm(term: Term) {
    if (!confirm(`Delete ${term.name}? Any comments and attendance entered for it will also be removed.`)) return
    await supabase.from('academic_terms').delete().eq('id', term.id)
    if (selectedTerm === term.id) setSelectedTerm('')
    loadData()
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Report Cards</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>{terms.length} terms</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New term</button>
      </div>

      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 16 }}>New term</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Name</label>
              <input value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="Term 1" style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Academic year</label>
              <input value={termYear} onChange={(e) => setTermYear(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Start date</label>
              <input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>End date</label>
              <input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreateTerm} disabled={saving || !termName || !termStart || !termEnd} className="btn btn-primary">{saving ? 'Creating…' : 'Create'}</button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {terms.map((t) => (
          <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 13 }}>({t.academic_year})</span></div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {new Date(t.start_date).toLocaleDateString()} – {new Date(t.end_date).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${t.report_cards_released ? 'badge-success' : 'badge-default'}`}>{t.report_cards_released ? 'Released' : 'Not released'}</span>
              <button className="btn btn-secondary" onClick={() => handleToggleRelease(t)}>{t.report_cards_released ? 'Unrelease' : 'Release'}</button>
              <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--danger)' }} onClick={() => handleDeleteTerm(t)}>Delete</button>
            </div>
          </div>
        ))}
        {terms.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No terms yet.</p>}
      </div>

      <div className="section-label" style={{ marginBottom: 8 }}>View a student's report card</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} style={{ flex: '1 1 240px' }}>
          <option value="">Select a student…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.student_id ? ` (${s.student_id})` : ''}</option>)}
        </select>
        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} style={{ flex: '1 1 200px' }}>
          <option value="">Select a term…</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>)}
        </select>
      </div>

      {selectedStudent && selectedTerm && (
        <ReportCardView studentId={selectedStudent} termId={selectedTerm} mode="staff" editable />
      )}
    </div>
  )
}
