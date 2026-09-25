'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'
import OnboardingTour from '@/components/OnboardingTour'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'
import { hodNavItems, HOD_TOUR_STEPS, resolveHodActivePathname } from '@/lib/hodNav'
import { isAttendanceAvailable } from '@/lib/attendance'
import { isTopicsAvailable } from '@/lib/topics'

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [attendanceOn, setAttendanceOn] = useState(false)

  const [topicsOn, setTopicsOn] = useState(false)

  useEffect(() => { isAttendanceAvailable().then(setAttendanceOn) }, [])
  useEffect(() => { isTopicsAvailable().then(setTopicsOn) }, [])

  useEffect(() => {
    async function checkAccess() {
      const roleRedirect = await verifyPortalRole('supervisor')
      if (roleRedirect) { router.push(roleRedirect); return }
      const mfaRedirect = await getMfaRedirect('supervisor')
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }
      setChecked(true)
    }
    checkAccess()
  }, [router, pathname])

  if (!checked) return null

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <InactivityLogout />
      <PresenceHeartbeat />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={hodNavItems(attendanceOn, topicsOn)} portalLabel="HOD Portal" resolveActivePathname={resolveHodActivePathname} />
      <OnboardingTour tourKey="supervisor" steps={HOD_TOUR_STEPS} />
    </div>
  )
}
