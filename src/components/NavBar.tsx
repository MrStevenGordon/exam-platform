'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { presenceSignOut } from '@/lib/presence'
import { ASSESS_HOME } from '@/lib/products'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [authed, setAuthed] = useState(false)
  const portalPrefixes = ['/student', '/teacher', '/supervisor', '/principal', '/learning', '/school-admin', '/org', '/owner', '/school-setup', '/take-exam', '/build-my-school', '/play']
  const shouldHide = [
    '/login', '/', '/coming-soon', '/maintenance', '/terms', '/privacy', '/demo-exam', '/download', '/it-resources',
    '/change-password', '/forgot-password', '/mfa',
  ].includes(pathname) || pathname.startsWith('/demo-exam/') || portalPrefixes.some((p) => pathname.startsWith(p))

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthed(false); setName(''); setRole(''); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
      if (profile) {
        setName(profile.full_name)
        setRole(profile.role)
      }
      setAuthed(true)
    }
    loadUser()

    // A previous sign-in's name/role otherwise stuck around in this component's state across a
    // client-side log out + log back in as someone else, since the effect above only ever ran
    // once on mount — this keeps it in sync with whoever is actually signed in right now.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setAuthed(false); setName(''); setRole(''); return }
      loadUser()
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await presenceSignOut()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (shouldHide || !authed) return null

  return (
    <div style={{
      background: '#FDF6EC',
      borderBottom: '1px solid var(--border)',
      padding: '14px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Link href={ASSESS_HOME[role] || '/'} style={{ textDecoration: 'none' }}>
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
