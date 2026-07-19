'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { getMfaRedirect } from '@/lib/mfaCheck'

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
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function checkMfa() {
      const redirect = await getMfaRedirect('supervisor')
      if (redirect) { router.push(redirect); return }
      setChecked(true)
    }
    checkMfa()
  }, [router])

  if (!checked) return null

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <main className="portal-content">{children}</main>
      <Sidebar navItems={SUPERVISOR_NAV} portalLabel="Supervisor Portal" />
    </div>
  )
}
