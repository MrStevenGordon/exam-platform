'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type OrgExam = { id: string; title: string; status: string; exam_code: string; created_at: string }

export default function OrgDashboardPage() {
  const router = useRouter()
  const [exams, setExams] = useState<OrgExam[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/org/login'); return }

    const { data: org } = await supabase.from('organizations').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!org) { router.push('/org/login'); return }

    const { data } = await supabase
      .from('org_exams')
      .select('id, title, status, exam_code, created_at')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })

    setExams(data || [])
    setLoading(false)
  }

  function generateExamCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function handleCreate() {
    setCreating(true)
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: org } = await supabase.from('organizations').select('id').eq('auth_user_id', user!.id).maybeSingle()
    if (!org) { setErrorMsg('Organization not found.'); setCreating(false); return }

    const { data: exam, error } = await supabase
      .from('org_exams')
      .insert({
        organization_id: org.id,
        title: 'Untitled exam',
        exam_code: generateExamCode(),
        access_password: generateExamCode(),
      })
      .select('id')
      .single()

    if (error || !exam) {
      setErrorMsg(error?.message || 'Could not create exam.')
      setCreating(false)
      return
    }

    router.push(`/org/exam/${exam.id}/edit`)
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Your exams</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>Build and publish one-off assessments</p>
        </div>
        <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
          {creating ? 'Creating…' : '+ New exam'}
        </button>
      </div>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {exams.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No exams yet. Create your first one above.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/org/exam/${exam.id}/edit`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Code: {exam.exam_code}</div>
              </div>
              <span className={`badge ${exam.status === 'published' ? 'badge-success' : 'badge-default'}`}>
                {exam.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
