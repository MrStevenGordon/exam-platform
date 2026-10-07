'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import OnboardingTour, { TourStep } from '@/components/OnboardingTour'
import { getMfaRedirect } from '@/lib/mfaCheck'

const OWNER_NAV = [
  { label: 'School requests', icon: 'ti-building-community', href: '/owner/school-requests' },
  { label: 'Org requests', icon: 'ti-briefcase', href: '/owner/org-requests' },
  { label: 'Configure school tools', icon: 'ti-adjustments', href: '/owner/school-features' },
  { label: 'Library catalog', icon: 'ti-books', href: '/owner/library' },
  { label: 'Curriculum guides', icon: 'ti-notebook', href: '/owner/curriculum' },
  { label: 'School subscriptions', icon: 'ti-id-badge-2', href: '/owner/school-subscriptions' },
  { label: 'Org subscriptions & payments', icon: 'ti-receipt', href: '/owner/organization-payments' },
]

const OWNER_TOUR_STEPS: TourStep[] = [
  { href: '/owner/school-requests', title: 'School requests', body: 'New schools asking to join show up here. Approve one to provision it its own database and admin account.' },
  { href: '/owner/org-requests', title: 'Org requests', body: 'Organizations (rather than individual schools) requesting access land here for the same kind of review.' },
  { href: '/owner/school-features', title: 'Configure school tools', body: "Right after provisioning a new school, set which review workflow and exam types it uses here." },
  { href: '/owner/school-subscriptions', title: 'School subscriptions', body: 'Grant or renew a school\'s subscription so their staff can keep logging in.' },
  { href: '/owner/organization-payments', title: "You're all set", body: 'Organization subscriptions and payments live here. That covers the essentials. Explore the rest as you go.' },
]

// This whole area is deliberately separate from /school-admin: it's for
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
      if (!user) { router.push('/admin-login'); return }

      const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
      if (!profile?.is_system_admin) { router.push('/admin-login'); return }

      const mfaRedirect = await getMfaRedirect('owner')
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }

      setChecked(true)
    }
    check()
  }, [router])

  if (!checked) return null

  return (
    <div className="portal-layout" style={{ minHeight: '100vh' }}>
      <InactivityLogout />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={OWNER_NAV} portalLabel="Owner Portal" logoutHref="/admin-login" roleLabel="Platform owner" hideProductSwitcher />
      <OnboardingTour tourKey="owner" steps={OWNER_TOUR_STEPS} />
    </div>
  )
}
