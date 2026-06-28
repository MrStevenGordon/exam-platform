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
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

      if (error) {
        setErrorMsg(`${error.message} (code: ${error.code})`)
      } else {
        setProfile(data)
      }
      setLoading(false)
    }
    loadProfile()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  if (errorMsg) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <p style={{ color: 'red' }}>Error loading profile: {errorMsg}</p>
        <button onClick={handleLogout}>Log Out</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Welcome, {profile?.full_name}</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px' }}>
          Log Out
        </button>
      </div>
      <p>Role: <strong>{profile?.role}</strong></p>

      {profile?.role === 'admin' && (
        <div style={{ marginTop: 24, padding: 16, background: '#f0f0f0' }}>
          <h2>Admin Tools</h2>
          <p>Manage users, exams, and system settings here.</p>
        </div>
      )}
    </div>
  )
}
