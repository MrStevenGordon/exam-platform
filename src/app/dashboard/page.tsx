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

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    loadProfile()
  }, [router])

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <h1>Welcome, {profile?.full_name}</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Signed in as <strong style={{ color: 'var(--text-primary)' }}>{profile?.role}</strong>
      </p>

      {profile?.role === 'admin' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Admin tools</h2>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
            Manage users, exams, and system settings here.
          </p>
        </div>
      )}

      {profile?.role === 'teacher' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Teacher tools</h2>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
            Create and manage exams here.
          </p>
        </div>
      )}

      {profile?.role === 'supervisor' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Supervisor tools</h2>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
            Review and approve exams here.
          </p>
        </div>
      )}

      {profile?.role === 'student' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Your exams</h2>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
            Available exams will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
