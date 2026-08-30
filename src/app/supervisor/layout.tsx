'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import OnboardingTour, { TourStep } from '@/components/OnboardingTour'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'

const SUPERVISOR_TOUR_STEPS: TourStep[] = [
  { href: '/supervisor', title: 'Your home base', body: "This is where you'll land every time you sign in, with anything waiting on you across your department." },
  { href: '/supervisor/submissions', title: 'Submissions', body: 'Standardized exams your teachers submit for review land here. Approve them, or send feedback back for changes.' },
  { href: '/supervisor/final-exams', title: 'Final Exams', body: 'Once you approve an exam, publish it to classes from here and manage everything already live.' },
  { href: '/supervisor/appointments', title: 'Appointments', body: 'Assign which teachers are team leads for a subject and grade, giving them access to create standardized exams.' },
  { href: '/supervisor/analytics', title: 'Analytics', body: "See how classes performed on published exams, department-wide." },
  { href: '/supervisor/integrity', title: 'Integrity', body: 'A view into flagged exam sessions across your department, including possible AI-assisted answers.' },
  { href: '/supervisor/messages', title: 'Messages', body: "Message other staff directly, or the whole staff group. That badge shows how many you haven't read yet." },
  { href: '/supervisor/profile', title: "You're all set", body: 'Your profile, classes, and password live here. That covers the essentials. Explore the rest as you go.' },
]

const SUPERVISOR_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/supervisor' },
  { label: 'My Exams', icon: 'ti-file-text', href: '/supervisor/exams' },
  { label: 'Submissions', icon: 'ti-inbox', href: '/supervisor/submissions' },
  { label: 'Final Exams', icon: 'ti-file-check', href: '/supervisor/final-exams' },
  { label: 'Appointments', icon: 'ti-award', href: '/supervisor/appointments' },
  { label: 'My Classes', icon: 'ti-users', href: '/supervisor/classes' },
  { label: 'Students', icon: 'ti-school', href: '/supervisor/students' },
  { label: 'Class Assignments', icon: 'ti-user-check', href: '/supervisor/class-assignments' },
  { label: 'Subjects', icon: 'ti-books', href: '/supervisor/subjects' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/supervisor/timetable' },
  { label: 'Report Cards', icon: 'ti-report', href: '/supervisor/report-cards' },
  { label: 'Integrity', icon: 'ti-shield-exclamation', href: '/supervisor/integrity' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/supervisor/analytics' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/supervisor/messages' },
  { label: 'My Profile', icon: 'ti-user', href: '/supervisor/profile' },
]

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

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
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={SUPERVISOR_NAV} portalLabel="Supervisor Portal" />
      <OnboardingTour tourKey="supervisor" steps={SUPERVISOR_TOUR_STEPS} />
    </div>
  )
}
