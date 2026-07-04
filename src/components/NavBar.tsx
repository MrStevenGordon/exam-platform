'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const portalPrefixes = ['/student', '/teacher', '/supervisor', '/dashboard', '/school-admin']
  const shouldHideForPortal = portalPrefixes.some((p) => pathname.startsWith(p))
  const shouldHide = ['/login', '/'].includes(pathname) || shouldHideForPortal

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
      if (profile) {
        setName(profile.full_name)
        setRole(profile.role)
      }
    }
    loadUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleHome: Record<string, string> = {
    student: '/student',
    teacher: '/teacher',
    supervisor: '/supervisor',
    admin: '/dashboard',
  }

  if (shouldHide) return null

  return (
    <div style={{
      background: '#FDF6EC',
      borderBottom: '1px solid var(--border)',
      padding: '14px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Link href={roleHome[role] || '/dashboard'} style={{ textDecoration: 'none' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.5, color: 'var(--text-secondary)', fontWeight: 700 }}>
            SMART ASSESS JA
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {role ? role.charAt(0).toUpperCase() + role.slice(1) : ''} Portal
          </div>
        </div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {name && <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{name}</span>}
        <button onClick={handleLogout} className="btn btn-ghost">
          Log out
        </button>
      </div>
    </div>
  )
}
