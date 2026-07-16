'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ResetRequest = {
  id: string
  full_name: string
  identifier: string
  user_type: string
  status: string
  created_at: string
  resolved_at: string | null
}

export default function PasswordRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<ResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('is_system_admin, role').eq('id', user.id).single()
    if (!profile?.is_system_admin && profile?.role !== 'admin') { router.push('/login'); return }

    const { data } = await supabase
      .from('password_reset_requests')
      .select('id, full_name, identifier, user_type, status, created_at, resolved_at')
      .order('created_at', { ascending: false })

    setRequests(data || [])
    setLoading(false)
  }

  async function markResolved(id: string) {
    if (!confirm('Mark this request as resolved? Only do this after you\'ve actually reset the password from the Staff or Students page.')) return
    await supabase.from('password_reset_requests').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
    loadData()
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status === 'resolved')
  const visible = showResolved ? resolved : pending

  const roleLink = (userType: string) => userType === 'student' ? '/school-admin/students' : '/school-admin/staff'

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Password reset requests</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            {pending.length} pending · {resolved.length} resolved
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? 'Show pending' : 'Show resolved'}
        </button>
      </div>

      <div className="banner" style={{ marginBottom: 20, fontSize: 13 }}>
        To resolve a request: open the person's record on the <strong>Staff</strong> or <strong>Students</strong> page, click <strong>Reset password</strong> there, then return here and mark this request resolved.
      </div>

      {visible.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            {showResolved ? 'No resolved requests yet.' : 'No pending requests. 🎉'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {r.identifier} · {r.user_type}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Requested {new Date(r.created_at).toLocaleString()}
                  {r.resolved_at && ` · Resolved ${new Date(r.resolved_at).toLocaleString()}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href={roleLink(r.user_type)}>
                  <button className="btn btn-secondary" style={{ fontSize: 12 }}>Find & reset</button>
                </Link>
                {r.status === 'pending' && (
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => markResolved(r.id)}>
                    Mark resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
