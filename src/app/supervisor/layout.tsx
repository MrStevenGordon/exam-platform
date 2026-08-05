'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'

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
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/supervisor/analytics' },
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
    </div>
  )
}
