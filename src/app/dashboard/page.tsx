'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  full_name: string
  role: string
}

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      // Year promotion and graduation moved into School Settings, inside the school admin portal.
      if (data?.role === 'admin') { router.replace('/school-admin/settings'); return }
      setProfile(data)
      setLoading(false)
    }
    loadProfile()
  }, [router])

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <h1>Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Welcome, {profile?.full_name} · {profile?.role}
      </p>

      {profile?.role === 'teacher' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Teacher portal</h2>
        </div>
      )}

      {profile?.role === 'supervisor' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>HOD portal</h2>
        </div>
      )}

      {profile?.role === 'student' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Student portal</h2>
        </div>
      )}
    </div>
  )
}
