'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Teacher = {
  id: string
  full_name: string
  department_id: string | null
}

type TeamLeadAppointment = {
  id: string
  teacher_id: string
  year_grade: number
  subject: string
}

type SeniorTeamLeadAppointment = {
  id: string
  teacher_id: string
}

const SUBJECTS = [
  'Mathematics', 'English Language', 'English Literature',
  'Principles of Business', 'Principles of Accounts',
  'Biology', 'Chemistry', 'Physics', 'Integrated Science',
  'History', 'Geography', 'Social Studies',
  'Physical Education', 'Visual Arts', 'Music',
  'Spanish', 'French', 'Information Technology',
  'Technical Drawing', 'Home Economics', 'Agriculture',
]

export default function AppointmentsPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([])
  const [teamLeads, setTeamLeads] = useState<TeamLeadAppointment[]>([])
  const [seniorTeamLeads, setSeniorTeamLeads] = useState<SeniorTeamLeadAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // New team lead form
  const [tlTeacher, setTlTeacher] = useState('')
  const [tlGrade, setTlGrade] = useState('')
  const [tlSubject, setTlSubject] = useState('')
  const [showTLForm, setShowTLForm] = useState(false)

  // New senior team lead form
  const [stlTeacher, setStlTeacher] = useState('')
  const [stlSubject, setStlSubject] = useState('')
  const [stlGrade, setStlGrade] = useState('')
  const [showSTLForm, setShowSTLForm] = useState(false)
  const [deptSubjects, setDeptSubjects] = useState<string[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id')
      .eq('id', user.id)
      .single()

    // Load teachers in this department (for team lead appointments)
    const { data: teacherData } = await supabase
      .from('profiles')
      .select('id, full_name, department_id')
      .eq('role', 'teacher')
      .eq('department_id', profile?.department_id)
      .order('full_name')
    setTeachers(teacherData || [])

    // Load ALL teachers school-wide (for senior team lead appointments)
    const { data: allTeacherData } = await supabase
      .from('profiles')
      .select('id, full_name, department_id, departments!profiles_department_id_fkey(name)')
      .eq('role', 'teacher')
      .order('full_name')
    setAllTeachers((allTeacherData as any) || [])

    // Load existing team lead appointments
    const { data: tlData } = await supabase
      .from('team_lead_appointments')
      .select('id, teacher_id, year_grade, subject')
    setTeamLeads(tlData || [])

    // Load existing senior team lead appointments
    const { data: stlData } = await supabase
      .from('senior_team_lead_appointments')
      .select('id, teacher_id, subject, year_grade')
    setSeniorTeamLeads(stlData || [])

    // Load department subjects
    const { data: subjData } = await supabase
      .from('department_subjects')
      .select('subject')
      .eq('department_id', profile?.department_id)
      .order('subject')
    setDeptSubjects((subjData || []).map((s) => s.subject))

    setLoading(false)
  }

  async function handleAppointTeamLead() {
    if (!tlTeacher || !tlGrade || !tlSubject) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', user!.id).single()

    const { error } = await supabase.from('team_lead_appointments').insert({
      teacher_id: tlTeacher,
      department_id: profile?.department_id,
      year_grade: parseInt(tlGrade),
      subject: tlSubject,
      appointed_by: user!.id,
    })

    if (!error) {
      setSuccessMsg('Team lead appointed successfully')
      setTlTeacher(''); setTlGrade(''); setTlSubject('')
      setShowTLForm(false)
      loadData()
    }
    setSaving(false)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function handleAppointSeniorTeamLead() {
    if (!stlTeacher) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', user!.id).single()

    const { error } = await supabase.from('senior_team_lead_appointments').insert({
      teacher_id: stlTeacher,
      department_id: profile?.department_id,
      subject: stlSubject,
      year_grade: stlGrade ? parseInt(stlGrade) : null,
      appointed_by: user!.id,
    })

    if (!error) {
      setSuccessMsg('Senior team lead appointed successfully')
      setStlTeacher('')
      setStlSubject('')
      setStlGrade('')
      setShowSTLForm(false)
      loadData()
    }
    setSaving(false)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function handleRemoveTeamLead(id: string) {
    await supabase.from('team_lead_appointments').delete().eq('id', id)
    loadData()
  }

  async function handleRemoveSeniorTeamLead(id: string) {
    await supabase.from('senior_team_lead_appointments').delete().eq('id', id)
    loadData()
  }

  if (loading) return <div>Loading…</div>

  const getTeacherName = (id: string) => teachers.find((t) => t.id === id)?.full_name || 'Unknown'

  return (
    <div>
      <p className="portal-page-title">Appointments</p>
      <p className="portal-page-sub">Appoint team leads and senior team leads for your department</p>

      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}

      {/* Team Leads */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Team Leads</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Set monthly, midterm, end of term, and end of year exams for their assigned year group and subject
            </p>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setShowTLForm(!showTLForm)}>
            + Appoint
          </button>
        </div>

        {showTLForm && (
          <div style={{ padding: 16, background: 'var(--page-bg)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Teacher</label>
                <select value={tlTeacher} onChange={(e) => setTlTeacher(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select teacher…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Year group</label>
                <select value={tlGrade} onChange={(e) => setTlGrade(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select grade…</option>
                  {[7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</label>
                <select value={tlSubject} onChange={(e) => setTlSubject(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select subject…</option>
                  {deptSubjects.length > 0
                    ? deptSubjects.map((s) => <option key={s} value={s}>{s}</option>)
                    : <option disabled>No subjects added — go to Subjects page first</option>
                  }
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAppointTeamLead} disabled={saving || !tlTeacher || !tlGrade || !tlSubject} className="btn btn-primary" style={{ fontSize: 12 }}>
                {saving ? 'Saving…' : 'Appoint team lead'}
              </button>
              <button onClick={() => setShowTLForm(false)} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        )}

        {teamLeads.length === 0 && !showTLForm && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No team leads appointed yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teamLeads.map((tl) => (
            <div key={tl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{getTeacherName(tl.teacher_id)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Grade {tl.year_grade} · {tl.subject}
                </div>
              </div>
              <button onClick={() => handleRemoveTeamLead(tl.id)} className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--danger)' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Senior Team Leads */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Senior Team Leads</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Conduct final vetting of standardized exams before publishing
            </p>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setShowSTLForm(!showSTLForm)}>
            + Appoint
          </button>
        </div>

        {showSTLForm && (
          <div style={{ padding: 16, background: 'var(--page-bg)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Teacher (any department)</label>
                <select value={stlTeacher} onChange={(e) => setStlTeacher(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select teacher…</option>
                  {allTeachers.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}{t.departments?.name ? ` (${t.departments.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</label>
                <select value={stlSubject} onChange={(e) => setStlSubject(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select subject…</option>
                  {deptSubjects.length > 0
                    ? deptSubjects.map((s) => <option key={s} value={s}>{s}</option>)
                    : <option disabled>No subjects added — go to Subjects page first</option>
                  }
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Year group</label>
                <select value={stlGrade} onChange={(e) => setStlGrade(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select grade…</option>
                  {[7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAppointSeniorTeamLead} disabled={saving || !stlTeacher || !stlSubject} className="btn btn-primary" style={{ fontSize: 12 }}>
                {saving ? 'Saving…' : 'Appoint senior team lead'}
              </button>
              <button onClick={() => setShowSTLForm(false)} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        )}

        {seniorTeamLeads.length === 0 && !showSTLForm && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No senior team leads appointed yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seniorTeamLeads.map((stl) => (
            <div key={stl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{getTeacherName(stl.teacher_id)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {(stl as any).subject || 'All subjects'}{(stl as any).year_grade ? ` · Grade ${(stl as any).year_grade}` : ''}
                </div>
              </div>
              <button onClick={() => handleRemoveSeniorTeamLead(stl.id)} className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--danger)' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
