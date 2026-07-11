'use client'

import Sidebar from '@/components/Sidebar'

const SUPERVISOR_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/supervisor' },
  { label: 'My Exams', icon: 'ti-file-text', href: '/supervisor/exams' },
  { label: 'Submissions', icon: 'ti-inbox', href: '/supervisor/submissions' },
  { label: 'Final Exams', icon: 'ti-file-check', href: '/supervisor/final-exams' },
  { label: 'Appointments', icon: 'ti-award', href: '/supervisor/appointments' },
  { label: 'My Classes', icon: 'ti-users', href: '/supervisor/classes' },
  { label: 'Subjects', icon: 'ti-books', href: '/supervisor/subjects' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/supervisor/analytics' },
  { label: 'My Profile', icon: 'ti-user', href: '/supervisor/profile' },
]

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <Sidebar navItems={SUPERVISOR_NAV} portalLabel="Supervisor Portal" />
      <main className="portal-content">{children}</main>
    </div>
  )
}
