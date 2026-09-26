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
import { isCoverageAvailable } from '@/lib/coverage'
import { FLAGS_CHANGED_EVENT, loadFlagCounts } from '@/lib/tutorFlags'

type Role = 'student' | 'teacher' | 'supervisor' | 'admin' | 'principal'
const ROLES: Role[] = ['student', 'teacher', 'supervisor', 'admin', 'principal']

const STUDENT_NAV = [{ label: 'My lessons', icon: 'ti-school', href: '/learning' }]
const AUTHOR_NAV = [
  { label: 'My lessons', icon: 'ti-school', href: '/learning' },
  { label: 'New lesson', icon: 'ti-square-plus', href: '/learning/lessons/new' },
  { label: 'Lesson plans', icon: 'ti-notebook', href: '/learning/lesson-plans' },
]
const OVERVIEW_NAV = [{ label: 'Coverage', icon: 'ti-chart-grid-dots', href: '/learning' }]
const COVERAGE_ITEM = { label: 'Coverage', icon: 'ti-chart-grid-dots', href: '/learning/coverage' }
const FLAGS_ITEM = { label: 'Tutor flags', icon: 'ti-shield-check', href: '/learning/flags' }

// Smart Learning's own shell. Everyone signed in can enter (the lessons themselves are
// protected by the database), but only when the school has switched Smart Learning on.
export default function LearningLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState<Role | null>(null)
  const [state, setState] = useState<'checking' | 'ready' | 'off'>('checking')
  // Heads of department and school admins get a Coverage page once migration 063 is applied.
  const [coverageOn, setCoverageOn] = useState(false)
  // The principal team and school admins get the school-wide list of flagged tutor conversations once
  // migration 065 is applied. `flagCount` is how many are still to be read (shown as a menu badge).
  const [flagsOn, setFlagsOn] = useState(false)
  const [flagCount, setFlagCount] = useState(0)

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
      const coverage = r === 'supervisor' || r === 'admin' ? await isCoverageAvailable() : false
      const flags = r === 'admin' || r === 'principal' ? await loadFlagCounts() : null
      if (cancelled) return
      setCoverageOn(coverage)
      setFlagsOn(!!flags)
      setFlagCount(flags?.open_total ?? 0)
      setRole(r)
      setState(products.includes('learning') ? 'ready' : 'off')
    }
    check()
    return () => { cancelled = true }
  }, [router, pathname])

  // When someone marks a flagged conversation read, the menu count updates without a page change.
  useEffect(() => {
    if (!flagsOn) return
    let cancelled = false
    const refresh = () => { loadFlagCounts().then((c) => { if (!cancelled && c) setFlagCount(c.open_total) }) }
    window.addEventListener(FLAGS_CHANGED_EVENT, refresh)
    return () => { cancelled = true; window.removeEventListener(FLAGS_CHANGED_EVENT, refresh) }
  }, [flagsOn])

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

  const base = role === 'student' ? STUDENT_NAV : role === 'principal' ? OVERVIEW_NAV : coverageOn ? [...AUTHOR_NAV, COVERAGE_ITEM] : AUTHOR_NAV
  const nav = flagsOn && (role === 'admin' || role === 'principal') ? [...base, FLAGS_ITEM] : base
  return (
    <div className="portal-layout" style={{ minHeight: '100vh' }}>
      <InactivityLogout />
      <PresenceHeartbeat />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={nav} badges={flagsOn ? { [FLAGS_ITEM.href]: flagCount } : undefined} portalLabel="Smart Learning" resolveActivePathname={(p) => (p.startsWith('/learning/lesson/') || p.startsWith('/learning/lessons/') && p !== '/learning/lessons/new' ? '/learning' : p)} />
    </div>
  )
}
