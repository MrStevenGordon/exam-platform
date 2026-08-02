'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'

const OWNER_NAV = [
  { label: 'School requests', href: '/owner/school-requests' },
  { label: 'Configure school tools', href: '/owner/school-features' },
  { label: 'School subscriptions', href: '/owner/school-subscriptions' },
  { label: 'Org subscriptions & payments', href: '/owner/organization-payments' },
]

// This whole area is deliberately separate from /school-admin — it's for
// the platform owner only (approving new schools, granting/renewing
// organization subscriptions), never for an individual school's own admin
// staff, no matter how the school-admin portal's own access rules evolve.
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
      if (!profile?.is_system_admin) { router.push('/login'); return }

      setChecked(true)
    }
    check()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!checked) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <InactivityLogout />
      <div style={{
        background: '#1A0E06',
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Smart Assess Ja</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Administrator</div>
          </div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {OWNER_NAV.map((item) => (
              <Link key={item.href} href={item.href} style={{
                fontSize: 13, padding: '6px 12px', borderRadius: 6, textDecoration: 'none',
                color: pathname?.startsWith(item.href) ? '#FAC882' : 'rgba(255,255,255,0.6)',
                background: pathname?.startsWith(item.href) ? 'rgba(212,118,42,0.25)' : 'transparent',
                fontWeight: pathname?.startsWith(item.href) ? 600 : 400,
              }}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <button onClick={handleLogout} className="btn btn-ghost">Log out</button>
      </div>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  )
}
