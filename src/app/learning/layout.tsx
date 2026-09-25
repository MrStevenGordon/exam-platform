'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'
import { supabase } from '@/lib/supabase'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'
import { getEnabledProducts, productHref } from '@/lib/products'

type Role = 'student' | 'teacher' | 'supervisor' | 'admin' | 'principal'
const ROLES: Role[] = ['student', 'teacher', 'supervisor', 'admin', 'principal']

const STUDENT_NAV = [{ label: 'My lessons', icon: 'ti-school', href: '/learning' }]
const AUTHOR_NAV = [
  { label: 'My lessons', icon: 'ti-school', href: '/learning' },
  { label: 'New lesson', icon: 'ti-square-plus', href: '/learning/lessons/new' },
  { label: 'Lesson plans', icon: 'ti-notebook', href: '/learning/lesson-plans' },
]
const OVERVIEW_NAV = [{ label: 'Overview', icon: 'ti-school', href: '/learning' }]

// Smart Learning's own shell. Everyone signed in can enter (the lessons themselves are
// protected by the database), but only when the school has switched Smart Learning on.
export default function LearningLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState<Role | null>(null)
  const [state, setState] = useState<'checking' | 'ready' | 'off'>('checking')

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const r = profile?.role as Role | undefined
      if (!r || !ROLES.includes(r)) { router.push('/login'); return }

      // Same account checks as every portal (active, password changed, not the platform owner)...
      const mfaPromise = r === 'student' ? Promise.resolve(null) : getMfaRedirect(r)
      mfaPromise.catch(() => {})
      const roleRedirect = await verifyPortalRole(r)
      if (roleRedirect) { router.push(roleRedirect); return }
      // ...and the same MFA rule for staff.
      const mfaRedirect = await mfaPromise
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }

      const products = await getEnabledProducts()
      if (cancelled) return
      setRole(r)
      setState(products.includes('learning') ? 'ready' : 'off')
    }
    check()
    return () => { cancelled = true }
  }, [router, pathname])

  if (state === 'checking' || !role) return null

  if (state === 'off') {
    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <h1>Smart Learning isn&rsquo;t switched on for your school</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Your school administrator can ask for it to be added.</p>
        <a href={productHref('assess', role)} className="btn btn-secondary">Back to Smart Assess</a>
      </div>
    )
  }

  const nav = role === 'student' ? STUDENT_NAV : role === 'principal' ? OVERVIEW_NAV : AUTHOR_NAV
  return (
    <div className="portal-layout" style={{ minHeight: '100vh' }}>
      <InactivityLogout />
      <PresenceHeartbeat />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={nav} portalLabel="Smart Learning" resolveActivePathname={(p) => (p.startsWith('/learning/lesson/') || p.startsWith('/learning/lessons/') && p !== '/learning/lessons/new' ? '/learning' : p)} />
    </div>
  )
}
