'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import OnboardingTour, { TourStep } from '@/components/OnboardingTour'
import { verifyPortalRole } from '@/lib/verifyPortalRole'

const STUDENT_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/student' },
  { label: 'Exams', icon: 'ti-file-text', href: '/student/exams' },
  { label: 'Tests', icon: 'ti-pencil', href: '/student/tests' },
  { label: 'Tasks', icon: 'ti-clipboard-list', href: '/student/tasks' },
  { label: 'Mock Exams', icon: 'ti-books', href: '/student/self-mock' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/student/timetable' },
  { label: 'Report Card', icon: 'ti-report', href: '/student/report-card' },
  { label: 'My Progress', icon: 'ti-chart-line', href: '/student/history' },
  { label: 'My Profile', icon: 'ti-user', href: '/student/profile' },
]

const STUDENT_TOUR_STEPS: TourStep[] = [
  { href: '/student', title: 'Your home base', body: "This is where you'll land every time you sign in. It shows what's coming up and anything you still need to complete." },
  { href: '/student/exams', title: 'Exams', body: 'Every exam your teachers have published to your class shows up here when it opens.' },
  { href: '/student/tests', title: 'Tests', body: 'Pop quizzes and class tests from your teachers, separate from your bigger scheduled exams.' },
  { href: '/student/self-mock', title: 'Mock exams', body: 'Practice on your own time with past questions. Nothing here counts toward your grade, so use it freely.' },
  { href: '/student/report-card', title: 'Report card', body: "Once your teachers release results, your grades for the term show up here." },
  { href: '/student/history', title: 'My Progress', body: 'A look back at everything you have taken so far, and how you did on each one.' },
  { href: '/student/profile', title: "You're all set", body: 'Your profile and password live here. That covers the essentials. Explore the rest as you go.' },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isTakePage = pathname?.includes('/take')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const roleRedirect = await verifyPortalRole('student')
      if (roleRedirect) { router.push(roleRedirect); return }
      setChecked(true)
    }
    checkAccess()
  }, [router])

  if (isTakePage) {
    return <>{children}</>
  }

  if (!checked) return null

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <InactivityLogout />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={STUDENT_NAV} portalLabel="Student Portal" />
      <OnboardingTour tourKey="student" steps={STUDENT_TOUR_STEPS} />
    </div>
  )
}
