'use client'

import Sidebar from '@/components/Sidebar'

const SUPERVISOR_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/supervisor' },
  { label: 'Submissions', icon: 'ti-inbox', href: '/supervisor/submissions' },
  { label: 'Final Exams', icon: 'ti-file-check', href: '/supervisor/final-exams' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/supervisor/analytics' },
]

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-layout">
      <Sidebar navItems={SUPERVISOR_NAV} portalLabel="Supervisor Portal" />
      <main className="portal-content">{children}</main>
    </div>
  )
}
