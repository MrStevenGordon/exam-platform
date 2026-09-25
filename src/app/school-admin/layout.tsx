'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'
import OnboardingTour, { TourStep } from '@/components/OnboardingTour'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'
import { isTopicsAvailable } from '@/lib/topics'

const SCHOOL_ADMIN_TOUR_STEPS: TourStep[] = [
  { href: '/school-admin', title: 'Your home base', body: "This is where you'll land every time you sign in, with a school-wide overview." },
  { href: '/school-admin/departments', title: 'Departments', body: 'Set up departments and assign a head of department (supervisor) to each one.' },
  { href: '/school-admin/staff', title: 'Staff', body: 'Add teachers and supervisors one at a time, or import a whole list from a CSV file.' },
  { href: '/school-admin/students', title: 'Students', body: 'Add students individually or in bulk, and manage their class enrollment.' },
  { href: '/school-admin/settings', title: 'Settings', body: "Configure school-wide options here, including which tools and exam types your school uses." },
  { href: '/school-admin/analytics', title: 'Analytics', body: 'See how classes and departments are performing across the whole school.' },
  { href: '/school-admin/messages', title: 'Messages', body: "Message other staff directly, or the whole staff group. That badge shows how many you haven't read yet." },
  { href: '/school-admin/profile', title: "You're all set", body: 'Your profile and password live here. That covers the essentials. Explore the rest as you go.' },
]

const SCHOOL_ADMIN_NAV = [
  { label: 'Overview', icon: 'ti-home', href: '/school-admin' },
  { label: 'Departments', icon: 'ti-building', href: '/school-admin/departments' },
  { label: 'Subjects', icon: 'ti-book', href: '/school-admin/subjects' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/school-admin/timetable' },
  { label: 'Active Sessions', icon: 'ti-device-desktop', href: '/school-admin/active-sessions' },
  { label: 'Staff', icon: 'ti-users', href: '/school-admin/staff' },
  { label: 'Students', icon: 'ti-school', href: '/school-admin/students' },
  { label: 'Password requests', icon: 'ti-key', href: '/school-admin/password-requests' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/school-admin/analytics' },
  { label: 'Report Cards', icon: 'ti-report', href: '/school-admin/report-cards' },
  { label: 'Integrity', icon: 'ti-shield-exclamation', href: '/school-admin/integrity' },
  { label: 'Activity', icon: 'ti-activity', href: '/school-admin/activity' },
  { label: 'Year Promotion', icon: 'ti-arrow-up-circle', href: '/dashboard' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/school-admin/messages' },
  { label: 'Settings', icon: 'ti-settings', href: '/school-admin/settings' },
  { label: 'My Profile', icon: 'ti-user', href: '/school-admin/profile' },
]

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [topicsOn, setTopicsOn] = useState(false)

  useEffect(() => { isTopicsAvailable().then(setTopicsOn) }, [])

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

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <InactivityLogout />
      <PresenceHeartbeat />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={topicsOn ? SCHOOL_ADMIN_NAV.flatMap((n) => (n.href === '/school-admin/subjects' ? [n, { label: 'Topics', icon: 'ti-tags', href: '/school-admin/topics' }] : [n])) : SCHOOL_ADMIN_NAV} portalLabel="School Admin" />
      <OnboardingTour tourKey="admin" steps={SCHOOL_ADMIN_TOUR_STEPS} />
    </div>
  )
}
