'use client'

import Sidebar from '@/components/Sidebar'

const STUDENT_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/student' },
  { label: 'Exams', icon: 'ti-file-text', href: '/student/exams' },
  { label: 'Tests', icon: 'ti-pencil', href: '/student/tests' },
  { label: 'Mock Exams', icon: 'ti-books', href: '/student/self-mock' },
  { label: 'My Progress', icon: 'ti-chart-line', href: '/student/history' },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-layout">
      <Sidebar navItems={STUDENT_NAV} portalLabel="Student Portal" />
      <main className="portal-content">{children}</main>
    </div>
  )
}
