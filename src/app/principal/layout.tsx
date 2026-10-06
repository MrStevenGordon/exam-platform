'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'
import { PRINCIPAL_NAV, PRINCIPAL_TOUR_STEPS } from '@/lib/principalNav'
import OnboardingTour from '@/components/OnboardingTour'
import { useAttendanceAlerts } from '@/lib/useAttendanceAlerts'
import { isExamInsightAvailable } from '@/lib/examInsight'

export default function PrincipalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [accessOk, setAccessOk] = useState(false)
  const unreadAlerts = useAttendanceAlerts(accessOk)
  const [insightOn, setInsightOn] = useState(false)
  useEffect(() => { isExamInsightAvailable().then(setInsightOn) }, [])

  useEffect(() => {
    async function checkAccess() {
      // Same order as the other staff portals: the MFA lookup starts right away,
      // the role redirect still wins, and an MFA failure still blocks entry.
      const mfaPromise = getMfaRedirect('principal')
      mfaPromise.catch(() => {})
      const roleRedirect = await verifyPortalRole('principal')
      if (roleRedirect) { router.push(roleRedirect); return }
      const mfaRedirect = await mfaPromise
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }
      setChecked(true)
      setAccessOk(true)
    }
    checkAccess()
  }, [router, pathname])

  if (!checked) return null

  return (
    <div className="portal-layout" style={{ minHeight: '100vh' }}>
      <InactivityLogout />
      <PresenceHeartbeat />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={insightOn ? PRINCIPAL_NAV.flatMap((n) => (n.href === '/principal/students' ? [n, { label: 'Exam Insight', icon: 'ti-chart-dots', href: '/principal/insight' }] : [n])) : PRINCIPAL_NAV} portalLabel="Leadership Portal" badges={{ '/principal/alerts': unreadAlerts }} />
      <OnboardingTour tourKey="principal" steps={PRINCIPAL_TOUR_STEPS} />
    </div>
  )
}
