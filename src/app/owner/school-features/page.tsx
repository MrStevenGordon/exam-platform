'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ALL_EXAM_CATEGORIES, ExamCategory } from '@/lib/schoolFeatures'

type SchoolRequestOption = { id: string; school_name: string; portal_url: string | null }

const CATEGORY_LABELS: Record<ExamCategory, string> = {
  pop_quiz: 'Pop Quiz',
  midterm: 'Midterm',
  monthly: 'Monthly',
  end_of_term: 'End of Term',
  end_of_year: 'End of Year',
}

export default function SchoolFeaturesPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<SchoolRequestOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [targetDatabaseUrl, setTargetDatabaseUrl] = useState('')
  const [teamLeadsEnabled, setTeamLeadsEnabled] = useState(true)
  const [seniorTeamLeadsEnabled, setSeniorTeamLeadsEnabled] = useState(true)
  const [examCategories, setExamCategories] = useState<Set<ExamCategory>>(new Set(ALL_EXAM_CATEGORIES))
  const [lessonPlanLibraryEnabled, setLessonPlanLibraryEnabled] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
    if (!profile?.is_system_admin) { router.push('/login'); return }

    const { data: requestData } = await supabase
      .from('school_requests')
      .select('id, school_name, portal_url')
      .eq('status', 'provisioned')
      .order('school_name')
    setRequests(requestData || [])

    setLoading(false)
  }

  function toggleCategory(cat: ExamCategory) {
    const next = new Set(examCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setExamCategories(next)
  }

  async function handleSave() {
    setErrorMsg('')
    setSuccessMsg('')
    if (!targetDatabaseUrl.trim()) { setErrorMsg('Paste that school\'s database connection string.'); return }

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/school-features/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetDatabaseUrl: targetDatabaseUrl.trim(),
        features: {
          teamLeadsEnabled,
          seniorTeamLeadsEnabled,
          examCategories: Array.from(examCategories),
          lessonPlanLibraryEnabled,
        },
        accessToken: session?.access_token,
      }),
    })
    const data = await res.json()

    if (!res.ok) setErrorMsg(data.error || 'Something went wrong.')
    else {
      setSuccessMsg('Saved. That school\'s app now reflects these settings.')
      setTargetDatabaseUrl('')
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: 4 }}>Configure school tools</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Right after provisioning a new school, paste its database connection string here (you'll have it on hand from creating its Supabase project) to set which tools it uses. This isn't stored anywhere; used once, then forgotten.
      </p>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>School (for reference)</label>
          <select value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
            <option value="">Select a provisioned school…</option>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>{r.school_name}{r.portal_url ? ` · ${r.portal_url}` : ''}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Database connection string</label>
          <input
            type="password"
            value={targetDatabaseUrl}
            onChange={(e) => setTargetDatabaseUrl(e.target.value)}
            placeholder="postgresql://postgres...@...pooler.supabase.com:5432/postgres"
            style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Review workflow</label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input type="checkbox" checked={teamLeadsEnabled} onChange={(e) => setTeamLeadsEnabled(e.target.checked)} />
            Team leads (department-level exam creation)
          </label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={seniorTeamLeadsEnabled} onChange={(e) => setSeniorTeamLeadsEnabled(e.target.checked)} />
            Senior team leads (cross-department vetting)
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Add-ons</label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={lessonPlanLibraryEnabled} onChange={(e) => setLessonPlanLibraryEnabled(e.target.checked)} />
            Lesson Plan Library ($12.00/teacher/yr)
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Exam categories offered</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ALL_EXAM_CATEGORIES.map((cat) => (
              <label key={cat} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
                <input type="checkbox" checked={examCategories.has(cat)} onChange={() => toggleCategory(cat)} />
                {CATEGORY_LABELS[cat]}
              </label>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
      </div>
    </div>
  )
}
