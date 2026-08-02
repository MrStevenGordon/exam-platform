'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import { verifyPortalRole } from '@/lib/verifyPortalRole'

const STUDENT_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/student' },
  { label: 'Exams', icon: 'ti-file-text', href: '/student/exams' },
  { label: 'Tests', icon: 'ti-pencil', href: '/student/tests' },
  { label: 'Tasks', icon: 'ti-clipboard-list', href: '/student/tasks' },
  { label: 'Mock Exams', icon: 'ti-books', href: '/student/self-mock' },
  { label: 'My Progress', icon: 'ti-chart-line', href: '/student/history' },
  { label: 'My Profile', icon: 'ti-user', href: '/student/profile' },
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
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={STUDENT_NAV} portalLabel="Student Portal" />
    </div>
  )
}
