'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SectionTabs, { type SectionTab } from '@/components/SectionTabs'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'
import OnboardingTour, { TourStep } from '@/components/OnboardingTour'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'

const SCHOOL_ADMIN_TOUR_STEPS: TourStep[] = [
  { href: '/school-admin', title: 'Your home base', body: "This is where you'll land every time you sign in, with a school-wide overview." },
  { href: '/school-admin/departments', title: 'Departments & Subjects', body: 'Set up departments, assign a head of department (supervisor) to each one, and add the subjects each department teaches.' },
  { href: '/school-admin/staff', title: 'Staff', body: 'Add teachers and supervisors one at a time, or import a whole list from a CSV file.' },
  { href: '/school-admin/students', title: 'Students', body: 'Add students individually or in bulk, and manage their class enrollment.' },
  { href: '/school-admin/settings', title: 'Settings', body: "Configure school-wide options here, including which tools and exam types your school uses." },
  { href: '/school-admin/analytics', title: 'Analytics & Integrity', body: 'See how classes and departments are performing across the whole school, and review writing-integrity flags on the Integrity tab.' },
  { href: '/school-admin/messages', title: 'Messages', body: "Message other staff directly, or the whole staff group. That badge shows how many you haven't read yet." },
  { href: '/school-admin/profile', title: "You're all set", body: 'Your profile and password live here. That covers the essentials. Explore the rest as you go.' },
]

const SCHOOL_ADMIN_NAV = [
  { label: 'Overview', icon: 'ti-home', href: '/school-admin' },
  { label: 'Departments & Subjects', icon: 'ti-building', href: '/school-admin/departments' },
  { label: 'Timetable & Report Cards', icon: 'ti-calendar', href: '/school-admin/timetable' },
  { label: 'Active Sessions', icon: 'ti-device-desktop', href: '/school-admin/active-sessions' },
  { label: 'Staff', icon: 'ti-users', href: '/school-admin/staff' },
  { label: 'Students', icon: 'ti-school', href: '/school-admin/students' },
  { label: 'Password requests', icon: 'ti-key', href: '/school-admin/password-requests' },
  { label: 'Analytics & Integrity', icon: 'ti-chart-bar', href: '/school-admin/analytics' },
  { label: 'Activity', icon: 'ti-activity', href: '/school-admin/activity' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/school-admin/messages' },
  { label: 'Settings', icon: 'ti-settings', href: '/school-admin/settings' },
  { label: 'My Profile', icon: 'ti-user', href: '/school-admin/profile' },
]

// Topics is deliberately not in this menu: the topic list builds itself from what teachers propose and heads of
// department review it (their portal). The page still exists at /school-admin/topics.

// Pages that share one menu entry and are switched between with tabs.
const TAB_GROUPS: { tabs: SectionTab[] }[] = [
  { tabs: [{ label: 'Timetable', href: '/school-admin/timetable' }, { label: 'Report Cards', href: '/school-admin/report-cards' }] },
  { tabs: [{ label: 'Analytics', href: '/school-admin/analytics' }, { label: 'Integrity', href: '/school-admin/integrity' }] },
]
// Old addresses that now live under another menu entry.
const ACTIVE_ALIASES: Record<string, string> = { '/school-admin/subjects': '/school-admin/departments' }

function resolveActivePathname(pathname: string): string {
  for (const g of TAB_GROUPS) {
    if (g.tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + '/'))) return g.tabs[0].href
  }
  return ACTIVE_ALIASES[pathname] ?? pathname
}

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)


  useEffect(() => {
    async function checkAccess() {
      const roleRedirect = await verifyPortalRole('admin')
      if (roleRedirect) { router.push(roleRedirect); return }
      const mfaRedirect = await getMfaRedirect('admin')
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }
      setChecked(true)
    }
    checkAccess()
  }, [router, pathname])

  if (!checked) return null

  const tabGroup = TAB_GROUPS.find((g) => g.tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + '/')))

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <InactivityLogout />
      <PresenceHeartbeat />
      <main className="portal-content">
        {tabGroup && <SectionTabs tabs={tabGroup.tabs} pathname={pathname} />}
        <PageTransition>{children}</PageTransition>
      </main>
      <Sidebar navItems={SCHOOL_ADMIN_NAV} portalLabel="School Admin Portal" resolveActivePathname={resolveActivePathname} />
      <OnboardingTour tourKey="admin" steps={SCHOOL_ADMIN_TOUR_STEPS} />
    </div>
  )
}
