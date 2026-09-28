'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ALL_EXAM_CATEGORIES, ExamCategory } from '@/lib/schoolFeatures'

type SchoolRequestOption = {
  id: string; school_name: string; portal_url: string | null
  workflow_template: string; feature_flags: string[]
}

const WORKFLOW_LABELS: Record<string, string> = {
  direct_publish: 'Direct Publish (no review)',
  department_review: 'Department Head Review',
  full_review: 'Full Multi-Stage Review',
  other: 'Other (see their notes)',
}

// What each workflow a school asked for at sign-up implies for these two checkboxes — a starting
// point only. "Load current settings" (once there's something to load) always wins over this.
const WORKFLOW_DEFAULTS: Record<string, { teamLeadsEnabled: boolean; seniorTeamLeadsEnabled: boolean }> = {
  direct_publish: { teamLeadsEnabled: false, seniorTeamLeadsEnabled: false },
  department_review: { teamLeadsEnabled: true, seniorTeamLeadsEnabled: false },
  full_review: { teamLeadsEnabled: true, seniorTeamLeadsEnabled: true },
}

const CATEGORY_LABELS: Record<ExamCategory, string> = {
  pop_quiz: 'Pop Quiz',
  midterm: 'Midterm',
  monthly: 'Monthly',
  end_of_term: 'End of Term',
  end_of_year: 'End of Year',
}

// Matches src/app/build-my-school/page.tsx and src/app/owner/school-requests/page.tsx — what a
// school said mattered most to them at sign-up. Shown here for context only: every one of these
// already ships to every school, so there's nothing to actually configure from this list.
const FEATURE_LABELS: Record<string, string> = {
  group_projects: 'Group Projects',
  homework_assignments: 'Homework & Assignments',
  ai_integrity_flags: 'AI Writing-Integrity Flags',
  staff_mfa: 'Staff Mandatory MFA',
  calculator: 'Scientific Calculator',
  ai_authoring: 'AI Question Polishing / PDF Import',
}

export default function SchoolFeaturesPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<SchoolRequestOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingCurrent, setLoadingCurrent] = useState(false)
  const [loadedSummary, setLoadedSummary] = useState('')

  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [targetDatabaseUrl, setTargetDatabaseUrl] = useState('')
  const [teamLeadsEnabled, setTeamLeadsEnabled] = useState(true)
  const [seniorTeamLeadsEnabled, setSeniorTeamLeadsEnabled] = useState(true)
  const [examCategories, setExamCategories] = useState<Set<ExamCategory>>(new Set(ALL_EXAM_CATEGORIES))
  const [lessonPlanLibraryEnabled, setLessonPlanLibraryEnabled] = useState(true)
  const [smartLearningEnabled, setSmartLearningEnabled] = useState(false)
  const [smartPlayEnabled, setSmartPlayEnabled] = useState(false)
  const [aiTutorEnabled, setAiTutorEnabled] = useState(false)

  const selectedRequest = requests.find((r) => r.id === selectedRequestId)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
    if (!profile?.is_system_admin) { router.push('/login'); return }

    const { data: requestData } = await supabase
      .from('school_requests')
      .select('id, school_name, portal_url, workflow_template, feature_flags')
      .eq('status', 'provisioned')
      .order('school_name')
    const list = (requestData || []) as SchoolRequestOption[]
    setRequests(list)

    // Arriving from "Configure school tools →" on a specific request — same effect as picking
    // it from the dropdown below, just done for you.
    const requestId = new URLSearchParams(window.location.search).get('request')
    const match = requestId ? list.find((r) => r.id === requestId) : undefined
    if (match) selectRequest(match)

    setLoading(false)
  }

  // Picking a school pre-fills the review workflow from what they asked for at sign-up — a
  // starting point, overridden the moment "Load current settings" reads the real thing.
  function selectRequest(request: SchoolRequestOption) {
    setSelectedRequestId(request.id)
    const defaults = WORKFLOW_DEFAULTS[request.workflow_template]
    if (defaults) {
      setTeamLeadsEnabled(defaults.teamLeadsEnabled)
      setSeniorTeamLeadsEnabled(defaults.seniorTeamLeadsEnabled)
    }
  }

  async function handleLoadCurrent() {
    setErrorMsg('')
    setSuccessMsg('')
    setLoadedSummary('')
    if (!targetDatabaseUrl.trim()) { setErrorMsg('Paste that school\'s database connection string first.'); return }

    setLoadingCurrent(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/school-features/current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDatabaseUrl: targetDatabaseUrl.trim(), accessToken: session?.access_token }),
    })
    const data = await res.json()
    setLoadingCurrent(false)

    if (!res.ok) { setErrorMsg(data.error || 'Could not read that school\'s current settings.'); return }

    setTeamLeadsEnabled(data.teamLeadsEnabled)
    setSeniorTeamLeadsEnabled(data.seniorTeamLeadsEnabled)
    setExamCategories(new Set(data.examCategories as ExamCategory[]))
    setLessonPlanLibraryEnabled(data.lessonPlanLibraryEnabled)
    setSmartLearningEnabled(data.smartLearningEnabled)
    setSmartPlayEnabled(data.smartPlayEnabled)
    setAiTutorEnabled(data.aiTutorEnabled)
    setLoadedSummary(data.configured
      ? 'Loaded that school\'s current settings below — they matched what is actually live just now.'
      : 'That school has no settings saved yet, so these are the defaults every school starts with (not yet loaded from anywhere).')
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
    setLoadedSummary('')

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
          smartLearningEnabled,
          smartPlayEnabled,
          aiTutorEnabled,
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
        Paste a school&apos;s database connection string, then <strong>Load current settings</strong> to see what it actually has switched on before you change anything — saving always replaces the whole set, so it&apos;s easy to switch something off by accident if you save without checking first. The connection string isn&apos;t stored anywhere; used once, then forgotten.
      </p>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>School (for reference)</label>
          <select
            value={selectedRequestId}
            onChange={(e) => {
              const request = requests.find((r) => r.id === e.target.value)
              if (request) selectRequest(request)
              else setSelectedRequestId('')
            }}
            style={{ width: '100%', marginTop: 6 }}
          >
            <option value="">Select a provisioned school…</option>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>{r.school_name}{r.portal_url ? ` · ${r.portal_url}` : ''}</option>
            ))}
          </select>
          {selectedRequest && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
              At sign-up, {selectedRequest.school_name} asked for <strong>{WORKFLOW_LABELS[selectedRequest.workflow_template] || selectedRequest.workflow_template}</strong>
              {selectedRequest.feature_flags.length > 0 && <> and said <strong>{selectedRequest.feature_flags.map((f) => FEATURE_LABELS[f] || f).join(', ')}</strong> mattered most to them (already included for every school)</>}
              . The Review workflow boxes below are pre-filled from that — check <strong>Load current settings</strong> for what&apos;s actually live.
            </p>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Database connection string</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
            <input
              type="password"
              value={targetDatabaseUrl}
              onChange={(e) => { setTargetDatabaseUrl(e.target.value); setLoadedSummary('') }}
              placeholder="postgresql://postgres...@...pooler.supabase.com:5432/postgres"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            />
            <button type="button" className="btn btn-secondary" disabled={loadingCurrent || !targetDatabaseUrl.trim()} onClick={handleLoadCurrent} style={{ whiteSpace: 'nowrap' }}>
              {loadingCurrent ? 'Loading…' : 'Load current settings'}
            </button>
          </div>
          {loadedSummary && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>{loadedSummary}</p>}
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
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Included tools</label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={lessonPlanLibraryEnabled} onChange={(e) => setLessonPlanLibraryEnabled(e.target.checked)} />
            Lesson Plan Library (included automatically, no charge)
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Other Smart products (off unless switched on here)</label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input type="checkbox" checked={smartLearningEnabled} onChange={(e) => setSmartLearningEnabled(e.target.checked)} />
            Smart Learning
          </label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={smartPlayEnabled} onChange={(e) => setSmartPlayEnabled(e.target.checked)} />
            Smart Play (only once Play is live for this school)
          </label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
            <input type="checkbox" style={{ marginTop: 3 }} checked={aiTutorEnabled} onChange={(e) => setAiTutorEnabled(e.target.checked)} />
            <span>AI tutor in Smart Learning (needs Smart Learning on). Students ask an AI about a lesson. Conversations are saved and can be read by the lesson&rsquo;s teacher, school admins and the principal. Switch on only once the school has agreed to this.</span>
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
