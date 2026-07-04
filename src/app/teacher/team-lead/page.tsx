'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type TeamLeadAppointment = {
  id: string
  year_grade: number
  subject: string
}

type DraftExam = {
  id: string
  title: string
  subject: string
  exam_kind: string
  term: string | null
  target_grade: number | null
  status: string
  created_at: string
}

const EXAM_KINDS = [
  { value: 'monthly', label: 'Monthly Exam' },
  { value: 'midterm', label: 'Midterm Exam' },
  { value: 'end_of_term', label: 'End of Term' },
  { value: 'end_of_year', label: 'End of Year' },
]

const TERMS = [
  { value: 'christmas', label: 'Christmas Term (Sep–Dec)' },
  { value: 'easter', label: 'Easter Term (Jan–Apr)' },
  { value: 'summer', label: 'Summer Term (May–Jul)' },
]

const TERM_EXAM_KINDS: Record<string, string[]> = {
  christmas: ['monthly', 'end_of_term'],
  easter: ['monthly', 'midterm'],
  summer: ['monthly', 'midterm', 'end_of_year'],
}

export default function TeamLeadPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<TeamLeadAppointment[]>([])
  const [exams, setExams] = useState<DraftExam[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState('')
  const [examKind, setExamKind] = useState('')
  const [term, setTerm] = useState('')
  const [duration, setDuration] = useState(60)
  const [instructions, setInstructions] = useState('')
  const [questionsPerPage, setQuestionsPerPage] = useState(10)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: apptData } = await supabase
      .from('team_lead_appointments')
      .select('id, year_grade, subject')
      .eq('teacher_id', user.id)
    setAppointments(apptData || [])

    const { data: examData } = await supabase
      .from('draft_exams')
      .select('id, title, subject, exam_kind, term, target_grade, status, created_at')
      .eq('created_by', user.id)
      .in('exam_kind', ['monthly', 'midterm', 'end_of_term', 'end_of_year'])
      .order('created_at', { ascending: false })
    setExams(examData || [])

    setLoading(false)
  }

  async function handleCreate() {
    setSaving(true)
    setErrorMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const appt = appointments.find((a) => a.id === selectedAppointment)
    if (!appt) { setErrorMsg('Please select a year group and subject'); setSaving(false); return }

    const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', user.id).single()

    const { data, error } = await supabase.from('draft_exams').insert({
      title,
      subject: appt.subject,
      exam_kind: examKind,
      term,
      target_grade: appt.year_grade,
      duration_minutes: duration,
      instructions,
      questions_per_page: questionsPerPage,
      status: 'draft',
      created_by: user.id,
      department_id: profile?.department_id,
      direct_published: false,
    }).select().single()

    if (error) { setErrorMsg(error.message); setSaving(false); return }

    router.push(`/teacher/exam/${data.id}`)
  }

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = {
    monthly: 'Monthly', midterm: 'Midterm',
    end_of_term: 'End of Term', end_of_year: 'End of Year',
  }

  const termLabels: Record<string, string> = {
    christmas: 'Christmas', easter: 'Easter', summer: 'Summer',
  }

  // Group exams by term then kind
  const grouped: Record<string, Record<string, DraftExam[]>> = {}
  exams.forEach((e) => {
    const t = e.term || 'unassigned'
    const k = e.exam_kind
    if (!grouped[t]) grouped[t] = {}
    if (!grouped[t][k]) grouped[t][k] = []
    grouped[t][k].push(e)
  })

  const availableKinds = term ? TERM_EXAM_KINDS[term] || [] : EXAM_KINDS.map(e => e.value)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Team Lead Exams</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>
            Standardized exams for {appointments.map((a) => `Grade ${a.year_grade} ${a.subject}`).join(', ')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + New exam
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16 }}>Create standardized exam</h2>
          {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{errorMsg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Year group & subject</label>
              <select value={selectedAppointment} onChange={(e) => setSelectedAppointment(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Select…</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>Grade {a.year_grade} — {a.subject}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Term</label>
              <select value={term} onChange={(e) => { setTerm(e.target.value); setExamKind('') }} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Select term…</option>
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Exam type</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {EXAM_KINDS.filter((k) => !term || availableKinds.includes(k.value)).map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setExamKind(k.value)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${examKind === k.value ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: examKind === k.value ? 'var(--accent-light)' : 'var(--card-bg)',
                    color: examKind === k.value ? 'var(--accent-dark)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Exam title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="e.g. Grade 10 Mathematics Monthly Exam — Christmas Term 2026" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Instructions</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} placeholder="Instructions shown to students at the start of the exam…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Duration (minutes)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} style={{ width: '100%', marginTop: 4 }} min={10} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Questions per page</label>
              <select value={questionsPerPage} onChange={(e) => setQuestionsPerPage(parseInt(e.target.value))} style={{ width: '100%', marginTop: 4 }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={saving || !title || !selectedAppointment || !examKind || !term} className="btn btn-primary">
              {saving ? 'Creating…' : 'Create and add questions'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Exams grouped by term and kind */}
      {exams.length === 0 && !showForm && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No team lead exams yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Create your first standardized exam above.</p>
        </div>
      )}

      {['christmas', 'easter', 'summer', 'unassigned'].map((t) => {
        if (!grouped[t]) return null
        return (
          <div key={t} style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>
              {termLabels[t] || t} term
            </div>
            {Object.entries(grouped[t]).map(([kind, kindExams]) => (
              <div key={kind} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {kindLabels[kind] || kind}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {kindExams.map((exam) => (
                    <Link key={exam.id} href={`/teacher/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            Grade {exam.target_grade} · {exam.subject}
                          </div>
                        </div>
                        <span className={`badge ${exam.status === 'submitted' ? 'badge-warning' : exam.status === 'approved' ? 'badge-success' : 'badge-default'}`}>
                          {exam.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
